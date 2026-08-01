const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_TIMEOUT_MS = 12_000;
const CACHE_ORIGIN = "https://language-cache.hey-joy.internal";

export function hasOpenAi(env) {
  return Boolean(String(env?.OPENAI_API_KEY || "").trim());
}

export async function createOpenAiResponse(env, {
  model,
  instructions,
  input,
  maxOutputTokens,
  schema = null,
  schemaName = "joy_response",
  reasoningEffort = "",
  verbosity = "",
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const apiKey = String(env?.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw openAiError("OPENAI_NOT_CONFIGURED", 503);

  const selectedModel = String(model || "").trim();
  if (!selectedModel) throw openAiError("OPENAI_MODEL_NOT_CONFIGURED", 500);

  const text = {};
  if (verbosity) text.verbosity = verbosity;
  if (schema) {
    text.format = {
      type: "json_schema",
      name: schemaName,
      strict: true,
      schema,
    };
  }

  const body = {
    model: selectedModel,
    store: false,
    instructions: String(instructions || ""),
    input: String(input || ""),
    max_output_tokens: Math.max(16, Number(maxOutputTokens || 128)),
  };
  if (Object.keys(text).length) body.text = text;
  if (reasoningEffort) body.reasoning = { effort: reasoningEffort };

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const projectId = String(env?.OPENAI_PROJECT_ID || "").trim();
  const organizationId = String(env?.OPENAI_ORGANIZATION_ID || "").trim();
  if (projectId) headers["OpenAI-Project"] = projectId;
  if (organizationId) headers["OpenAI-Organization"] = organizationId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, Number(timeoutMs || DEFAULT_TIMEOUT_MS)));

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = cleanErrorCode(payload?.error?.code || payload?.error?.type || `OPENAI_HTTP_${response.status}`);
      const error = openAiError(code, response.status);
      error.detail = String(payload?.error?.message || "").slice(0, 300);
      throw error;
    }

    const outputText = extractOpenAiText(payload);
    if (!outputText) throw openAiError("OPENAI_EMPTY_RESPONSE", 502);

    let data = null;
    if (schema) {
      try {
        data = JSON.parse(outputText);
      } catch {
        throw openAiError("OPENAI_INVALID_STRUCTURED_RESPONSE", 502);
      }
    }

    return {
      text: outputText,
      data,
      model: String(payload?.model || selectedModel),
      usage: normalizeUsage(payload?.usage),
    };
  } catch (error) {
    if (error?.name === "AbortError") throw openAiError("OPENAI_TIMEOUT", 504);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function readLanguageCache({ feature, userEmail, input }) {
  const cache = globalThis.caches?.default;
  if (!cache) return null;
  const request = await languageCacheRequest(feature, userEmail, input);
  const response = await cache.match(request);
  if (!response) return null;
  const payload = await response.json().catch(() => null);
  return payload && typeof payload === "object" ? payload : null;
}

export async function writeLanguageCache({ feature, userEmail, input, value, ttlSeconds }) {
  const cache = globalThis.caches?.default;
  if (!cache || !value || typeof value !== "object") return false;
  const request = await languageCacheRequest(feature, userEmail, input);
  const ttl = Math.max(60, Math.floor(Number(ttlSeconds || 3600)));
  const response = new Response(JSON.stringify(value), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttl}`,
    },
  });
  await cache.put(request, response);
  return true;
}

async function languageCacheRequest(feature, userEmail, input) {
  const safeFeature = String(feature || "language").toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40);
  const digest = await sha256(`${String(userEmail || "").toLowerCase()}\n${String(input || "")}`);
  return new Request(`${CACHE_ORIGIN}/${safeFeature}/${digest}`, { method: "GET" });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function extractOpenAiText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
      if (typeof content?.text === "string" && content.text.trim()) return content.text.trim();
    }
  }
  return "";
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  return {
    inputTokens: Number(usage.input_tokens || 0),
    outputTokens: Number(usage.output_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0),
  };
}

function cleanErrorCode(value) {
  return String(value || "OPENAI_REQUEST_FAILED").toUpperCase().replace(/[^A-Z0-9_]+/g, "_").slice(0, 80);
}

function openAiError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}
