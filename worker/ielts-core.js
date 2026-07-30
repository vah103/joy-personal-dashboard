import { buildPushPayload } from "@block65/webcrypto-web-push";

const SESSION_COOKIE = "__Host-joy_session";
const MAX_STATE_BYTES = 700_000;
const PROGRAM_START = "2026-08-01";
const PROGRAM_END = "2026-12-31";
const COMPLETE_STATUSES = new Set(["completed"]);

export function isIeltsCoreRoute(pathname) {
  return pathname === "/api/ielts-core";
}

export async function handleIeltsCoreRequest(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return json({ error: "INVALID_ORIGIN" }, 403);
  }

  if (request.method === "GET") {
    return getState(session.user_email, env);
  }

  if (request.method === "PUT") {
    return putState(request, session.user_email, env);
  }

  return json({ error: "METHOD_NOT_ALLOWED" }, 405);
}

export async function runIeltsSchedule(env) {
  const clock = vietnamClock(new Date());
  if (clock.dateKey < PROGRAM_START || clock.dateKey > PROGRAM_END) return;
  const notification = scheduledNotification(clock);
  if (!notification) return;

  await ensureTables(env);
  const users = await env.DB.prepare(`
    SELECT user_email, data_json
    FROM ielts_core_states
  `).all();

  await Promise.allSettled((users.results || []).map(async (row) => {
    const alreadySent = await env.DB.prepare(`
      SELECT 1
      FROM ielts_notification_state
      WHERE user_email = ? AND date_key = ? AND notification_kind = ?
    `).bind(row.user_email, clock.dateKey, notification.kind).first();
    if (alreadySent) return;

    const data = safeJsonParse(row.data_json, {});
    if (notification.kind === "ielts-evening" && data.settings?.eveningReminder === false) return;
    if (notification.kind === "ielts-weekly" && data.settings?.weeklyReviewReminder === false) return;
    const payload = enrichNotification(notification, data, clock);
    const result = await sendPushToUser(row.user_email, {
      title: payload.title,
      body: payload.body,
      icon: "/joy-blue-icon.png?v=joy-topographic-blue-v1",
      badge: "/joy-blue-icon.png?v=joy-topographic-blue-v1",
      tag: `hey-joy-${payload.kind}`,
      renotify: payload.kind === "ielts-evening",
      data: {
        url: "/?ielts=1",
        kind: payload.kind,
        dateKey: clock.dateKey,
      },
    }, env, {
      ttl: payload.kind === "ielts-morning" ? 8 * 60 * 60 : 4 * 60 * 60,
      topic: `hey-joy-${payload.kind}`,
      urgency: payload.kind === "ielts-evening" ? "high" : "normal",
    });

    if (!result.sent) return;
    await env.DB.prepare(`
      INSERT INTO ielts_notification_state (
        user_email, date_key, notification_kind, sent_at
      ) VALUES (?, ?, ?, ?)
    `).bind(row.user_email, clock.dateKey, notification.kind, Date.now()).run();
  }));
}

async function getState(email, env) {
  await ensureTables(env);
  let row = await env.DB.prepare(`
    SELECT data_json, version, updated_at
    FROM ielts_core_states
    WHERE user_email = ?
  `).bind(email).first();

  if (!row) {
    const now = Date.now();
    const initial = JSON.stringify({
      schemaVersion: 2,
      goal: {
        overall: 7,
        minimumSkill: 6.5,
        date: "2026-12-31"
      },
      taskStates: {},
      customTasks: [],
      courseSessions: [],
      assessments: [],
      errorLogs: [],
      rhythmReviews: {},
      settings: {
        eveningReminder: true,
        weeklyReviewReminder: true
      }
    });
    await env.DB.prepare(`
      INSERT INTO ielts_core_states (
        user_email, data_json, version, updated_at
      ) VALUES (?, ?, 0, ?)
    `).bind(email, initial, now).run();
    row = { data_json: initial, version: 0, updated_at: now };
  }

  return json({
    planId: "ielts-band-7-december-2026",
    data: safeJsonParse(row.data_json, {}),
    version: Number(row.version || 0),
    updatedAt: Number(row.updated_at || 0),
  });
}

async function putState(request, email, env) {
  const body = await readJson(request);
  const data = body && typeof body.data === "object" && !Array.isArray(body.data)
    ? normalizeState(body.data)
    : null;
  const baseVersion = Number(body.baseVersion || 0);
  if (!data) return json({ error: "INVALID_IELTS_STATE" }, 400);

  const serialized = JSON.stringify(data);
  if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) {
    return json({ error: "IELTS_STATE_TOO_LARGE" }, 413);
  }

  await ensureTables(env);
  const current = await env.DB.prepare(`
    SELECT data_json, version, updated_at
    FROM ielts_core_states
    WHERE user_email = ?
  `).bind(email).first();

  const currentVersion = Number(current?.version || 0);
  if (current && baseVersion !== currentVersion) {
    return json({
      error: "IELTS_STATE_VERSION_CONFLICT",
      data: safeJsonParse(current.data_json, {}),
      version: currentVersion,
      updatedAt: Number(current.updated_at || 0),
    }, 409);
  }

  const nextVersion = currentVersion + 1;
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO ielts_core_states (
      user_email, data_json, version, updated_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      data_json = excluded.data_json,
      version = excluded.version,
      updated_at = excluded.updated_at
  `).bind(email, serialized, nextVersion, now).run();

  return json({
    ok: true,
    planId: "ielts-band-7-december-2026",
    data,
    version: nextVersion,
    updatedAt: now,
  });
}

function normalizeState(value) {
  const cleanArray = (input, limit) => Array.isArray(input) ? input.slice(-limit) : [];
  return {
    schemaVersion: 2,
    goal: {
      overall: Number(value.goal?.overall || 7),
      minimumSkill: Number(value.goal?.minimumSkill || 6.5),
      date: String(value.goal?.date || "2026-12-31"),
    },
    taskStates: plainObject(value.taskStates),
    customTasks: cleanArray(value.customTasks, 200),
    courseSessions: cleanArray(value.courseSessions, 100),
    assessments: cleanArray(value.assessments, 50),
    errorLogs: cleanArray(value.errorLogs, 500),
    rhythmReviews: plainObject(value.rhythmReviews),
    settings: {
      eveningReminder: value.settings?.eveningReminder !== false,
      weeklyReviewReminder: value.settings?.weeklyReviewReminder !== false,
    },
  };
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function scheduledNotification(clock) {
  const inEveningWindow = clock.hour === 19 && clock.minute < 5;
  const inWeeklyWindow = clock.weekday === 0 && clock.hour === 20 && clock.minute >= 30 && clock.minute < 35;

  if (inWeeklyWindow) {
    return { kind: "ielts-weekly", title: "IELTS weekly review", body: "" };
  }
  if (inEveningWindow) {
    return { kind: "ielts-evening", title: "IELTS current rhythm", body: "" };
  }
  return null;
}

function enrichNotification(notification, data, clock) {
  if (notification.kind === "ielts-weekly") {
    const summary = stateSummary(data, clock.dateKey);
    return {
      ...notification,
      body: `${summary.completed} IELTS tasks recorded this week. Review the evidence in Joy before ChatGPT prepares the next rhythm.`,
    };
  }

  const todaySummary = stateSummary(data, clock.dateKey, true);
  if (todaySummary.completed > 0 && todaySummary.open === 0) {
    return {
      ...notification,
      body: "Today’s recorded IELTS work is complete. Open Joy if you need to add evidence or class notes.",
    };
  }
  return {
    ...notification,
    body: "Open Joy to see the current IELTS rhythm and the next guided task.",
  };
}

function stateSummary(data, date, todayOnly = false) {
  const states = Object.entries(plainObject(data?.taskStates));
  const weekStart = mondayFor(date);
  const weekEnd = addDays(weekStart, 6);
  let completed = 0;
  let open = 0;
  let overdue = 0;

  states.forEach(([taskId, state]) => {
    const taskDate = taskId.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDate)) return;
    if (todayOnly && taskDate !== date) return;
    if (!todayOnly && (taskDate < weekStart || taskDate > weekEnd)) return;
    if (COMPLETE_STATUSES.has(state?.status)) completed += 1;
    else {
      open += 1;
      if (taskDate < date) overdue += 1;
    }
  });

  return { completed, open, overdue };
}

async function sendPushToUser(email, payload, env, options = {}) {
  if (!hasPushConfig(env)) return { sent: 0, failed: 0 };
  const rows = await env.DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_email = ?
  `).bind(email).all();
  if (!rows.results?.length) return { sent: 0, failed: 0 };

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  let sent = 0;
  let failed = 0;
  const deadEndpoints = [];

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
          urgency: options.urgency || "normal",
          ...(options.topic ? { topic: options.topic } : {}),
        },
      }, subscription, vapid);
      const response = await fetch(row.endpoint, requestInit);
      if (response.ok) {
        sent += 1;
        return;
      }
      failed += 1;
      if (response.status === 404 || response.status === 410) deadEndpoints.push(row.endpoint);
    } catch (error) {
      failed += 1;
      console.error("Joy IELTS push delivery failed", error);
    }
  }));

  if (deadEndpoints.length) {
    await env.DB.batch(deadEndpoints.map((endpoint) => (
      env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint)
    )));
  }
  return { sent, failed };
}

function hasPushConfig(env) {
  return Boolean(
    env?.VAPID_SUBJECT
    && env?.VAPID_PUBLIC_KEY
    && env?.VAPID_PRIVATE_KEY
  );
}

async function ensureTables(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ielts_core_states (
        user_email TEXT PRIMARY KEY,
        data_json TEXT NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ielts_notification_state (
        user_email TEXT NOT NULL,
        date_key TEXT NOT NULL,
        notification_kind TEXT NOT NULL,
        sent_at INTEGER NOT NULL,
        PRIMARY KEY (user_email, date_key, notification_kind)
      )
    `),
  ]);
}

async function getSession(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return env.DB.prepare(
    "SELECT user_email, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?",
  ).bind(tokenHash, Date.now()).first();
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function vietnamClock(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday],
  };
}

function dayDifference(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86_400_000);
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayFor(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
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
