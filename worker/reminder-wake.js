import { buildPushPayload } from "@block65/webcrypto-web-push";

const SESSION_COOKIE = "__Host-joy_session";

export function isReminderWakeRoute(pathname) {
  return pathname === "/api/push/test";
}

export async function handleReminderWakeRequest(request, env) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

    const body = await readJson(request);
    const endpoint = String(body.endpoint || "").trim();
    const rows = await (endpoint
      ? env.DB.prepare(`
          SELECT endpoint, p256dh, auth
          FROM push_subscriptions
          WHERE user_email = ? AND endpoint = ?
        `).bind(session.user_email, endpoint)
      : env.DB.prepare(`
          SELECT endpoint, p256dh, auth
          FROM push_subscriptions
          WHERE user_email = ?
        `).bind(session.user_email)).all();

    if (!rows.results.length) return json({ error: "NO_PUSH_SUBSCRIPTION" }, 404);

    const result = await sendEncryptedWakeRows(rows.results, env, {
      ttl: 60,
      urgency: "high",
      topic: `hey-joy-test-${String(Date.now()).slice(-8)}`,
    });

    if (!result.sent) {
      return json({
        error: "TEST_PUSH_NOT_DELIVERED",
        failed: result.failed,
        deliveryErrors: result.errors,
      }, 502);
    }

    return json({ ok: true, sent: result.sent, mode: "encrypted-wake" });
  } catch (error) {
    console.error("Joy encrypted wake test failed", error);
    return json({ error: String(error?.message || "WAKE_TEST_FAILED") }, 500);
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

    await Promise.allSettled(rows.results.map(async ({ user_email: email }) => {
      const subscriptions = await env.DB.prepare(`
        SELECT endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE user_email = ?
      `).bind(email).all();
      if (!subscriptions.results.length) return;

      const result = await sendEncryptedWakeRows(subscriptions.results, env, {
        ttl: 10 * 60,
        urgency: "high",
        topic: "hey-joy-pending",
      });
      if (!result.sent) {
        console.warn("Joy reminder wake was not accepted", email, result.errors);
      }
    }));
  } catch (error) {
    console.error("Joy encrypted reminder schedule failed", error);
  }
}

async function sendEncryptedWakeRows(rows, env, options = {}) {
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const deadEndpoints = [];
  const errors = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(rows.map(async (row) => {
    try {
      const subscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      const requestInit = await buildPushPayload({
        data: "wake",
        options: {
          ttl: Number(options.ttl || 300),
          urgency: options.urgency || "high",
          ...(options.topic ? { topic: options.topic } : {}),
        },
      }, subscription, vapid);

      const response = await fetch(row.endpoint, requestInit);
      if (response.ok) {
        sent += 1;
        return;
      }

      failed += 1;
      const raw = await response.text().catch(() => "");
      let reason = raw.slice(0, 300);
      try {
        reason = String(JSON.parse(raw)?.reason || reason);
      } catch {
        // Keep the raw push-service response.
      }
      errors.push({ status: response.status, reason: reason || "UNKNOWN_PUSH_ERROR" });

      if (response.status === 404 || response.status === 410) {
        deadEndpoints.push(row.endpoint);
      }
      console.error("Joy encrypted wake rejected", response.status, reason);
    } catch (error) {
      failed += 1;
      const reason = String(error?.message || "WAKE_ENCRYPTION_FAILED");
      errors.push({ status: 0, reason });
      console.error("Joy encrypted wake failed", error);
    }
  }));

  if (deadEndpoints.length) {
    await env.DB.batch(deadEndpoints.map((endpoint) => (
      env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint)
    )));
  }

  return { sent, failed, errors };
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
