import { isSameOrigin, json, readJson } from "./shared/http.js";
import { ensureReminderTables } from "./shared/schema.js";
import { getSession } from "./shared/session.js";

const MAX_TASK_ID_LENGTH = 100;
const MAX_TITLE_LENGTH = 500;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export function isTaskReminderRoute(pathname) {
  return pathname === "/api/task-reminders"
    || pathname === "/api/task-reminders/action"
    || pathname === "/api/focus-reminder";
}

export async function handleTaskReminderRequest(request, env) {
  try {
    const pathname = new URL(request.url).pathname;
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "GET" && !isSameOrigin(request)) {
      return json({ error: "INVALID_ORIGIN" }, 403);
    }

    await ensureReminderTables(env);

    if (pathname === "/api/task-reminders") {
      if (request.method === "GET") return listTaskReminders(session.user_email, env);
      if (request.method === "POST") return saveTaskReminder(request, session.user_email, env);
      if (request.method === "PATCH") return updateTaskReminder(request, session.user_email, env);
      if (request.method === "DELETE") return removeTaskReminder(request, session.user_email, env);
      return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    }

    if (pathname === "/api/task-reminders/action" && request.method === "POST") {
      return performReminderAction(request, session.user_email, env);
    }

    if (pathname === "/api/focus-reminder") {
      if (request.method === "GET") return getFocusReminder(session.user_email, env);
      if (request.method === "PUT") return saveFocusReminder(request, session.user_email, env);
      if (request.method === "DELETE") return disableFocusReminder(session.user_email, env);
      return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    }

    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    console.error("Joy task reminder route failed", error);
    return json({ error: String(error?.message || "TASK_REMINDER_FAILED") }, 500);
  }
}

async function listTaskReminders(email, env) {
  const rows = await env.DB.prepare(`
    SELECT
      r.task_id,
      r.due_at,
      r.repeat_type,
      r.repeat_days,
      r.notification_enabled,
      r.snoozed_until,
      r.last_notified_at,
      r.status,
      r.created_at,
      r.updated_at,
      t.title,
      t.done
    FROM task_reminders r
    JOIN tasks t ON t.id = r.task_id AND t.user_email = r.user_email
    WHERE r.user_email = ?
    ORDER BY COALESCE(r.snoozed_until, r.due_at) ASC
  `).bind(email).all();

  return json({
    ok: true,
    reminders: rows.results.map(reminderRowToApi),
  });
}

async function saveTaskReminder(request, email, env) {
  const parsed = normalizeReminderInput(await readJson(request));
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const task = await env.DB.prepare(
    "SELECT title, done FROM tasks WHERE id = ? AND user_email = ?",
  ).bind(parsed.value.taskId, email).first();
  if (!task) return json({ error: "TASK_NOT_FOUND" }, 404);

  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO task_reminders (
      user_email, task_id, due_at, repeat_type, repeat_days,
      notification_enabled, snoozed_until, last_notified_at,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'scheduled', ?, ?)
    ON CONFLICT(user_email, task_id) DO UPDATE SET
      due_at = excluded.due_at,
      repeat_type = excluded.repeat_type,
      repeat_days = excluded.repeat_days,
      notification_enabled = excluded.notification_enabled,
      snoozed_until = NULL,
      status = 'scheduled',
      updated_at = excluded.updated_at
  `).bind(
    email,
    parsed.value.taskId,
    parsed.value.dueAt,
    parsed.value.repeatType,
    JSON.stringify(parsed.value.repeatDays),
    parsed.value.notificationEnabled ? 1 : 0,
    now,
    now,
  ).run();

  const saved = await getReminderRow(email, parsed.value.taskId, env);
  return json({ ok: true, reminder: reminderRowToApi(saved) });
}

async function updateTaskReminder(request, email, env) {
  const body = await readJson(request);
  const taskId = normalizeTaskId(body.taskId);
  if (!taskId) return json({ error: "INVALID_TASK_ID" }, 400);

  const current = await getReminderRow(email, taskId, env);
  if (!current) return json({ error: "REMINDER_NOT_FOUND" }, 404);

  const title = body.title === undefined ? String(current.title || "") : String(body.title || "").trim();
  if (!title || title.length > MAX_TITLE_LENGTH) return json({ error: "INVALID_TASK_TITLE" }, 400);

  const dueAt = body.dueAt === undefined ? Number(current.due_at) : parseTimestamp(body.dueAt);
  if (!Number.isFinite(dueAt)) return json({ error: "INVALID_DUE_AT" }, 400);

  const repeatType = body.repeatType === undefined
    ? normalizeRepeatType(current.repeat_type)
    : normalizeRepeatType(body.repeatType);
  const repeatDays = body.repeatDays === undefined
    ? parseRepeatDays(current.repeat_days)
    : normalizeRepeatDays(body.repeatDays);
  const notificationEnabled = body.notificationEnabled === undefined
    ? Boolean(current.notification_enabled)
    : Boolean(body.notificationEnabled);
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE tasks
      SET title = ?, updated_at = ?
      WHERE id = ? AND user_email = ?
    `).bind(title, now, taskId, email),
    env.DB.prepare(`
      UPDATE task_reminders
      SET due_at = ?, repeat_type = ?, repeat_days = ?,
          notification_enabled = ?, snoozed_until = NULL,
          status = 'scheduled', updated_at = ?
      WHERE user_email = ? AND task_id = ?
    `).bind(
      dueAt,
      repeatType,
      JSON.stringify(repeatDays),
      notificationEnabled ? 1 : 0,
      now,
      email,
      taskId,
    ),
  ]);

  const saved = await getReminderRow(email, taskId, env);
  return json({ ok: true, reminder: reminderRowToApi(saved) });
}

async function removeTaskReminder(request, email, env) {
  const body = await readJson(request);
  const taskId = normalizeTaskId(body.taskId);
  if (!taskId) return json({ error: "INVALID_TASK_ID" }, 400);

  const result = await env.DB.prepare(`
    DELETE FROM task_reminders
    WHERE user_email = ? AND task_id = ?
  `).bind(email, taskId).run();

  return json({ ok: true, taskId, removed: Number(result.meta?.changes || 0) > 0 });
}

async function performReminderAction(request, email, env) {
  const body = await readJson(request);
  const taskId = normalizeTaskId(body.taskId);
  const action = String(body.action || "").trim().toLowerCase();
  if (!taskId) return json({ error: "INVALID_TASK_ID" }, 400);

  const row = await getReminderRow(email, taskId, env);
  if (!row) return json({ error: "REMINDER_NOT_FOUND" }, 404);
  const now = Date.now();

  if (action === "complete") {
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE tasks SET done = 1, updated_at = ?
        WHERE id = ? AND user_email = ?
      `).bind(now, taskId, email),
      env.DB.prepare(`
        UPDATE task_reminders
        SET status = 'completed', notification_enabled = 0,
            snoozed_until = NULL, updated_at = ?
        WHERE task_id = ? AND user_email = ?
      `).bind(now, taskId, email),
    ]);
    return json({ ok: true, action, taskId });
  }

  let snoozeMinutes = Number(body.minutes);
  if (action === "snooze10") snoozeMinutes = 10;
  if (action === "snooze60") snoozeMinutes = 60;
  if (action === "tomorrow") snoozeMinutes = 24 * 60;
  if (action === "snooze" || action.startsWith("snooze") || action === "tomorrow") {
    if (!Number.isFinite(snoozeMinutes) || snoozeMinutes < 1 || snoozeMinutes > 30 * 24 * 60) {
      return json({ error: "INVALID_SNOOZE" }, 400);
    }
    const snoozedUntil = now + Math.round(snoozeMinutes) * 60_000;
    await env.DB.prepare(`
      UPDATE task_reminders
      SET snoozed_until = ?, status = 'scheduled', updated_at = ?
      WHERE task_id = ? AND user_email = ?
    `).bind(snoozedUntil, now, taskId, email).run();
    return json({ ok: true, action: "snooze", taskId, snoozedUntil: new Date(snoozedUntil).toISOString() });
  }

  if (action === "disable") {
    await env.DB.prepare(`
      UPDATE task_reminders
      SET notification_enabled = 0, updated_at = ?
      WHERE task_id = ? AND user_email = ?
    `).bind(now, taskId, email).run();
    return json({ ok: true, action, taskId });
  }

  return json({ error: "UNKNOWN_REMINDER_ACTION" }, 400);
}

async function getFocusReminder(email, env) {
  const row = await env.DB.prepare(`
    SELECT enabled, message, start_time, end_time,
           min_minutes, max_minutes, next_at, updated_at
    FROM focus_reminders WHERE user_email = ?
  `).bind(email).first();

  return json({ ok: true, focus: focusRowToApi(row) });
}

async function saveFocusReminder(request, email, env) {
  const body = await readJson(request);
  const current = await env.DB.prepare(`
    SELECT enabled, message, start_time, end_time,
           min_minutes, max_minutes, next_at, updated_at
    FROM focus_reminders WHERE user_email = ?
  `).bind(email).first();

  const enabled = body.enabled === undefined ? Boolean(current?.enabled) : Boolean(body.enabled);
  const message = String(body.message ?? current?.message ?? "Stay focused").trim().slice(0, 200) || "Stay focused";
  const startTime = normalizeClock(body.startTime ?? current?.start_time ?? "08:00");
  const endTime = normalizeClock(body.endTime ?? current?.end_time ?? "23:30");
  if (!startTime || !endTime) return json({ error: "INVALID_FOCUS_TIME" }, 400);

  let minMinutes = Math.round(Number(body.minMinutes ?? current?.min_minutes ?? 60));
  let maxMinutes = Math.round(Number(body.maxMinutes ?? current?.max_minutes ?? 180));
  if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes)) {
    return json({ error: "INVALID_FOCUS_INTERVAL" }, 400);
  }
  minMinutes = Math.max(5, Math.min(24 * 60, minMinutes));
  maxMinutes = Math.max(minMinutes, Math.min(24 * 60, maxMinutes));
  const now = Date.now();
  const nextAt = enabled
    ? computeNextFocusAt(now, { startTime, endTime, minMinutes, maxMinutes })
    : null;

  await env.DB.prepare(`
    INSERT INTO focus_reminders (
      user_email, enabled, message, start_time, end_time,
      min_minutes, max_minutes, next_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      enabled = excluded.enabled,
      message = excluded.message,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      min_minutes = excluded.min_minutes,
      max_minutes = excluded.max_minutes,
      next_at = excluded.next_at,
      updated_at = excluded.updated_at
  `).bind(
    email,
    enabled ? 1 : 0,
    message,
    startTime,
    endTime,
    minMinutes,
    maxMinutes,
    nextAt,
    now,
  ).run();

  const saved = await env.DB.prepare(`
    SELECT enabled, message, start_time, end_time,
           min_minutes, max_minutes, next_at, updated_at
    FROM focus_reminders WHERE user_email = ?
  `).bind(email).first();
  return json({ ok: true, focus: focusRowToApi(saved) });
}

async function disableFocusReminder(email, env) {
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO focus_reminders (user_email, enabled, updated_at)
    VALUES (?, 0, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      enabled = 0, next_at = NULL, updated_at = excluded.updated_at
  `).bind(email, now).run();
  return json({ ok: true, focus: focusRowToApi(null) });
}

function normalizeReminderInput(body) {
  const taskId = normalizeTaskId(body.taskId);
  if (!taskId) return { ok: false, error: "INVALID_TASK_ID" };
  const dueAt = parseTimestamp(body.dueAt);
  if (!Number.isFinite(dueAt)) return { ok: false, error: "INVALID_DUE_AT" };
  return {
    ok: true,
    value: {
      taskId,
      dueAt,
      repeatType: normalizeRepeatType(body.repeatType),
      repeatDays: normalizeRepeatDays(body.repeatDays),
      notificationEnabled: body.notificationEnabled !== false,
    },
  };
}

function normalizeTaskId(value) {
  const taskId = String(value || "").trim();
  return taskId && taskId.length <= MAX_TASK_ID_LENGTH ? taskId : "";
}

function parseTimestamp(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeRepeatType(value) {
  const repeat = String(value || "once").trim().toLowerCase();
  return ["daily", "weekly"].includes(repeat) ? repeat : "once";
}

function normalizeRepeatDays(value) {
  const values = Array.isArray(value) ? value : parseRepeatDays(value);
  return [...new Set(values.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))]
    .sort((a, b) => a - b);
}

function parseRepeatDays(value) {
  if (Array.isArray(value)) return normalizeRepeatDays(value);
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function reminderRowToApi(row) {
  if (!row) return null;
  return {
    taskId: String(row.task_id),
    title: String(row.title || ""),
    done: Boolean(row.done),
    dueAt: new Date(Number(row.due_at)).toISOString(),
    repeatType: normalizeRepeatType(row.repeat_type),
    repeatDays: parseRepeatDays(row.repeat_days),
    notificationEnabled: Boolean(row.notification_enabled),
    snoozedUntil: row.snoozed_until ? new Date(Number(row.snoozed_until)).toISOString() : null,
    lastNotifiedAt: row.last_notified_at ? new Date(Number(row.last_notified_at)).toISOString() : null,
    status: String(row.status || "scheduled"),
    createdAt: new Date(Number(row.created_at || Date.now())).toISOString(),
    updatedAt: new Date(Number(row.updated_at || Date.now())).toISOString(),
  };
}

function focusRowToApi(row) {
  return {
    enabled: Boolean(row?.enabled),
    message: String(row?.message || "Stay focused"),
    startTime: normalizeClock(row?.start_time || "08:00") || "08:00",
    endTime: normalizeClock(row?.end_time || "23:30") || "23:30",
    minMinutes: Math.max(5, Number(row?.min_minutes || 60)),
    maxMinutes: Math.max(5, Number(row?.max_minutes || 180)),
    nextAt: row?.next_at ? new Date(Number(row.next_at)).toISOString() : null,
  };
}

async function getReminderRow(email, taskId, env) {
  return env.DB.prepare(`
    SELECT r.*, t.title, t.done
    FROM task_reminders r
    JOIN tasks t ON t.id = r.task_id AND t.user_email = r.user_email
    WHERE r.user_email = ? AND r.task_id = ?
  `).bind(email, taskId).first();
}

function computeNextFocusAt(now, config) {
  const minMinutes = Math.max(5, Math.round(Number(config.minMinutes || 60)));
  const maxMinutes = Math.max(minMinutes, Math.round(Number(config.maxMinutes || 180)));
  const randomMinutes = minMinutes + Math.floor(Math.random() * (maxMinutes - minMinutes + 1));
  const local = vietnamParts(now);
  const [startHour, startMinute] = normalizeClock(config.startTime || "08:00").split(":").map(Number);
  const [endHour, endMinute] = normalizeClock(config.endTime || "23:30").split(":").map(Number);
  const start = vietnamTimestamp(local.year, local.month, local.day, startHour, startMinute);
  const end = vietnamTimestamp(local.year, local.month, local.day, endHour, endMinute);
  const base = Math.max(now, start);
  const candidate = base + randomMinutes * 60_000;
  if (candidate <= end) return candidate;

  const tomorrow = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return vietnamTimestamp(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    startHour,
    startMinute,
  ) + randomMinutes * 60_000;
}

function vietnamParts(timestamp) {
  const shifted = new Date(Number(timestamp) + VIETNAM_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function vietnamTimestamp(year, month, day, hour, minute) {
  return Date.UTC(year, month - 1, day, hour - 7, minute, 0, 0);
}

function normalizeClock(value) {
  const match = String(value || "").trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return "";
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}
