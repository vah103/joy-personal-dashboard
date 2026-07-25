const SESSION_COOKIE = "__Host-joy_session";
const TASK_DELETE_PATH = "/api/tasks/delete";

export function isTaskDeleteRoute(pathname) {
  return pathname === TASK_DELETE_PATH;
}

export async function handleTaskDeleteRequest(request, env) {
  try {
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }

    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

    const body = await readJson(request);
    const id = String(body.id || "").trim();
    if (!id || id.length > 100) {
      return json({ error: "INVALID_TASK_ID" }, 400);
    }

    const result = await env.DB.prepare(`
      DELETE FROM tasks
      WHERE id = ? AND user_email = ?
    `).bind(id, session.user_email).run();

    if (!Number(result.meta?.changes || 0)) {
      return json({ error: "TASK_NOT_FOUND" }, 404);
    }

    return json({ ok: true, id });
  } catch (error) {
    console.error("Joy task deletion failed", error);
    return json({ error: "TASK_DELETE_FAILED" }, 500);
  }
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
