import { buildPushPayload } from "@block65/webcrypto-web-push";

const SESSION_COOKIE = "__Host-joy_session";
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_TASK_ID_LENGTH = 100;

export function isReminderDeliveryRoute(pathname) {
  return pathname === "/api/push/test"
    || pathname === "/api/reminder-delivery/pending"
    || pathname === "/api/reminder-delivery/ack";
}

export async function handleReminderDeliveryRequest(request, env) {
  try {
    const pathname = new URL(request.url).pathname;
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "GET" && !isSameOrigin(request)) {
      return json({ error: "INVALID_ORIGIN" }, 403);
    }

    if (pathname === "/api/push/test" && request.method === "POST") {
      return sendWakeTest(request, session.user_email, env);
    }
    if (pathname === "/api/reminder-delivery/pending" && request.method === "GET") {
      return listPendingNotifications(session.user_email, env);
    }
    if (pathname === "/api/reminder-delivery/ack" && request.method === "POST") {
      return acknowledgeNotification(request, session.user_email, env);
    }
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  } catch (error) {
    console.error("Joy reminder delivery route failed", error);
    return json({ error: String(error?.message || "REMINDER_DELIVERY_FAILED") }, 500);
  }
}

export async function runReminderDeliverySchedule(env) {
  if (!hasPushConfig(env)) return;
  const now = Date.now();
  try {
    const rows = await env.DB.prepare(`
      SELECT DISTINCT user_email FROM (
        SELECT r.user_email AS user_email
        FROM task_reminders r
        JOIN tasks t ON t.id = r.task_id AND t.user_email = r.user_email
        WHERE r.notification_enabled = 1
          AND r.status = 'scheduled'
          AND t.done = 0
          AND COALESCE(r.snoozed_until, r.due_at) <= ?
        UNION
        SELECT f.user_email AS user_email
        FROM focus_reminders f
        WHERE f.enabled = 1
          AND f.next_at IS NOT NULL
          AND f.next_at <= ?
      )
    `).bind(now, now).all();

    await Promise.allSettled(rows.results.map(({ user_email: email }) => (
      sendWakeToUser(email, env, {
        ttl: 10 * 60,
        urgency: "high",
        topic: "hey-joy-pending",
      })
    )));
  } catch (error) {
    console.error("Joy payloadless reminder schedule failed", error);
  }
}

async function sendWakeTest(request, email, env) {
  const body = await readJson(request);
  const endpoint = String(body.endpoint || "").trim();
  const rows = await (endpoint
    ? env.DB.prepare(`
        SELECT endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE user_email = ? AND endpoint = ?
      `).bind(email, endpoint)
    : env.DB.prepare(`
        SELECT endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE user_email = ?
      `).bind(email)).all();

  if (!rows.results.length) return json({ error: "NO_PUSH_SUBSCRIPTION" }, 404);
  const result = await sendPayloadlessRows(rows.results, env, {
    ttl: 60,
    urgency: "high",
    topic: `hey-joy-test-${String(Date.now()).slice(-8)}`,
  });
  if (!result.sent) {
    return json({ error: "TEST_PUSH_NOT_DELIVERED", failed: result.failed }, 502);
  }
  return json({ ok: true, sent: result.sent, mode: "payloadless-wake" });
}

async function listPendingNotifications(email, env) {
  const now = Date.now();
  const taskRows = await env.DB.prepare(`
    SELECT r.task_id, r.due_at, r.repeat_type, r.repeat_days,
           r.snoozed_until, t.title
    FROM task_reminders r
    JOIN tasks t ON t.id = r.task_id AND t.user_email = r.user_email
    WHERE r.user_email = ?
      AND r.notification_enabled = 1
      AND r.status = 'scheduled'
      AND t.done = 0
      AND COALESCE(r.snoozed_until, r.due_at) <= ?
    ORDER BY COALESCE(r.snoozed_until, r.due_at) ASC
    LIMIT 20
  `).bind(email, now).all();

  const focus = await env.DB.prepare(`
    SELECT message, next_at
    FROM focus_reminders
    WHERE user_email = ?
      AND enabled = 1
      AND next_at IS NOT NULL
      AND next_at <= ?
  `).bind(email, now).first();

  return json({
    ok: true,
    notifications: [
      ...taskRows.results.map((row) => ({
        kind: "task-reminder",
        taskId: String(row.task_id),
        title: "Task reminder",
        body: String(row.title || "You have a task to do."),
        tag: `hey-joy-task-${row.task_id}`,
        url: `/?task=${encodeURIComponent(row.task_id)}#to-do`,
      })),
      ...(focus ? [{
        kind: "focus-reminder",
        title: "Focus reminder",
        body: String(focus.message || "Stay focused"),
        tag: "hey-joy-focus",
        url: "/#to-do",
      }] : []),
    ],
  });
}

async function acknowledgeNotification(request, email, env) {
  const body = await readJson(request);
  const kind = String(body.kind || "").trim();
  const now = Date.now();

  if (kind === "focus-reminder") {
    const row = await env.DB.prepare(`
      SELECT start_time, end_time, min_minutes, max_minutes
      FROM focus_reminders
      WHERE user_email = ? AND enabled = 1
    `).bind(email).first();
    if (!row) return json({ ok: true, ignored: true });
    const nextAt = computeNextFocusAt(now, {
      startTime: row.start_time,
      endTime: row.end_time,
      minMinutes: Number(row.min_minutes),
      maxMinutes: Number(row.max_minutes),
    });
    await env.DB.prepare(`
      UPDATE focus_reminders
      SET next_at = ?, updated_at = ?
      WHERE user_email = ?
    `).bind(nextAt, now, email).run();
    return json({ ok: true, kind, nextAt });
  }

  if (kind !== "task-reminder") return json({ error: "INVALID_NOTIFICATION_KIND" }, 400);
  const taskId = normalizeTaskId(body.taskId);
  if (!taskId) return json({ error: "INVALID_TASK_ID" }, 400);

  const row = await env.DB.prepare(`
    SELECT due_at, repeat_type, repeat_days, status
    FROM task_reminders
    WHERE user_email = ? AND task_id = ?
  `).bind(email, taskId).first();
  if (!row || String(row.status) !== "scheduled") {
    return json({ ok: true, ignored: true, taskId });
  }

  const repeatType = normalizeRepeatType(row.repeat_type);
  if (repeatType === "once") {
    await env.DB.prepare(`
      UPDATE task_reminders
      SET status = 'notified', snoozed_until = NULL,
          last_notified_at = ?, updated_at = ?
      WHERE user_email = ? AND task_id = ?
    `).bind(now, now, email, taskId).run();
    return json({ ok: true, kind, taskId, status: "notified" });
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
  `).bind(nextDueAt, now, now, email, taskId).run();
  return json({ ok: true, kind, taskId, nextDueAt });
}

async function sendWakeToUser(email, env, options) {
  const rows = await env.DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_email = ?
  `).bind(email).all();
  if (!rows.results.length) return false;
  const result = await sendPayloadlessRows(rows.results, env, options);
  return result.sent > 0;
}

async function sendPayloadlessRows(rows, env, options = {}) {
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const deadEndpoints = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(rows.map(async (row) => {
    try {
      const subscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      const signed = await buildPushPayload({
        data: "wake",
        options: {
          ttl: Number(options.ttl || 300),
          urgency: options.urgency || "high",
          ...(options.topic ? { topic: options.topic } : {}),
        },
      }, subscription, vapid);
      const headers = new Headers(signed.headers || {});
      headers.delete("Content-Encoding");
      headers.delete("Content-Type");
      headers.delete("Content-Length");
      headers.delete("Encryption");
      const requestInit = { ...signed, headers, body: undefined };
      const response = await fetch(row.endpoint, requestInit);
      if (response.ok) {
        sent += 1;
      } else {
        failed += 1;
        if (response.status === 404 || response.status === 410) {
          deadEndpoints.push(row.endpoint);
        } else {
          const details = await response.text().catch(() => "");
          console.error("Joy payloadless wake failed", response.status, details.slice(0, 300));
        }
      }
    } catch (error) {
      failed += 1;
      console.error("Joy payloadless wake signing failed", error);
    }
  }));

  if (deadEndpoints.length) {
    await env.DB.batch(deadEndpoints.map((endpoint) => (
      env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint)
    )));
  }
  return { sent, failed };
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
