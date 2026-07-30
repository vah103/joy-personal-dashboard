import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

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

    const now = Date.now();
    const results = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO task_deletions (user_email, task_id, deleted_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_email, task_id) DO UPDATE SET
          deleted_at = excluded.deleted_at
      `).bind(session.user_email, id, now),
      env.DB.prepare(`
        DELETE FROM task_reminders
        WHERE task_id = ? AND user_email = ?
      `).bind(id, session.user_email),
      env.DB.prepare(`
        DELETE FROM tasks
        WHERE id = ? AND user_email = ?
      `).bind(id, session.user_email),
    ]);

    return json({
      ok: true,
      id,
      removed: Number(results[2]?.meta?.changes || 0) > 0,
    });
  } catch (error) {
    console.error("Joy task deletion failed", error);
    return json({ error: "TASK_DELETE_FAILED" }, 500);
  }
}
