import { isSameOrigin, json, readJson } from "./shared/http.js";
import { readCookies, sha256Hex } from "./shared/session.js";

const SPEAKING_ENGLISH_PATH = "/api/speaking/english";
const SESSION_COOKIE = "__Host-joy_session";
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.2-3b-instruct";

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
    if (!original || original.length > 500 || /[\r\n]/.test(String(body.text || ""))) {
      return json({ error: "INVALID_SPEAKING_INPUT" }, 400);
    }
    if (!env?.AI?.run) return json({ error: "SPEAKING_AI_UNAVAILABLE" }, 503);

    const messages = [
      {
        role: "system",
        content: `Turn one Vietnamese utterance into one natural English sentence that a person would actually say in conversation.

Rules:
- Return exactly one English sentence only.
- Do not return alternatives, explanations, labels, notes, quotation marks, markdown, or Vietnamese text.
- Preserve the original meaning, intent, tone, names, numbers, dates, and level of politeness.
- Prefer natural everyday spoken English over a literal word-for-word translation.
- Keep a question as a question, a request as a natural request, and a statement as a statement.
- Do not add details that are not present in the Vietnamese input.`,
      },
      { role: "user", content: original },
    ];

    try {
      const result = await env.AI.run(env.SPEAKING_AI_MODEL || DEFAULT_AI_MODEL, {
        messages,
        temperature: 0,
        max_tokens: 96,
      });
      const sentence = normalizeEnglishSentence(extractAiText(result));
      if (!sentence) return json({ error: "SPEAKING_RESULT_INVALID" }, 502);
      return json({ sentence });
    } catch (error) {
      console.error("Joy speaking translation failed", error);
      if (isDailyAiLimit(error)) return json({ error: "AI_DAILY_LIMIT_REACHED" }, 429);
      return json({ error: "SPEAKING_AI_FAILED" }, 502);
    }
  } catch (error) {
    console.error("Joy speaking request failed", error);
    return json({ error: "SPEAKING_REQUEST_FAILED" }, 500);
  }
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
