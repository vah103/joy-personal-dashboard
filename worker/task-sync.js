import { normalizeTaskInput } from "./todos.js";
import { isSameOrigin, json, readJson } from "./shared/http.js";
import { CREATE_TASK_DELETIONS_TABLE } from "./shared/schema.js";
import { getSession } from "./shared/session.js";

const TASK_IMPORT_PATH = "/api/tasks/import";

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
