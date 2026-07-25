import { normalizeTaskInput } from "./todos.js";

const SESSION_COOKIE = "__Host-joy_session";
const TASK_IMPORT_PATH = "/api/tasks/import";

const CREATE_TASK_DELETIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS task_deletions (
    user_email TEXT NOT NULL,
    task_id TEXT NOT NULL,
    deleted_at INTEGER NOT NULL,
    PRIMARY KEY (user_email, task_id)
  )
`;

export function isTaskImportRoute(pathname) {
  return pathname === TASK_IMPORT_PATH;
}

export async function handleTaskImportRequest(request, env) {
  try {
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }

    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

    const body = await readJson(request);
    const input = Array.isArray(body.tasks) ? body.tasks.slice(0, 500) : [];
    const valid = input.map(normalizeTaskInput).filter((item) => item.ok);

    if (!valid.length) {
      return json({ ok: true, imported: 0, skippedDeleted: 0 });
    }

    await env.DB.prepare(CREATE_TASK_DELETIONS_TABLE).run();

    const statements = valid.map(({ task }) => env.DB.prepare(`
      INSERT INTO tasks (
        id, user_email, title, due_at, priority, done, created_at, updated_at
      )
      SELECT ?, ?, ?, NULL, 'Medium', ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM task_deletions
        WHERE user_email = ? AND task_id = ?
      )
      ON CONFLICT(id) DO NOTHING
    `).bind(
      task.id,
      session.user_email,
      task.title,
      task.done ? 1 : 0,
      task.createdAt,
      task.updatedAt,
      session.user_email,
      task.id,
    ));

    const results = await env.DB.batch(statements);
    const imported = results.reduce(
      (total, result) => total + Number(result.meta?.changes || 0),
      0,
    );

    return json({
      ok: true,
      imported,
      skippedDeleted: valid.length - imported,
    });
  } catch (error) {
    console.error("Joy task import failed", error);
    return json({ error: "TASK_IMPORT_FAILED" }, 500);
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
