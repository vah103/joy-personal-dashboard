import {
  normalizeProjectInput,
  normalizeScratchpadInput,
  projectRowToApi,
  scratchpadRowToApi,
} from "./account-sync.js";
import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";
import { normalizeTaskInput, taskRowToApi } from "./todos.js";

const DASHBOARD_DATA_ROUTES = new Set([
  "/api/projects",
  "/api/projects/import",
  "/api/projects/archive",
  "/api/scratchpad",
  "/api/tasks",
  "/api/tasks/complete",
]);

export function isDashboardDataRoute(pathname) {
  return DASHBOARD_DATA_ROUTES.has(pathname);
}

export async function handleDashboardDataRequest(request, env) {
  const url = new URL(request.url);
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return json({ error: "INVALID_ORIGIN" }, 403);
  }

  const email = session.user_email;
  if (url.pathname === "/api/projects" && request.method === "GET") return listProjects(email, env);
  if (url.pathname === "/api/projects" && request.method === "POST") return addProject(request, email, env);
  if (url.pathname === "/api/projects/import" && request.method === "POST") return importProjects(request, email, env);
  if (url.pathname === "/api/projects/archive" && request.method === "POST") return archiveProject(request, email, env);
  if (url.pathname === "/api/scratchpad" && request.method === "GET") return getScratchpad(email, env);
  if (url.pathname === "/api/scratchpad" && request.method === "PUT") return updateScratchpad(request, email, env);
  if (url.pathname === "/api/tasks" && request.method === "GET") return listTasks(email, env);
  if (url.pathname === "/api/tasks" && request.method === "POST") return addTask(request, email, env);
  if (url.pathname === "/api/tasks/complete" && request.method === "POST") return completeTask(request, email, env);
  return json({ error: "METHOD_NOT_ALLOWED" }, 405);
}

async function listTasks(email, env) {
  const rows = await env.DB.prepare(`
    SELECT id, title, done, created_at, updated_at
    FROM tasks
    WHERE user_email = ?
    ORDER BY created_at DESC
  `).bind(email).all();
  return json({ tasks: rows.results.map(taskRowToApi), fetchedAt: Date.now() });
}

async function addTask(request, email, env) {
  const validation = normalizeTaskInput(await readJson(request));
  if (!validation.ok) return json({ error: validation.error }, 400);
  const { id, title, done, createdAt, updatedAt } = validation.task;
  const existing = await env.DB.prepare(
    "SELECT user_email FROM tasks WHERE id = ?",
  ).bind(id).first();
  if (existing && existing.user_email !== email) return json({ error: "TASK_ID_CONFLICT" }, 409);

  await env.DB.prepare(`
    INSERT INTO tasks (
      id, user_email, title, due_at, priority, done, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, 'Medium', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      done = excluded.done,
      updated_at = MAX(tasks.updated_at, excluded.updated_at)
    WHERE tasks.user_email = excluded.user_email
  `).bind(id, email, title, done ? 1 : 0, createdAt, updatedAt).run();

  const row = await env.DB.prepare(`
    SELECT id, title, done, created_at, updated_at
    FROM tasks WHERE id = ? AND user_email = ?
  `).bind(id, email).first();
  return json({ ok: true, task: taskRowToApi(row) }, 201);
}

async function completeTask(request, email, env) {
  const body = await readJson(request);
  const id = String(body.id || "").trim();
  if (!id || id.length > 100) return json({ error: "INVALID_TASK_ID" }, 400);

  const now = Date.now();
  const result = await env.DB.prepare(`
    UPDATE tasks SET done = 1, updated_at = ?
    WHERE id = ? AND user_email = ?
  `).bind(now, id, email).run();
  if (!Number(result.meta?.changes || 0)) return json({ error: "TASK_NOT_FOUND" }, 404);

  const row = await env.DB.prepare(`
    SELECT id, title, done, created_at, updated_at
    FROM tasks WHERE id = ? AND user_email = ?
  `).bind(id, email).first();
  return json({ ok: true, task: taskRowToApi(row) });
}

async function listProjects(email, env) {
  const rows = await env.DB.prepare(`
    SELECT id, name, focus, next_action, progress, accent, archived, created_at, updated_at
    FROM joy_projects
    WHERE user_email = ? AND archived = 0
    ORDER BY updated_at DESC, created_at DESC
  `).bind(email).all();
  return json({ projects: rows.results.map(projectRowToApi), fetchedAt: Date.now() });
}

async function addProject(request, email, env) {
  const validation = normalizeProjectInput(await readJson(request));
  if (!validation.ok) return json({ error: validation.error }, 400);
  const project = validation.project;

  await env.DB.prepare(`
    INSERT INTO joy_projects (
      user_email, id, name, focus, next_action, progress, accent,
      archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO UPDATE SET
      name = excluded.name,
      focus = excluded.focus,
      next_action = excluded.next_action,
      progress = excluded.progress,
      accent = excluded.accent,
      archived = excluded.archived,
      updated_at = excluded.updated_at
    WHERE excluded.updated_at >= joy_projects.updated_at
  `).bind(
    email,
    project.id,
    project.name,
    project.focus,
    project.next,
    project.progress,
    project.accent,
    project.archived ? 1 : 0,
    project.createdAt,
    project.updatedAt,
  ).run();

  const row = await env.DB.prepare(`
    SELECT id, name, focus, next_action, progress, accent, archived, created_at, updated_at
    FROM joy_projects WHERE user_email = ? AND id = ?
  `).bind(email, project.id).first();
  return json({ ok: true, project: projectRowToApi(row) }, 201);
}

async function importProjects(request, email, env) {
  const body = await readJson(request);
  const input = Array.isArray(body.projects) ? body.projects.slice(0, 200) : [];
  const valid = input.map(normalizeProjectInput).filter((item) => item.ok);
  if (!valid.length) return json({ ok: true, imported: 0 });

  const statements = valid.map(({ project }) => env.DB.prepare(`
    INSERT INTO joy_projects (
      user_email, id, name, focus, next_action, progress, accent,
      archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO NOTHING
  `).bind(
    email,
    project.id,
    project.name,
    project.focus,
    project.next,
    project.progress,
    project.accent,
    project.archived ? 1 : 0,
    project.createdAt,
    project.updatedAt,
  ));
  await env.DB.batch(statements);
  return json({ ok: true, imported: valid.length });
}

async function archiveProject(request, email, env) {
  const body = await readJson(request);
  const id = String(body.id || "").trim();
  if (!id || id.length > 100) return json({ error: "INVALID_PROJECT_ID" }, 400);

  const result = await env.DB.prepare(`
    UPDATE joy_projects SET archived = 1, updated_at = ?
    WHERE user_email = ? AND id = ?
  `).bind(Date.now(), email, id).run();
  if (!Number(result.meta?.changes || 0)) return json({ error: "PROJECT_NOT_FOUND" }, 404);
  return json({ ok: true, id });
}

async function getScratchpad(email, env) {
  const row = await env.DB.prepare(`
    SELECT content, version, updated_at
    FROM scratchpads WHERE user_email = ?
  `).bind(email).first();
  return json({ scratchpad: scratchpadRowToApi(row), fetchedAt: Date.now() });
}

async function updateScratchpad(request, email, env) {
  const validation = normalizeScratchpadInput(await readJson(request));
  if (!validation.ok) return json({ error: validation.error }, 400);
  const { content, baseVersion } = validation.value;
  const current = await env.DB.prepare(`
    SELECT content, version, updated_at
    FROM scratchpads WHERE user_email = ?
  `).bind(email).first();

  if (!current) {
    if (baseVersion !== 0) {
      return json({
        error: "SCRATCHPAD_VERSION_CONFLICT",
        scratchpad: scratchpadRowToApi(null),
      }, 409);
    }
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO scratchpads (user_email, content, version, updated_at)
      VALUES (?, ?, 1, ?)
    `).bind(email, content, now).run();
    return json({
      ok: true,
      scratchpad: { exists: true, content, version: 1, updatedAt: now },
    });
  }

  const currentVersion = Number(current.version || 0);
  if (baseVersion !== currentVersion) {
    return json({
      error: "SCRATCHPAD_VERSION_CONFLICT",
      scratchpad: scratchpadRowToApi(current),
    }, 409);
  }

  const now = Date.now();
  const nextVersion = currentVersion + 1;
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO scratchpad_revisions (user_email, content, version, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(email, String(current.content || ""), currentVersion, now),
    env.DB.prepare(`
      UPDATE scratchpads SET content = ?, version = ?, updated_at = ?
      WHERE user_email = ? AND version = ?
    `).bind(content, nextVersion, now, email, currentVersion),
  ]);

  await env.DB.prepare(`
    DELETE FROM scratchpad_revisions
    WHERE user_email = ?
      AND id NOT IN (
        SELECT id FROM scratchpad_revisions
        WHERE user_email = ?
        ORDER BY created_at DESC
        LIMIT 20
      )
  `).bind(email, email).run();

  return json({
    ok: true,
    scratchpad: { exists: true, content, version: nextVersion, updatedAt: now },
  });
}
