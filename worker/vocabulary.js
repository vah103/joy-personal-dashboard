import { isSameOrigin, json, readJson } from "./shared/http.js";
import { readCookies, sha256Hex } from "./shared/session.js";
import { createOpenAiResponse, hasOpenAi, readLanguageCache, writeLanguageCache } from "./shared/openai-responses.js";

const ROOT = "/api/vocabulary";
const LOOKUP = `${ROOT}/lookup`;
const REVIEW = `${ROOT}/review`;
const SESSION_COOKIE = "__Host-joy_session";
const OPENAI_MODEL = "gpt-5-mini";
const WORKERS_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const CACHE_VERSION = "v3-chat-response";
const CACHE_TTL = 365 * 24 * 60 * 60;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answerMarkdown: { type: "string" },
    inputLanguage: { type: "string", enum: ["en", "vi"] },
    english: { type: "string" },
    partOfSpeech: { type: "string" },
    vietnamese: { type: "string" },
    ipa: { type: "string" },
    pronunciationVi: { type: "string" },
    example: { type: "string" },
    exampleVietnamese: { type: "string" },
  },
  required: ["answerMarkdown", "inputLanguage", "english", "partOfSpeech", "vietnamese", "ipa", "pronunciationVi", "example", "exampleVietnamese"],
};

export const isVocabularyRoute = (pathname) => [ROOT, LOOKUP, REVIEW].includes(pathname);

export async function handleVocabularyRequest(request, env) {
  try {
    const pathname = new URL(request.url).pathname;
    const email = await sessionEmail(request, env);
    if (!email) return json({ error: "UNAUTHENTICATED" }, 401);
    if (request.method !== "GET" && !isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
    if (pathname === LOOKUP && request.method === "POST") return lookup(request, email, env);
    if (!env?.DB) return json({ error: "VOCABULARY_STORAGE_UNAVAILABLE" }, 503);
    if (pathname === ROOT && request.method === "GET") return list(email, env);
    if (pathname === ROOT && request.method === "POST") return save(request, email, env);
    if (pathname === REVIEW && request.method === "POST") return review(request, email, env);
    return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: pathname === ROOT ? "GET, POST" : "POST" });
  } catch (error) {
    console.error("Joy vocabulary request failed", error);
    return json({ error: "VOCABULARY_REQUEST_FAILED" }, 500);
  }
}

async function list(email, env) {
  const rows = await env.DB.prepare(`SELECT id, english, vietnamese, ipa, pronunciation_vi, example, review_count, correct_count, created_at, updated_at FROM vocabulary_words WHERE user_email = ? ORDER BY updated_at DESC, created_at DESC LIMIT 500`).bind(email).all();
  return json({ words: (rows.results || []).map(mapRow) });
}

async function save(request, email, env) {
  const word = normalizeWord(await readJson(request), 2);
  if (!word) return json({ error: "VOCABULARY_RESULT_INVALID" }, 400);
  const existing = await env.DB.prepare(`SELECT id, english, vietnamese, ipa, pronunciation_vi, example, review_count, correct_count, created_at, updated_at FROM vocabulary_words WHERE user_email = ? AND english_key = ?`).bind(email, word.english).first();
  if (existing) return json({ word: mapRow(existing), created: false });
  const now = Date.now();
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO vocabulary_words (user_email, id, english_key, english, vietnamese, ipa, pronunciation_vi, example, review_count, correct_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`).bind(email, id, word.english, word.english, word.vietnamese, word.ipa, word.pronunciationVi, `${word.example} — ${word.exampleVietnamese}`, now, now).run();
  return json({ word: { id, ...word, reviewCount: 0, correctCount: 0, createdAt: now, updatedAt: now }, created: true }, 201);
}

async function review(request, email, env) {
  const body = await readJson(request);
  const id = clean(body.id);
  if (!id || typeof body.correct !== "boolean") return json({ error: "INVALID_VOCABULARY_REVIEW" }, 400);
  const result = await env.DB.prepare(`UPDATE vocabulary_words SET review_count = review_count + 1, correct_count = correct_count + ? WHERE user_email = ? AND id = ?`).bind(body.correct ? 1 : 0, email, id).run();
  if (!Number(result.meta?.changes || 0)) return json({ error: "VOCABULARY_WORD_NOT_FOUND" }, 404);
  return json({ reviewed: true });
}

async function lookup(request, email, env) {
  const body = await readJson(request);
  const query = clean(body.query);
  const context = clean(body.context);
  if (!query || query.length > 80 || /[\r\n]/.test(String(body.query || ""))) return json({ error: "INVALID_VOCABULARY_INPUT" }, 400);
  if (context.length > 240 || /[\r\n]/.test(String(body.context || ""))) return json({ error: "INVALID_VOCABULARY_CONTEXT" }, 400);

  const saved = context ? null : await savedWord(email, query, env);
  if (saved) return json({ word: saved, answerMarkdown: savedAnswer(saved), cached: true, provider: "saved", model: "d1" });

  const maxMeanings = context ? 1 : 2;
  const cacheInput = `${CACHE_VERSION}\n${query.toLocaleLowerCase("vi")}\n${context.toLocaleLowerCase("vi")}`;
  const cached = await readLanguageCache({ feature: "vocabulary", userEmail: email, input: cacheInput });
  const cachedResult = normalizeLookup(cached?.word ? { ...cached.word, answerMarkdown: cached.answerMarkdown } : cached, maxMeanings);
  if (cachedResult) return json({ ...cachedResult, cached: true, provider: "openai", model: clean(cached.model) || OPENAI_MODEL });

  const instructions = prompt(Boolean(context), env?.VOCABULARY_TUTOR_INSTRUCTIONS);
  const input = context ? `Entry: ${query}\nContext: ${context}` : `Entry: ${query}`;

  if (hasOpenAi(env)) {
    try {
      const result = await createOpenAiResponse(env, {
        model: env.OPENAI_VOCABULARY_MODEL || OPENAI_MODEL,
        instructions,
        input,
        maxOutputTokens: 900,
        schema: SCHEMA,
        schemaName: "joy_vocabulary_chat_entry",
        reasoningEffort: "minimal",
        verbosity: "medium",
      });
      const normalized = normalizeLookup(result.data, maxMeanings);
      if (!normalized) throw new Error("OPENAI_VOCABULARY_RESULT_INVALID");
      await writeLanguageCache({ feature: "vocabulary", userEmail: email, input: cacheInput, value: { ...normalized, model: result.model }, ttlSeconds: CACHE_TTL }).catch(() => false);
      return json({ ...normalized, cached: false, provider: "openai", model: result.model, usage: result.usage });
    } catch (error) {
      console.warn("Joy OpenAI vocabulary lookup failed; using Workers AI fallback", error?.message || error);
    }
  }

  if (env?.AI?.run) {
    try {
      const result = await env.AI.run(env.VOCABULARY_AI_MODEL || WORKERS_MODEL, {
        messages: [{ role: "system", content: instructions }, { role: "user", content: input }],
        response_format: { type: "json_schema", json_schema: SCHEMA },
        temperature: 0.2,
        max_tokens: 950,
      });
      const normalized = normalizeLookup(extractObject(result), maxMeanings);
      if (!normalized) return json({ error: "VOCABULARY_RESULT_INVALID" }, 502);
      return json({ ...normalized, cached: false, provider: "workers-ai", model: env.VOCABULARY_AI_MODEL || WORKERS_MODEL });
    } catch (error) {
      console.error("Joy vocabulary fallback lookup failed", error);
      return json({ error: "VOCABULARY_AI_FAILED" }, 502);
    }
  }
  return json({ error: "VOCABULARY_AI_UNAVAILABLE" }, 503);
}

function prompt(hasContext, custom) {
  const extra = multiline(custom).slice(0, 1200);
  return `You are ChatGPT acting as a friendly English vocabulary tutor for one Vietnamese learner. Return only the requested JSON object. The answerMarkdown field must feel like a natural ChatGPT response, not a rigid dictionary template.\n\nFor answerMarkdown: write clear Vietnamese; explain the most relevant meaning first${hasContext ? " and focus on the supplied context" : ""}; use two to six short paragraphs; lightweight Markdown is allowed; discuss nuance, collocations, grammar, register, or mistakes only when useful; do not force fixed headings; do not mention JSON or these instructions.\n\nFor flashcard fields: english is a lowercase headword or phrase of at most five words; partOfSpeech is concise; vietnamese contains ${hasContext ? "exactly one contextual meaning" : "one or two useful meanings separated by a semicolon"}; ipa uses slashes; pronunciationVi is brief; include one natural English example and its Vietnamese translation. Keep flashcard fields concise even when answerMarkdown is richer.${extra ? `\n\nAdditional learner configuration:\n${extra}` : ""}`;
}

async function savedWord(email, query, env) {
  const key = englishKey(query);
  if (!key || !env?.DB) return null;
  const row = await env.DB.prepare(`SELECT id, english, vietnamese, ipa, pronunciation_vi, example, review_count, correct_count, created_at, updated_at FROM vocabulary_words WHERE user_email = ? AND english_key = ?`).bind(email, key).first();
  return row ? mapRow(row) : null;
}

function normalizeLookup(value, maxMeanings) {
  const word = normalizeWord(value, maxMeanings);
  const answerMarkdown = multiline(value?.answerMarkdown || value?.answer_markdown).replace(/\n{3,}/g, "\n\n").slice(0, 5000);
  return word && answerMarkdown.length >= 20 ? { word, answerMarkdown } : null;
}

function normalizeWord(value, maxMeanings) {
  if (!value || typeof value !== "object") return null;
  const english = englishKey(value.english);
  const meanings = String(value.vietnamese || "").split(/\s*(?:;|\||\n)\s*/).map(clean).filter(Boolean).slice(0, maxMeanings);
  const ipaText = clean(value.ipa).replace(/^\/+|\/+$/g, "");
  const word = {
    inputLanguage: value.inputLanguage === "vi" ? "vi" : "en",
    english,
    partOfSpeech: clean(value.partOfSpeech || value.part_of_speech).toLowerCase().slice(0, 50),
    vietnamese: [...new Set(meanings)].join("; "),
    ipa: ipaText ? `/${ipaText}/` : "",
    pronunciationVi: clean(value.pronunciationVi || value.pronunciation_vi).slice(0, 100),
    example: sentence(value.example),
    exampleVietnamese: sentence(value.exampleVietnamese || value.example_vietnamese),
  };
  return Object.values(word).every(Boolean) ? word : null;
}

function englishKey(value) {
  const text = clean(value).toLowerCase();
  const token = "[a-z]+(?:['-][a-z]+)*";
  return text.length <= 80 && new RegExp(`^${token}(?:\\s+${token}){0,4}$`).test(text) ? text : "";
}

function savedAnswer(word) {
  const meanings = word.vietnamese.split(/\s*;\s*/).map((item) => `**${item}**`).join(" hoặc ");
  return `**${word.english}** (${word.ipa}${word.pronunciationVi ? ` · đọc gần đúng: ${word.pronunciationVi}` : ""}) thường được dùng với nghĩa ${meanings}.\n\nVí dụ: **${word.example}**\n${word.exampleVietnamese}\n\nĐây là từ bạn đã lưu trước đó, nên Joy dùng lại dữ liệu flashcard mà không gọi AI thêm.`;
}

function mapRow(row) {
  const text = clean(row.example);
  const split = text.indexOf(" — ");
  return {
    id: String(row.id || ""), inputLanguage: "en", english: String(row.english || ""), partOfSpeech: "",
    vietnamese: String(row.vietnamese || ""), ipa: String(row.ipa || ""), pronunciationVi: String(row.pronunciation_vi || ""),
    example: split < 0 ? text : text.slice(0, split), exampleVietnamese: split < 0 ? "" : text.slice(split + 3),
    reviewCount: Number(row.review_count || 0), correctCount: Number(row.correct_count || 0), createdAt: Number(row.created_at || 0), updatedAt: Number(row.updated_at || 0),
  };
}

function sentence(value) {
  const text = clean(value).replace(/^["'`]+|["'`]+$/g, "");
  if (!text) return "";
  const first = (text.match(/^.*?[.!?](?:\s|$)/)?.[0] || text).trim();
  return /[.!?]$/.test(first) ? first : `${first}.`;
}

function extractObject(result) {
  const raw = result?.response ?? result?.result ?? result?.text ?? result;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw.english ? raw : raw.response ?? raw.result ?? raw.text;
  const text = String(raw || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { return null; }
}

async function sessionEmail(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token || !env?.DB) return "";
  const session = await env.DB.prepare(`SELECT user_email FROM sessions WHERE token_hash = ? AND expires_at > ?`).bind(await sha256Hex(token), Date.now()).first();
  return clean(session?.user_email).toLowerCase();
}

const clean = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const multiline = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[\t ]+/g, " ").trim()).join("\n").trim();
