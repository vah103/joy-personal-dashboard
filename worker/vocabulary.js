const VOCABULARY_PATH = "/api/vocabulary";
const VOCABULARY_LOOKUP_PATH = "/api/vocabulary/lookup";
const VOCABULARY_REVIEW_PATH = "/api/vocabulary/review";
const SESSION_COOKIE = "__Host-joy_session";
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export function isVocabularyRoute(pathname) {
  return [VOCABULARY_PATH, VOCABULARY_LOOKUP_PATH, VOCABULARY_REVIEW_PATH].includes(pathname);
}

export async function handleVocabularyRequest(request, env) {
  try {
    const pathname = new URL(request.url).pathname;
    const email = await sessionEmail(request, env);
    if (!email) return json({ error: "UNAUTHENTICATED" }, 401);
    if (!env?.DB) return json({ error: "VOCABULARY_STORAGE_UNAVAILABLE" }, 503);

    if (request.method !== "GET" && !isSameOrigin(request)) {
      return json({ error: "INVALID_ORIGIN" }, 403);
    }

    if (pathname === VOCABULARY_PATH && request.method === "GET") {
      return listVocabularyWords(email, env);
    }
    if (pathname === VOCABULARY_PATH && request.method === "POST") {
      return saveVocabularyWord(request, email, env);
    }
    if (pathname === VOCABULARY_LOOKUP_PATH && request.method === "POST") {
      return lookupVocabularyWord(request, env);
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
  const word = normalizeVocabularyResult(body);
  if (!word) return json({ error: "VOCABULARY_RESULT_INVALID" }, 400);

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
    word.example,
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

async function lookupVocabularyWord(request, env) {
  const body = await readJson(request);
  const query = cleanText(body.query);
  if (!query || query.length > 80 || /[\r\n]/.test(String(body.query || ""))) {
    return json({ error: "INVALID_VOCABULARY_INPUT" }, 400);
  }
  if (!env?.AI?.run) return json({ error: "VOCABULARY_AI_UNAVAILABLE" }, 503);

  const messages = [
    {
      role: "system",
      content: `You are the bilingual English-Vietnamese dictionary inside a personal vocabulary flashcard app.

Analyze the user's single English or Vietnamese word and return exactly one best dictionary pair. Never return alternatives, synonyms, multiple meanings, slash-separated choices, comma-separated choices, or explanations.

Rules:
- If the input is English, use its lowercase dictionary headword and choose one primary Vietnamese meaning.
- If the input is Vietnamese, choose one single English dictionary word. The English result must be one word only, never a phrase or phrasal verb.
- vietnamese must contain one concise Vietnamese meaning only.
- ipa must be the standard IPA for the English word, wrapped in forward slashes.
- pronunciationVi must be one concise Vietnamese-style reading guide. It is only an approximation.
- example must be exactly one natural English sentence that clearly demonstrates the English word.
- Do not include markdown or any text outside the JSON object.

Return this exact JSON shape:
{"inputLanguage":"en|vi","english":"one English word","vietnamese":"one Vietnamese meaning","ipa":"/IPA/","pronunciationVi":"Vietnamese reading","example":"One English sentence."}`,
    },
    { role: "user", content: query },
  ];

  const result = await env.AI.run(env.VOCABULARY_AI_MODEL || DEFAULT_AI_MODEL, {
    messages,
    temperature: 0,
    max_tokens: 240,
  });
  const word = normalizeVocabularyResult(extractAiObject(result));
  if (!word) return json({ error: "VOCABULARY_RESULT_INVALID" }, 502);
  return json({ word });
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

function normalizeVocabularyResult(value) {
  if (!value || typeof value !== "object") return null;
  const english = cleanText(value.english).toLowerCase();
  if (!/^[a-z]+(?:['-][a-z]+)*$/.test(english)) return null;

  const vietnamese = oneMeaning(value.vietnamese);
  const ipaText = cleanText(value.ipa).slice(0, 100);
  const ipa = ipaText ? `/${ipaText.replace(/^\/+|\/+$/g, "")}/` : "";
  const pronunciationVi = oneMeaning(value.pronunciationVi || value.pronunciation_vi).slice(0, 100);
  const example = oneSentence(value.example).slice(0, 260);
  if (!vietnamese || !ipa || !pronunciationVi || !example) return null;

  return { english, vietnamese, ipa, pronunciationVi, example };
}

function oneMeaning(value) {
  return cleanText(value)
    .split(/\s*(?:[;,|]|\s\/\s|\bhoặc\b|\bor\b)\s*/i)[0]
    .trim()
    .slice(0, 120);
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
  return {
    id: String(row.id || ""),
    english: String(row.english || ""),
    vietnamese: String(row.vietnamese || ""),
    ipa: String(row.ipa || ""),
    pronunciationVi: String(row.pronunciation_vi || ""),
    example: String(row.example || ""),
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

function readCookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => {
    const index = part.indexOf("=");
    if (index === -1) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function cleanText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function allowedMethods(pathname) {
  if (pathname === VOCABULARY_PATH) return "GET, POST";
  return "POST";
}

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}
