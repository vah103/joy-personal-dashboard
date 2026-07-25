const SESSION_COOKIE = "__Host-joy_session";
const TASK_DELETE_PATH = "/api/tasks/delete";

const CREATE_TASK_DELETIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS task_deletions (
    user_email TEXT NOT NULL,
    task_id TEXT NOT NULL,
    deleted_at INTEGER NOT NULL,
    PRIMARY KEY (user_email, task_id)
  )
`;

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

    await env.DB.prepare(CREATE_TASK_DELETIONS_TABLE).run();

    const now = Date.now();
    const results = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO task_deletions (user_email, task_id, deleted_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_email, task_id) DO UPDATE SET
          deleted_at = excluded.deleted_at
      `).bind(session.user_email, id, now),
      env.DB.prepare(`
        DELETE FROM tasks
        WHERE id = ? AND user_email = ?
      `).bind(id, session.user_email),
    ]);

    return json({
      ok: true,
      id,
      removed: Number(results[1]?.meta?.changes || 0) > 0,
    });
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
