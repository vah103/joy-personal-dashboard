import { isSameOrigin, json, readJson } from "./shared/http.js";
import { readCookies, sha256Hex } from "./shared/session.js";
import { createOpenAiResponse, hasOpenAi, readLanguageCache, writeLanguageCache } from "./shared/openai-responses.js";

const ROOT = "/api/vocabulary";
const LOOKUP = `${ROOT}/lookup`;
const REVIEW = `${ROOT}/review`;
const SESSION_COOKIE = "__Host-joy_session";
const OPENAI_MODEL = "gpt-5-mini";
const WORKERS_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const CACHE_VERSION = "v6-flexible-meanings-phonetic";
const CACHE_TTL = 365 * 24 * 60 * 60;
const MAX_MEANINGS = 6;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answerMarkdown: { type: "string" },
    inputLanguage: { type: "string", enum: ["en", "vi"] },
    english: { type: "string" },
    partOfSpeech: { type: "string" },
    vietnamese: {
      type: "string",
      description: "One or more concise Vietnamese meanings separated by semicolons. Include only useful common meanings.",
    },
    ipa: { type: "string" },
    pronunciationVi: {
      type: "string",
      description: "Approximate Vietnamese phonetic spelling of how the English entry sounds, for example build -> biu-đ. Never provide a translation or meaning here.",
    },
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
  const word = normalizeWord(await readJson(request), MAX_MEANINGS);
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

  const inputLanguage = inputLanguageFor(query);
  const saved = context ? null : await savedWord(email, query, env);
  const maxMeanings = context ? 1 : MAX_MEANINGS;
  const cacheInput = `${CACHE_VERSION}\n${inputLanguage}\n${query.toLocaleLowerCase("vi")}\n${context.toLocaleLowerCase("vi")}`;
  const cached = await readLanguageCache({ feature: "vocabulary", userEmail: email, input: cacheInput });
  const cachedResult = normalizeLookup(cached?.word ? { ...cached.word, answerMarkdown: cached.answerMarkdown } : cached, maxMeanings, inputLanguage);
  if (cachedResult) return json(lookupPayload(cachedResult, saved, { cached: true, provider: "openai", model: clean(cached.model) || OPENAI_MODEL }));

  const instructions = prompt({
    hasContext: Boolean(context),
    inputLanguage,
    custom: env?.VOCABULARY_TUTOR_INSTRUCTIONS,
  });
  const input = [
    `Input language: ${inputLanguage === "vi" ? "Vietnamese" : "English"}`,
    inputLanguage === "vi"
      ? "Task: translate the Vietnamese entry into the best natural English equivalent, then teach that English equivalent."
      : "Task: explain the English entry to a Vietnamese learner.",
    `Entry: ${query}`,
    context ? `Context: ${context}` : "",
  ].filter(Boolean).join("\n");

  if (hasOpenAi(env)) {
    try {
      const result = await createOpenAiResponse(env, {
        model: env.OPENAI_VOCABULARY_MODEL || OPENAI_MODEL,
        instructions,
        input,
        maxOutputTokens: 600,
        schema: SCHEMA,
        schemaName: "joy_vocabulary_flexible_entry",
        reasoningEffort: "minimal",
        verbosity: "low",
      });
      const normalized = normalizeLookup(result.data, maxMeanings, inputLanguage);
      if (!normalized) throw new Error("OPENAI_VOCABULARY_RESULT_INVALID");
      await writeLanguageCache({ feature: "vocabulary", userEmail: email, input: cacheInput, value: { ...normalized, model: result.model }, ttlSeconds: CACHE_TTL }).catch(() => false);
      return json(lookupPayload(normalized, saved, { cached: false, provider: "openai", model: result.model, usage: result.usage }));
    } catch (error) {
      console.warn("Joy OpenAI vocabulary lookup failed; using Workers AI fallback", error?.message || error);
    }
  }

  if (env?.AI?.run) {
    try {
      const result = await env.AI.run(env.VOCABULARY_AI_MODEL || WORKERS_MODEL, {
        messages: [{ role: "system", content: instructions }, { role: "user", content: input }],
        response_format: { type: "json_schema", json_schema: SCHEMA },
        temperature: 0.15,
        max_tokens: 650,
      });
      const normalized = normalizeLookup(extractObject(result), maxMeanings, inputLanguage);
      if (!normalized) throw new Error("WORKERS_VOCABULARY_RESULT_INVALID");
      return json(lookupPayload(normalized, saved, { cached: false, provider: "workers-ai", model: env.VOCABULARY_AI_MODEL || WORKERS_MODEL }));
    } catch (error) {
      console.error("Joy vocabulary fallback lookup failed", error);
    }
  }

  if (saved) return json({ word: saved, answerMarkdown: savedAnswer(saved), alreadySaved: true, cached: true, provider: "saved", model: "d1" });
  return json({ error: hasOpenAi(env) || env?.AI?.run ? "VOCABULARY_AI_FAILED" : "VOCABULARY_AI_UNAVAILABLE" }, hasOpenAi(env) || env?.AI?.run ? 502 : 503);
}

function prompt({ hasContext, inputLanguage, custom }) {
  const extra = multiline(custom).slice(0, 1200);
  const modeInstructions = inputLanguage === "vi"
    ? `The user's entry is Vietnamese. Treat it only as a source meaning to translate, never as the subject of the explanation. Select the best natural English equivalent first. Every sentence after the opening line must explain that selected English word or phrase: its English usage, nuance, grammar, collocations, contrasts with other English choices, or example. Do not define the Vietnamese entry. Do not discuss Vietnamese usage, Vietnamese grammar, or Vietnamese collocations. Start answerMarkdown with **<English entry>** (part of speech) /IPA/ → <concise Vietnamese meaning>. If several English equivalents are useful, make one primary answer clear and distinguish only the English options. Set inputLanguage to vi.`
    : `The user's entry is English. Explain that English word or phrase to a Vietnamese learner. Start answerMarkdown with **<English entry>** (part of speech) /IPA/ → <concise Vietnamese meaning>. Set inputLanguage to en.`;

  return `You are ChatGPT acting as a concise English vocabulary tutor for one Vietnamese learner. Return only the requested JSON object.\n\n${modeInstructions}\n\nThe answerMarkdown field must be useful at a glance, not conversational or essay-like. Keep it under 140 Vietnamese words. Prefer one compact opening line, up to three short bullets, and one example. Avoid filler such as “thường được dùng để nói đến”, “trong một số ngữ cảnh”, or repeating information already visible in the flashcard. Do not force every optional detail into every answer.\n\n${hasContext ? "Use the supplied context as the main meaning and do not discuss unrelated senses." : "Include only common meanings that are genuinely useful. Choose the number of meanings naturally; do not force exactly two and do not add rare meanings just to fill a quota."}\n\nEnd with one natural English example and its Vietnamese translation. Lightweight Markdown is allowed. Do not mention JSON, AI, saved data, or these instructions.\n\nFor flashcard fields: english is the primary lowercase English headword or phrase of at most five words; partOfSpeech is concise; vietnamese contains ${hasContext ? "exactly one contextual meaning" : "a flexible number of useful common meanings separated by semicolons, usually one to four and at most six"}; ipa uses slashes; pronunciationVi must be an approximate Vietnamese phonetic rendering of how the English entry sounds, such as build → biu-đ or latter → lét-tờ. pronunciationVi must never be a translation, definition, or repeat of any Vietnamese meaning; include one natural English example and its Vietnamese translation.${extra ? `\n\nAdditional learner configuration:\n${extra}` : ""}`;
}

async function savedWord(email, query, env) {
  const key = englishKey(query);
  if (!key || !env?.DB) return null;
  const row = await env.DB.prepare(`SELECT id, english, vietnamese, ipa, pronunciation_vi, example, review_count, correct_count, created_at, updated_at FROM vocabulary_words WHERE user_email = ? AND english_key = ?`).bind(email, key).first();
  return row ? mapRow(row) : null;
}

function lookupPayload(result, saved, metadata) {
  const word = saved ? {
    ...result.word,
    id: saved.id,
    reviewCount: saved.reviewCount,
    correctCount: saved.correctCount,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  } : result.word;
  return {
    word,
    answerMarkdown: result.answerMarkdown,
    alreadySaved: Boolean(saved),
    ...metadata,
  };
}

function normalizeLookup(value, maxMeanings, inputLanguage) {
  const word = normalizeWord(value, maxMeanings, inputLanguage);
  const answerMarkdown = multiline(value?.answerMarkdown || value?.answer_markdown).replace(/\n{3,}/g, "\n\n").slice(0, 2800);
  return word && answerMarkdown.length >= 20 ? { word, answerMarkdown } : null;
}

function normalizeWord(value, maxMeanings, expectedInputLanguage = "") {
  if (!value || typeof value !== "object") return null;
  const english = englishKey(value.english);
  const meanings = [...new Set(
    String(value.vietnamese || "")
      .split(/\s*(?:;|\||\n)\s*/)
      .map(clean)
      .filter(Boolean)
      .slice(0, Math.max(1, Number(maxMeanings) || MAX_MEANINGS)),
  )];
  const ipaText = clean(value.ipa).replace(/^\/+|\/+$/g, "");
  const pronunciationVi = clean(value.pronunciationVi || value.pronunciation_vi).slice(0, 100);
  if (meanings.some((meaning) => sameLooseText(meaning, pronunciationVi))) return null;
  const word = {
    inputLanguage: expectedInputLanguage || (value.inputLanguage === "vi" ? "vi" : "en"),
    english,
    partOfSpeech: clean(value.partOfSpeech || value.part_of_speech).toLowerCase().slice(0, 50),
    vietnamese: meanings.join("; "),
    ipa: ipaText ? `/${ipaText}/` : "",
    pronunciationVi,
    example: sentence(value.example),
    exampleVietnamese: sentence(value.exampleVietnamese || value.example_vietnamese),
  };
  return Object.values(word).every(Boolean) ? word : null;
}

function inputLanguageFor(value) {
  return englishKey(value) ? "en" : "vi";
}

function englishKey(value) {
  const text = clean(value).toLowerCase();
  const token = "[a-z]+(?:['-][a-z]+)*";
  return text.length <= 80 && new RegExp(`^${token}(?:\\s+${token}){0,4}$`).test(text) ? text : "";
}

function sameLooseText(left, right) {
  const normalize = (value) => clean(value).toLocaleLowerCase("vi").replace(/[.,;:!?()\[\]{}'"`-]+/g, " ").replace(/\s+/g, " ");
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && a === b);
}

function savedAnswer(word) {
  const meanings = word.vietnamese.split(/\s*;\s*/).map((item) => `**${item}**`).join("; ");
  return `**${word.english}** ${word.ipa ? `${word.ipa} ` : ""}→ ${meanings}\n\nVí dụ: **${word.example}**\n${word.exampleVietnamese}`;
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