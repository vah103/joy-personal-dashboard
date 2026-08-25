import { isSameOrigin, json, readJson } from "./shared/http.js";
import { readCookies, sha256Hex } from "./shared/session.js";
import {
  createOpenAiResponse,
  hasOpenAi,
  readLanguageCache,
  writeLanguageCache,
} from "./shared/openai-responses.js";

const VOCABULARY_PATH = "/api/vocabulary";
const VOCABULARY_LOOKUP_PATH = "/api/vocabulary/lookup";
const VOCABULARY_REVIEW_PATH = "/api/vocabulary/review";
const SESSION_COOKIE = "__Host-joy_session";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const VOCABULARY_CACHE_VERSION = "v2";
const VOCABULARY_CACHE_TTL_SECONDS = 365 * 24 * 60 * 60;

const VOCABULARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    inputLanguage: { type: "string", enum: ["en", "vi"] },
    english: { type: "string" },
    partOfSpeech: { type: "string" },
    vietnamese: { type: "string" },
    ipa: { type: "string" },
    pronunciationVi: { type: "string" },
    example: { type: "string" },
    exampleVietnamese: { type: "string" },
  },
  required: [
    "inputLanguage",
    "english",
    "partOfSpeech",
    "vietnamese",
    "ipa",
    "pronunciationVi",
    "example",
    "exampleVietnamese",
  ],
};

export function isVocabularyRoute(pathname) {
  return [VOCABULARY_PATH, VOCABULARY_LOOKUP_PATH, VOCABULARY_REVIEW_PATH].includes(pathname);
}

export async function handleVocabularyRequest(request, env) {
  try {
    const pathname = new URL(request.url).pathname;
    const email = await sessionEmail(request, env);
    if (!email) return json({ error: "UNAUTHENTICATED" }, 401);

    if (request.method !== "GET" && !isSameOrigin(request)) {
      return json({ error: "INVALID_ORIGIN" }, 403);
    }

    if (pathname === VOCABULARY_LOOKUP_PATH && request.method === "POST") {
      return lookupVocabularyWord(request, email, env);
    }

    if (!env?.DB) return json({ error: "VOCABULARY_STORAGE_UNAVAILABLE" }, 503);
    await ensureVocabularySchema(env);

    if (pathname === VOCABULARY_PATH && request.method === "GET") {
      return listVocabularyWords(email, env);
    }
    if (pathname === VOCABULARY_PATH && request.method === "POST") {
      return saveVocabularyWord(request, email, env);
    }
    if (pathname === VOCABULARY_REVIEW_PATH && request.method === "POST") {
      return reviewVocabularyWord(request, email, env);
    }

    return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: allowedMethods(pathname) });
  } catch (error) {
    console.error("Joy vocabulary request failed", error);
    return json({ error: "VOCABULARY_REQUEST_FAILED" }, 500);
  }
}

async function ensureVocabularySchema() {
  // vocabulary_words is provisioned by migrations/20260731_canonical_runtime_schema.sql.
}

async function listVocabularyWords(email, env) {
  const rows = await env.DB.prepare(`
    SELECT id, english, vietnamese, ipa, pronunciation_vi, example,
      review_count, correct_count, created_at, updated_at
    FROM vocabulary_words
    WHERE user_email = ?
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 500
  `).bind(email).all();

  return json({ words: (rows.results || []).map(mapWord) });
}

async function saveVocabularyWord(request, email, env) {
  const body = await readJson(request);
  if (body.operation === "delete") {
    return deleteVocabularyWord(body, email, env);
  }

  const word = normalizeVocabularyResult(body, { maxMeanings: 2, allowManual: true });
  if (!word) return json({ error: "VOCABULARY_RESULT_INVALID" }, 400);

  if (body.operation === "update") {
    return updateVocabularyWord(body, word, email, env);
  }

  const existing = await env.DB.prepare(`
    SELECT id, english, vietnamese, ipa, pronunciation_vi, example,
      review_count, correct_count, created_at, updated_at
    FROM vocabulary_words
    WHERE user_email = ? AND english_key = ?
  `).bind(email, word.english).first();

  if (existing) return json({ word: mapWord(existing), created: false });

  const now = Date.now();
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO vocabulary_words (
      user_email, id, english_key, english, vietnamese, ipa,
      pronunciation_vi, example, review_count, correct_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).bind(
    email,
    id,
    word.english,
    word.english,
    word.vietnamese,
    word.ipa,
    word.pronunciationVi,
    serializeExample(word),
    now,
    now,
  ).run();

  return json({
    word: {
      id,
      ...word,
      reviewCount: 0,
      correctCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    created: true,
  }, 201);
}

async function deleteVocabularyWord(body, email, env) {
  const id = cleanText(body.id);
  if (!id || id.length > 100) return json({ error: "VOCABULARY_WORD_NOT_FOUND" }, 404);

  const result = await env.DB.prepare(`
    DELETE FROM vocabulary_words
    WHERE user_email = ? AND id = ?
  `).bind(email, id).run();

  if (!Number(result.meta?.changes || 0)) return json({ error: "VOCABULARY_WORD_NOT_FOUND" }, 404);
  return json({ deleted: true, id });
}

async function updateVocabularyWord(body, word, email, env) {
  const id = cleanText(body.id);
  if (!id || id.length > 100) return json({ error: "VOCABULARY_WORD_NOT_FOUND" }, 404);

  const conflict = await env.DB.prepare(`
    SELECT id
    FROM vocabulary_words
    WHERE user_email = ? AND english_key = ? AND id <> ?
    LIMIT 1
  `).bind(email, word.english, id).first();
  if (conflict) return json({ error: "VOCABULARY_WORD_EXISTS" }, 409);

  const now = Date.now();
  const result = await env.DB.prepare(`
    UPDATE vocabulary_words
    SET english_key = ?,
        english = ?,
        vietnamese = ?,
        ipa = ?,
        pronunciation_vi = ?,
        example = ?,
        updated_at = ?
    WHERE user_email = ? AND id = ?
  `).bind(
    word.english,
    word.english,
    word.vietnamese,
    word.ipa,
    word.pronunciationVi,
    serializeExample(word),
    now,
    email,
    id,
  ).run();

  if (!Number(result.meta?.changes || 0)) return json({ error: "VOCABULARY_WORD_NOT_FOUND" }, 404);

  const updated = await env.DB.prepare(`
    SELECT id, english, vietnamese, ipa, pronunciation_vi, example,
      review_count, correct_count, created_at, updated_at
    FROM vocabulary_words
    WHERE user_email = ? AND id = ?
  `).bind(email, id).first();

  if (!updated) return json({ error: "VOCABULARY_WORD_NOT_FOUND" }, 404);
  return json({ word: mapWord(updated), created: false, updated: true });
}

async function lookupVocabularyWord(request, email, env) {
  const body = await readJson(request);
  const query = cleanText(body.query);
  const context = cleanText(body.context);
  if (!query || query.length > 80 || /[\r\n]/.test(String(body.query || ""))) {
    return json({ error: "INVALID_VOCABULARY_INPUT" }, 400);
  }
  if (context.length > 240 || /[\r\n]/.test(String(body.context || ""))) {
    return json({ error: "INVALID_VOCABULARY_CONTEXT" }, 400);
  }

  const saved = await findSavedVocabularyResult(email, query, context, env);
  if (saved) {
    return json({ word: saved, cached: true, provider: "saved", model: "d1" });
  }

  const maxMeanings = context ? 1 : 2;
  const cacheInput = `${VOCABULARY_CACHE_VERSION}\n${query.toLocaleLowerCase("vi")}\n${context.toLocaleLowerCase("vi")}`;
  const cached = await readLanguageCache({
    feature: "vocabulary",
    userEmail: email,
    input: cacheInput,
  });
  const cachedWord = normalizeVocabularyResult(cached?.word, { maxMeanings });
  if (cachedWord) {
    return json({
      word: cachedWord,
      cached: true,
      provider: "openai",
      model: cleanText(cached.model) || DEFAULT_OPENAI_MODEL,
    });
  }

  const instructions = vocabularyInstructions(Boolean(context));
  const input = context
    ? `Entry: ${query}\nContext: ${context}`
    : `Entry: ${query}`;

  if (hasOpenAi(env)) {
    try {
      const result = await createOpenAiResponse(env, {
        model: env.OPENAI_VOCABULARY_MODEL || DEFAULT_OPENAI_MODEL,
        instructions,
        input,
        maxOutputTokens: 220,
        schema: VOCABULARY_JSON_SCHEMA,
        schemaName: "joy_vocabulary_entry",
        reasoningEffort: "minimal",
        verbosity: "low",
      });
      const word = normalizeVocabularyResult(result.data, { maxMeanings });
      if (!word) throw Object.assign(new Error("OPENAI_VOCABULARY_RESULT_INVALID"), {
        code: "OPENAI_VOCABULARY_RESULT_INVALID",
      });

      await writeLanguageCache({
        feature: "vocabulary",
        userEmail: email,
        input: cacheInput,
        value: { word, model: result.model },
        ttlSeconds: VOCABULARY_CACHE_TTL_SECONDS,
      }).catch(() => false);

      return json({
        word,
        cached: false,
        provider: "openai",
        model: result.model,
        usage: result.usage,
      });
    } catch (error) {
      console.warn("Joy OpenAI vocabulary lookup failed; using Workers AI fallback", error?.code || error?.message);
    }
  }

  if (env?.AI?.run) {
    try {
      const fallback = await env.AI.run(
        env.VOCABULARY_AI_MODEL || DEFAULT_WORKERS_AI_MODEL,
        {
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: input },
          ],
          response_format: {
            type: "json_schema",
            json_schema: VOCABULARY_JSON_SCHEMA,
          },
          temperature: 0,
          max_tokens: 260,
        },
      );
      const word = normalizeVocabularyResult(extractAiObject(fallback), { maxMeanings });
      if (!word) return json({ error: "VOCABULARY_RESULT_INVALID" }, 502);
      return json({
        word,
        cached: false,
        provider: "workers-ai",
        model: env.VOCABULARY_AI_MODEL || DEFAULT_WORKERS_AI_MODEL,
      });
    } catch (error) {
      console.error("Joy vocabulary fallback lookup failed", error);
      return json({ error: "VOCABULARY_AI_FAILED" }, 502);
    }
  }

  return json({ error: "VOCABULARY_AI_UNAVAILABLE" }, 503);
}

function vocabularyInstructions(hasContext) {
  return `You are a concise English-Vietnamese dictionary for one learner.
Return only the requested JSON object.

Rules:
- Accept one English or Vietnamese word or short phrase.
- english: lowercase dictionary headword or natural short phrase, maximum five words.
- partOfSpeech: one concise label such as noun, verb, adjective, phrasal verb, or phrase.
- vietnamese: ${hasContext ? "exactly one meaning that fits the supplied context" : "one or two most useful meanings, separated only by a semicolon"}.
- ipa: standard IPA for the English entry, wrapped in forward slashes.
- pronunciationVi: one short Vietnamese-style pronunciation guide.
- example: exactly one natural English sentence using the entry.
- exampleVietnamese: an accurate Vietnamese translation of that example.
- Preserve names and intended meaning. Do not add explanations, synonyms, markdown, or extra fields.`;
}

async function findSavedVocabularyResult(email, query, context, env) {
  if (context || !env?.DB) return null;
  const englishKey = normalizeEnglishEntry(query);
  if (!englishKey) return null;

  const row = await env.DB.prepare(`
    SELECT id, english, vietnamese, ipa, pronunciation_vi, example,
      review_count, correct_count, created_at, updated_at
    FROM vocabulary_words
    WHERE user_email = ? AND english_key = ?
  `).bind(email, englishKey).first();
  return row ? mapWord(row) : null;
}

async function reviewVocabularyWord(request, email, env) {
  const body = await readJson(request);
  const id = cleanText(body.id);
  if (!id || id.length > 100 || typeof body.correct !== "boolean") {
    return json({ error: "INVALID_VOCABULARY_REVIEW" }, 400);
  }

  const result = await env.DB.prepare(`
    UPDATE vocabulary_words
    SET review_count = review_count + 1,
        correct_count = correct_count + ?
    WHERE user_email = ? AND id = ?
  `).bind(body.correct ? 1 : 0, email, id).run();

  if (!Number(result.meta?.changes || 0)) return json({ error: "VOCABULARY_WORD_NOT_FOUND" }, 404);
  return json({ reviewed: true });
}

function normalizeVocabularyResult(value, { maxMeanings = 2, allowManual = false } = {}) {
  if (!value || typeof value !== "object") return null;
  const english = normalizeEnglishEntry(value.english);
  if (!english) return null;

  const meanings = normalizeMeanings(value.vietnamese, maxMeanings);
  const vietnamese = meanings.join("; ");
  const ipaText = cleanText(value.ipa).slice(0, 100);
  const ipa = ipaText ? `/${ipaText.replace(/^\/+|\/+$/g, "")}/` : "";
  const pronunciationVi = cleanText(value.pronunciationVi || value.pronunciation_vi).slice(0, 100);
  const partOfSpeech = cleanText(value.partOfSpeech || value.part_of_speech).toLowerCase().slice(0, 50);
  const example = oneSentence(value.example).slice(0, 260);
  const exampleVietnameseText = cleanText(value.exampleVietnamese || value.example_vietnamese);
  const exampleVietnamese = exampleVietnameseText ? oneSentence(exampleVietnameseText).slice(0, 260) : "";
  if (!vietnamese || !ipa || !pronunciationVi || !example) return null;
  if (!allowManual && (!partOfSpeech || !exampleVietnamese)) return null;

  return {
    inputLanguage: value.inputLanguage === "vi" ? "vi" : "en",
    english,
    partOfSpeech,
    vietnamese,
    ipa,
    pronunciationVi,
    example,
    exampleVietnamese,
  };
}

function normalizeEnglishEntry(value) {
  const english = cleanText(value).toLowerCase();
  if (!english || english.length > 80) return "";
  const token = "[a-z]+(?:['-][a-z]+)*";
  return new RegExp(`^${token}(?:\\s+${token}){0,4}$`).test(english) ? english : "";
}

function normalizeMeanings(value, maxMeanings) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/\s*(?:;|\||\n)\s*/);
  const unique = [];
  for (const item of raw) {
    const meaning = cleanText(item)
      .replace(/^\d+[.)]\s*/, "")
      .replace(/^[-*•]+\s*/, "")
      .slice(0, 120);
    if (!meaning || unique.some((existing) => existing.toLocaleLowerCase("vi") === meaning.toLocaleLowerCase("vi"))) {
      continue;
    }
    unique.push(meaning);
    if (unique.length >= Math.max(1, Number(maxMeanings || 1))) break;
  }
  return unique;
}

function serializeExample(word) {
  return word.exampleVietnamese
    ? `${word.example} — ${word.exampleVietnamese}`
    : word.example;
}

function parseStoredExample(value) {
  const text = cleanText(value);
  const separator = text.indexOf(" — ");
  if (separator < 0) return { example: text, exampleVietnamese: "" };
  return {
    example: text.slice(0, separator).trim(),
    exampleVietnamese: text.slice(separator + 3).trim(),
  };
}

function oneSentence(value) {
  const text = cleanText(value).replace(/^["'`]+|["'`]+$/g, "");
  if (!text) return "";
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  const sentence = (match?.[0] || text).trim();
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function extractAiObject(result) {
  const raw = result?.response ?? result?.result ?? result?.text ?? result;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (raw.english && raw.vietnamese) return raw;
    const nested = raw.response ?? raw.result ?? raw.text;
    if (nested && typeof nested === "object") return nested;
  }

  const text = String(raw || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function mapWord(row) {
  const storedExample = parseStoredExample(row.example);
  return {
    id: String(row.id || ""),
    inputLanguage: "en",
    english: String(row.english || ""),
    partOfSpeech: "",
    vietnamese: String(row.vietnamese || ""),
    ipa: String(row.ipa || ""),
    pronunciationVi: String(row.pronunciation_vi || ""),
    example: storedExample.example,
    exampleVietnamese: storedExample.exampleVietnamese,
    reviewCount: Number(row.review_count || 0),
    correctCount: Number(row.correct_count || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
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

function allowedMethods(pathname) {
  if (pathname === VOCABULARY_PATH) return "GET, POST";
  return "POST";
}