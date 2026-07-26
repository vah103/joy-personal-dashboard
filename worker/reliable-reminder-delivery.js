import { buildPushPayload } from "@block65/webcrypto-web-push";

const SESSION_COOKIE = "__Host-joy_session";
const RETRY_AFTER_MS = 2 * 60 * 1000;
const MAX_LATE_MS = 24 * 60 * 60 * 1000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_TASK_ID_LENGTH = 100;

export function isReliableReminderRoute(pathname) {
  return pathname === "/api/task-reminders/delivery-ack";
}

export async function handleReliableReminderRequest(request, env) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

    const body = await readJson(request);
    const kind = String(body.kind || "").trim();
    const attemptAt = Number(body.deliveryAttemptAt);
    if (!Number.isFinite(attemptAt) || attemptAt <= 0) {
      return json({ error: "INVALID_DELIVERY_ATTEMPT" }, 400);
    }

    if (kind === "task-reminder") {
      return acknowledgeTaskDelivery(session.user_email, body, attemptAt, env);
    }
    if (kind === "focus-reminder") {
      return acknowledgeFocusDelivery(session.user_email, attemptAt, env);
    }
    return json({ error: "INVALID_NOTIFICATION_KIND" }, 400);
  } catch (error) {
    console.error("Joy reminder acknowledgement failed", error);
    return json({ error: String(error?.message || "REMINDER_ACK_FAILED") }, 500);
  }
}

export async function runReliableReminderSchedule(env) {
  if (!hasPushConfig(env)) return;
  await Promise.allSettled([
    processTaskDeliveries(env),
    processFocusDeliveries(env),
  ]);
}

async function processTaskDeliveries(env) {
  const now = Date.now();
  const rows = await env.DB.prepare(`
    SELECT r.user_email, r.task_id, r.due_at, r.repeat_type,
           r.repeat_days, r.snoozed_until, r.last_notified_at,
           t.title
    FROM task_reminders r
    JOIN tasks t ON t.id = r.task_id AND t.user_email = r.user_email
    WHERE r.notification_enabled = 1
      AND r.status = 'scheduled'
      AND t.done = 0
      AND COALESCE(r.snoozed_until, r.due_at) <= ?
      AND COALESCE(r.snoozed_until, r.due_at) >= ?
      AND (r.last_notified_at IS NULL OR r.last_notified_at <= ?)
    ORDER BY COALESCE(r.snoozed_until, r.due_at) ASC
    LIMIT 50
  `).bind(now, now - MAX_LATE_MS, now - RETRY_AFTER_MS).all();

  for (const row of rows.results) {
    const attemptAt = Date.now();
    const claim = await env.DB.prepare(`
      UPDATE task_reminders
      SET last_notified_at = ?, updated_at = ?
      WHERE user_email = ? AND task_id = ?
        AND status = 'scheduled'
        AND notification_enabled = 1
        AND (last_notified_at IS NULL OR last_notified_at <= ?)
    `).bind(
      attemptAt,
      attemptAt,
      row.user_email,
      row.task_id,
      attemptAt - RETRY_AFTER_MS,
    ).run();
    if (!Number(claim.meta?.changes || 0)) continue;

    const accepted = await sendPushToUser(row.user_email, {
      title: "Task reminder",
      body: String(row.title || "You have a task to do."),
      icon: "/app-icon-192.png",
      badge: "/app-icon-64.png",
      tag: `hey-joy-task-${row.task_id}`,
      renotify: true,
      actions: [
        { action: "complete", title: "Complete" },
        { action: "snooze10", title: "10 min" },
        { action: "snooze60", title: "1 hour" },
      ],
      data: {
        url: `/?task=${encodeURIComponent(row.task_id)}#to-do`,
        kind: "task-reminder",
        taskId: String(row.task_id),
        deliveryAttemptAt: attemptAt,
      },
    }, env, {
      ttl: 6 * 60 * 60,
      topic: `joy-task-${String(row.task_id).slice(-20)}`,
      urgency: "high",
    });

    if (accepted) continue;
    await env.DB.prepare(`
      UPDATE task_reminders
      SET last_notified_at = NULL, updated_at = ?
      WHERE user_email = ? AND task_id = ?
        AND status = 'scheduled' AND last_notified_at = ?
    `).bind(Date.now(), row.user_email, row.task_id, attemptAt).run();
  }
}

async function processFocusDeliveries(env) {
  const now = Date.now();
  const rows = await env.DB.prepare(`
    SELECT user_email, message, next_at, updated_at
    FROM focus_reminders
    WHERE enabled = 1
      AND next_at IS NOT NULL
      AND next_at <= ?
      AND updated_at <= ?
    LIMIT 30
  `).bind(now, now - RETRY_AFTER_MS).all();

  for (const row of rows.results) {
    const attemptAt = Date.now();
    const claim = await env.DB.prepare(`
      UPDATE focus_reminders
      SET updated_at = ?
      WHERE user_email = ? AND enabled = 1
        AND next_at IS NOT NULL AND next_at <= ?
        AND updated_at <= ?
    `).bind(
      attemptAt,
      row.user_email,
      attemptAt,
      attemptAt - RETRY_AFTER_MS,
    ).run();
    if (!Number(claim.meta?.changes || 0)) continue;

    const accepted = await sendPushToUser(row.user_email, {
      title: "Focus reminder",
      body: String(row.message || "Stay focused"),
      icon: "/app-icon-192.png",
      badge: "/app-icon-64.png",
      tag: "hey-joy-focus",
      data: {
        url: "/#to-do",
        kind: "focus-reminder",
        deliveryAttemptAt: attemptAt,
      },
    }, env, {
      ttl: 60 * 60,
      topic: "hey-joy-focus",
      urgency: "normal",
    });

    if (accepted) continue;
    await env.DB.prepare(`
      UPDATE focus_reminders
      SET updated_at = ?
      WHERE user_email = ? AND enabled = 1 AND updated_at = ?
    `).bind(attemptAt - RETRY_AFTER_MS, row.user_email, attemptAt).run();
  }
}

async function acknowledgeTaskDelivery(email, body, attemptAt, env) {
  const taskId = normalizeTaskId(body.taskId);
  if (!taskId) return json({ error: "INVALID_TASK_ID" }, 400);

  const row = await env.DB.prepare(`
    SELECT due_at, repeat_type, repeat_days, last_notified_at, status
    FROM task_reminders
    WHERE user_email = ? AND task_id = ?
  `).bind(email, taskId).first();

  if (
    !row
    || String(row.status) !== "scheduled"
    || Number(row.last_notified_at) !== attemptAt
  ) {
    return json({ ok: true, ignored: true, taskId });
  }

  const now = Date.now();
  const repeatType = normalizeRepeatType(row.repeat_type);
  if (repeatType === "once") {
    await env.DB.prepare(`
      UPDATE task_reminders
      SET status = 'notified', snoozed_until = NULL,
          last_notified_at = ?, updated_at = ?
      WHERE user_email = ? AND task_id = ?
        AND status = 'scheduled' AND last_notified_at = ?
    `).bind(now, now, email, taskId, attemptAt).run();
    return json({ ok: true, kind: "task-reminder", taskId, status: "notified" });
  }

  const nextDueAt = computeNextDue(
    Number(row.due_at),
    repeatType,
    parseRepeatDays(row.repeat_days),
    now,
  );
  await env.DB.prepare(`
    UPDATE task_reminders
    SET due_at = ?, snoozed_until = NULL, status = 'scheduled',
        last_notified_at = ?, updated_at = ?
    WHERE user_email = ? AND task_id = ?
      AND status = 'scheduled' AND last_notified_at = ?
  `).bind(nextDueAt, now, now, email, taskId, attemptAt).run();
  return json({ ok: true, kind: "task-reminder", taskId, nextDueAt });
}

async function acknowledgeFocusDelivery(email, attemptAt, env) {
  const row = await env.DB.prepare(`
    SELECT start_time, end_time, min_minutes, max_minutes, updated_at
    FROM focus_reminders
    WHERE user_email = ? AND enabled = 1
  `).bind(email).first();

  if (!row || Number(row.updated_at) !== attemptAt) {
    return json({ ok: true, ignored: true, kind: "focus-reminder" });
  }

  const now = Date.now();
  const nextAt = computeNextFocusAt(now, {
    startTime: row.start_time,
    endTime: row.end_time,
    minMinutes: Number(row.min_minutes),
    maxMinutes: Number(row.max_minutes),
  });
  await env.DB.prepare(`
    UPDATE focus_reminders
    SET next_at = ?, updated_at = ?
    WHERE user_email = ? AND enabled = 1 AND updated_at = ?
  `).bind(nextAt, now, email, attemptAt).run();
  return json({ ok: true, kind: "focus-reminder", nextAt });
}

async function sendPushToUser(email, payload, env, options = {}) {
  const rows = await env.DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_email = ?
  `).bind(email).all();
  if (!rows.results.length) return false;

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const deadEndpoints = [];
  let accepted = 0;

  await Promise.all(rows.results.map(async (row) => {
    try {
      const subscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      const requestInit = await buildPushPayload({
        data: JSON.stringify(payload),
        options: {
          ttl: Number(options.ttl || 300),
          urgency: options.urgency || "high",
          ...(options.topic ? { topic: options.topic } : {}),
        },
      }, subscription, vapid);
      const response = await fetch(row.endpoint, requestInit);
      if (response.ok) accepted += 1;
      else if (response.status === 404 || response.status === 410) deadEndpoints.push(row.endpoint);
      else {
        const details = await response.text().catch(() => "");
        console.error("Joy reliable reminder push failed", response.status, details.slice(0, 300));
      }
    } catch (error) {
      console.error("Joy reliable reminder encryption failed", error);
    }
  }));

  if (deadEndpoints.length) {
    await env.DB.batch(deadEndpoints.map((endpoint) => (
      env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint)
    )));
  }
  return accepted > 0;
}

function computeNextDue(dueAt, repeatType, repeatDays, now) {
  if (repeatType === "daily") {
    let next = Number(dueAt);
    do next += 24 * 60 * 60 * 1000;
    while (next <= now);
    return next;
  }

  const local = vietnamParts(dueAt);
  const days = repeatDays.length ? repeatDays : [isoWeekday(dueAt)];
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = new Date(Date.UTC(local.year, local.month - 1, local.day + offset));
    const candidateDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    if (!days.includes(candidateDay)) continue;
    const candidate = vietnamTimestamp(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      local.hour,
      local.minute,
    );
    if (candidate > now) return candidate;
  }
  return Number(dueAt) + 7 * 24 * 60 * 60 * 1000;
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

function isoWeekday(timestamp) {
  const day = new Date(Number(timestamp) + VIETNAM_OFFSET_MS).getUTCDay();
  return day === 0 ? 7 : day;
}

function normalizeRepeatType(value) {
  const repeat = String(value || "once").trim().toLowerCase();
  return ["daily", "weekly"].includes(repeat) ? repeat : "once";
}

function parseRepeatDays(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed)
      ? [...new Set(parsed.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))]
      : [];
  } catch {
    return [];
  }
}

function normalizeClock(value) {
  const match = String(value || "").trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return "08:00";
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function normalizeTaskId(value) {
  const taskId = String(value || "").trim();
  return taskId && taskId.length <= MAX_TASK_ID_LENGTH ? taskId : "";
}

function hasPushConfig(env) {
  return Boolean(env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
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
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [name, rest.join("=")];
  }).filter(([name]) => name));
}

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
