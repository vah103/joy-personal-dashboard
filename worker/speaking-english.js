import { isSameOrigin, json, readJson } from "./shared/http.js";
import { readCookies, sha256Hex } from "./shared/session.js";
import {
  createOpenAiResponse,
  hasOpenAi,
  readLanguageCache,
  writeLanguageCache,
} from "./shared/openai-responses.js";

const SPEAKING_ENGLISH_PATH = "/api/speaking/english";
const SESSION_COOKIE = "__Host-joy_session";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.2-3b-instruct";
const SPEAKING_CACHE_VERSION = "v2";
const SPEAKING_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;
const ALLOWED_TONES = new Set(["natural", "casual", "polite", "work"]);

export function isSpeakingEnglishRoute(pathname) {
  return pathname === SPEAKING_ENGLISH_PATH;
}

export async function handleSpeakingEnglishRequest(request, env) {
  try {
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

    const email = await sessionEmail(request, env);
    if (!email) return json({ error: "UNAUTHENTICATED" }, 401);

    const body = await readJson(request);
    const original = cleanText(body.text);
    const tone = normalizeTone(body.tone);
    if (!original || original.length > 500 || /[\r\n]/.test(String(body.text || ""))) {
      return json({ error: "INVALID_SPEAKING_INPUT" }, 400);
    }
    if (!tone) return json({ error: "INVALID_SPEAKING_TONE" }, 400);

    const cacheInput = `${SPEAKING_CACHE_VERSION}\n${tone}\n${original.toLocaleLowerCase("vi")}`;
    const cached = await readLanguageCache({
      feature: "say-it",
      userEmail: email,
      input: cacheInput,
    });
    const cachedSentence = normalizeEnglishSentence(cached?.sentence);
    if (cachedSentence) {
      return json({
        sentence: cachedSentence,
        tone,
        cached: true,
        provider: "openai",
        model: cleanText(cached.model) || DEFAULT_OPENAI_MODEL,
      });
    }

    const instructions = speakingInstructions(tone);

    if (hasOpenAi(env)) {
      try {
        const result = await createOpenAiResponse(env, {
          model: env.OPENAI_SPEAKING_MODEL || DEFAULT_OPENAI_MODEL,
          instructions,
          input: original,
          maxOutputTokens: 60,
        });
        const sentence = normalizeEnglishSentence(result.text);
        if (!sentence) throw Object.assign(new Error("OPENAI_SPEAKING_RESULT_INVALID"), {
          code: "OPENAI_SPEAKING_RESULT_INVALID",
        });

        await writeLanguageCache({
          feature: "say-it",
          userEmail: email,
          input: cacheInput,
          value: { sentence, model: result.model },
          ttlSeconds: SPEAKING_CACHE_TTL_SECONDS,
        }).catch(() => false);

        return json({
          sentence,
          tone,
          cached: false,
          provider: "openai",
          model: result.model,
          usage: result.usage,
        });
      } catch (error) {
        console.warn("Joy OpenAI speaking request failed; using Workers AI fallback", error?.code || error?.message);
      }
    }

    if (!env?.AI?.run) return json({ error: "SPEAKING_AI_UNAVAILABLE" }, 503);

    try {
      const result = await env.AI.run(
        env.SPEAKING_AI_MODEL || DEFAULT_WORKERS_AI_MODEL,
        {
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: original },
          ],
          temperature: 0,
          max_tokens: 80,
        },
      );
      const sentence = normalizeEnglishSentence(extractAiText(result));
      if (!sentence) return json({ error: "SPEAKING_RESULT_INVALID" }, 502);
      return json({
        sentence,
        tone,
        cached: false,
        provider: "workers-ai",
        model: env.SPEAKING_AI_MODEL || DEFAULT_WORKERS_AI_MODEL,
      });
    } catch (error) {
      console.error("Joy speaking fallback failed", error);
      if (isDailyAiLimit(error)) return json({ error: "AI_DAILY_LIMIT_REACHED" }, 429);
      return json({ error: "SPEAKING_AI_FAILED" }, 502);
    }
  } catch (error) {
    console.error("Joy speaking request failed", error);
    return json({ error: "SPEAKING_REQUEST_FAILED" }, 500);
  }
}

function speakingInstructions(tone) {
  const toneRule = {
    natural: "Use neutral, natural everyday spoken English.",
    casual: "Use relaxed, friendly spoken English without slang that changes the meaning.",
    polite: "Use polite spoken English and preserve the original level of formality.",
    work: "Use concise, professional workplace English.",
  }[tone];

  return `Turn one Vietnamese utterance into one English sentence a person would actually say.
${toneRule}
Return exactly one English sentence only.
Preserve meaning, intent, names, numbers, dates, and whether it is a question, request, or statement.
Do not add details, alternatives, explanations, labels, quotation marks, markdown, or Vietnamese text.`;
}

function normalizeTone(value) {
  const tone = cleanText(value || "natural").toLowerCase();
  return ALLOWED_TONES.has(tone) ? tone : "";
}

function extractAiText(result) {
  const value = result?.response ?? result?.result ?? result?.text ?? "";
  if (value && typeof value === "object") {
    return value.sentence ?? value.translation ?? value.response ?? value.text ?? "";
  }

  const raw = String(value || "").trim();
  if (!raw) return "";
  const unfenced = raw
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(unfenced);
    if (parsed && typeof parsed === "object") {
      return parsed.sentence ?? parsed.translation ?? parsed.response ?? parsed.text ?? "";
    }
  } catch {
    // Plain text is the preferred response format.
  }

  return unfenced;
}

function normalizeEnglishSentence(value) {
  const firstLine = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";
  const sentence = cleanText(firstLine)
    .replace(/^[-*•]+\s*/, "")
    .replace(/^\s*(?:english|translation|answer|sentence)\s*:\s*/i, "")
    .replace(/^(?:["'`])(.*)(?:["'`])$/, "$1")
    .trim();
  return sentence && sentence.length <= 500 ? sentence : "";
}

function isDailyAiLimit(error) {
  const message = String(error?.message || error || "");
  return /(?:4006|daily free allocation|used up your daily)/i.test(message);
}

async function sessionEmail(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token || !env?.DB) return "";
  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(`
    SELECT user_email
    FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).bind(tokenHash, Date.now()).first();
  return cleanText(session?.user_email).toLowerCase();
}

function cleanText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
