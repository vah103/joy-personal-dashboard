const SESSION_COOKIE = "__Host-joy_session";
const TASK_ENGLISH_PATH = "/api/tasks/english";
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export function isTaskEnglishRoute(pathname) {
  return pathname === TASK_ENGLISH_PATH;
}

export async function handleTaskEnglishRequest(request, env) {
  try {
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }

    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

    const body = await readJson(request);
    const original = cleanTaskText(body.text);
    if (!original || original.length > 500) {
      return json({ error: "INVALID_TASK_TEXT" }, 400);
    }

    if (!env?.AI?.run) {
      return json({ title: original, changed: false, ai: false });
    }

    const schema = {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 500 },
      },
      required: ["title"],
    };

    const messages = [
      {
        role: "system",
        content: `You edit one item for a personal English to-do list.

Convert Vietnamese or imperfect English into one natural, grammatically correct English sentence. Use a concise imperative structure that begins with a clear action verb whenever the input is an action. Use sentence case and end with suitable punctuation.

Preserve the user's exact meaning, names, project names, acronyms, URLs, dates, times, quantities, and technical terms. Do not add details, explanations, advice, or a second task. Do not use filler such as "I need to", "Please", or "Remember to" unless the original explicitly asks for a reminder. If the original asks to be reminded, retain a natural "Remind me to ..." structure so reminder detection still works.

Keep the result short and suitable for display as one to-do item. Return only the requested JSON field.`,
      },
      {
        role: "user",
        content: original,
      },
    ];

    const result = await env.AI.run(env.TASK_ENGLISH_AI_MODEL || DEFAULT_AI_MODEL, {
      messages,
      temperature: 0.05,
      max_tokens: 160,
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    });

    const payload = typeof result?.response === "string"
      ? JSON.parse(result.response)
      : result?.response;
    const title = normalizeEnglishTitle(payload?.title, original);

    return json({
      title,
      changed: title !== original,
      ai: true,
    });
  } catch (error) {
    console.error("Joy task English rewrite failed", error);
    return json({ error: "TASK_ENGLISH_FAILED" }, 500);
  }
}

function normalizeEnglishTitle(value, fallback) {
  const title = cleanTaskText(value)
    .replace(/^[-*•]+\s*/, "")
    .replace(/^(["'`])([\s\S]*)\1$/, "$2")
    .trim();
  return title && title.length <= 500 ? title : fallback;
}

function cleanTaskText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getSession(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return env.DB.prepare(`
    SELECT user_email, expires_at
    FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).bind(tokenHash, Date.now()).first();
}

function readCookies(request) {
  return Object.fromEntries(
    (request.headers.get("Cookie") || "")
      .split(";")
      .map((part) => {
        const [name, ...rest] = part.trim().split("=");
        return [name, rest.join("=")];
      })
      .filter(([name]) => name),
  );
}

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
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
