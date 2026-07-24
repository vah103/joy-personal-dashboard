import { buildPushPayload } from "@block65/webcrypto-web-push";

const SESSION_COOKIE = "__Host-joy_session";
const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&hourly=precipitation_probability,precipitation,weather_code&timezone=Asia%2FHo_Chi_Minh&forecast_days=1";
const CHECK_EVERY_MINUTES = 5;
const HIGH_PROBABILITY = 70;
const VERY_HIGH_PROBABILITY = 80;
const SUPPORTING_AMOUNT_MM = 0.3;
const STRONG_AMOUNT_MM = 1;

export function isPushRoute(pathname) {
  return pathname.startsWith("/api/push/");
}

export async function handlePushRequest(request, env) {
  try {
    const pathname = new URL(request.url).pathname;
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "GET" && !isSameOrigin(request)) {
      return json({ error: "INVALID_ORIGIN" }, 403);
    }

    if (pathname === "/api/push/public-key" && request.method === "GET") {
      requirePushConfig(env);
      return json({ publicKey: env.VAPID_PUBLIC_KEY });
    }

    if (pathname === "/api/push/subscribe" && request.method === "POST") {
      return saveSubscription(request, session.user_email, env);
    }

    if (pathname === "/api/push/test" && request.method === "POST") {
      return sendTestNotification(request, session.user_email, env);
    }

    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    console.error("Hey Joy push route failed", error);
    return json({ error: String(error?.message || "PUSH_FAILED") }, 500);
  }
}

export async function runRainPushSchedule(env) {
  if (!hasPushConfig(env)) return;
  if (new Date().getUTCMinutes() % CHECK_EVERY_MINUTES !== 0) return;

  const active = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM push_subscriptions",
  ).first();
  if (!Number(active?.count || 0)) return;

  try {
    const forecast = await fetchRainForecast();
    const summary = summarizeRainForecast(forecast?.hourly, new Date());
    const users = await env.DB.prepare(
      "SELECT DISTINCT user_email FROM push_subscriptions",
    ).all();

    await Promise.allSettled(
      users.results.map(({ user_email: email }) => processRainSummary(email, summary, env)),
    );
  } catch (error) {
    console.error("Hey Joy rain notification check failed", error);
  }
}

async function saveSubscription(request, email, env) {
  requirePushConfig(env);
  const parsed = normalizeSubscription(await readJson(request));
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const now = Date.now();
  const subscription = parsed.value;
  await env.DB.prepare(`
    INSERT INTO push_subscriptions (
      user_email, endpoint, p256dh, auth, expiration_time, user_agent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_email = excluded.user_email,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      expiration_time = excluded.expiration_time,
      user_agent = excluded.user_agent,
      updated_at = excluded.updated_at
  `).bind(
    email,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    subscription.expirationTime,
    String(request.headers.get("User-Agent") || "").slice(0, 500),
    now,
    now,
  ).run();

  return json({ ok: true });
}

async function sendTestNotification(request, email, env) {
  requirePushConfig(env);
  const body = await readJson(request);
  const endpoint = String(body.endpoint || "").trim();
  const query = endpoint
    ? env.DB.prepare(`
        SELECT endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE user_email = ? AND endpoint = ?
      `).bind(email, endpoint)
    : env.DB.prepare(`
        SELECT endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE user_email = ?
      `).bind(email);
  const rows = await query.all();
  if (!rows.results.length) return json({ error: "NO_PUSH_SUBSCRIPTION" }, 404);

  const result = await sendPushRows(rows.results, {
    title: "Hey Joy!",
    body: "Thông báo trên iPhone đã hoạt động. Mình sẽ báo khi khung giờ mưa thay đổi.",
    icon: "/app-icon-192.png",
    badge: "/app-icon-64.png",
    tag: "hey-joy-test",
    data: { url: "/", kind: "test" },
  }, env, { ttl: 60, topic: "hey-joy-test" });

  if (!result.sent) {
    return json({ error: "TEST_PUSH_NOT_DELIVERED", failed: result.failed }, 502);
  }
  return json({ ok: true, sent: result.sent });
}

async function processRainSummary(email, summary, env) {
  const current = await env.DB.prepare(`
    SELECT last_window_key
    FROM rain_notification_state
    WHERE user_email = ?
  `).bind(email).first();
  const previousKey = String(current?.last_window_key || "");

  if (!summary.windowKey) {
    if (previousKey) await saveRainState(email, "", 0, env);
    return;
  }

  if (summary.windowKey === previousKey) return;

  const subscriptions = await env.DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_email = ?
  `).bind(email).all();
  if (!subscriptions.results.length) return;

  const result = await sendPushRows(subscriptions.results, {
    title: "Hey Joy! · Dự báo mưa mới",
    body: `Khả năng mưa mạnh tại Hà Nội: ${summary.windowText}.`,
    icon: "/app-icon-192.png",
    badge: "/app-icon-64.png",
    tag: "hey-joy-rain",
    renotify: true,
    data: { url: "/", kind: "rain", windowKey: summary.windowKey },
  }, env, { ttl: 30 * 60, topic: "hey-joy-rain", urgency: "high" });

  if (result.sent > 0) {
    await saveRainState(email, summary.windowKey, Date.now(), env);
  }
}

async function saveRainState(email, windowKey, notifiedAt, env) {
  await env.DB.prepare(`
    INSERT INTO rain_notification_state (
      user_email, last_window_key, last_notified_at, updated_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      last_window_key = excluded.last_window_key,
      last_notified_at = excluded.last_notified_at,
      updated_at = excluded.updated_at
  `).bind(email, windowKey, notifiedAt, Date.now()).run();
}

async function sendPushRows(rows, payload, env, options = {}) {
  requirePushConfig(env);
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
      const requestInit = await buildPushPayload({
        data: JSON.stringify(payload),
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
      if (response.status === 404 || response.status === 410) {
        deadEndpoints.push(row.endpoint);
      } else {
        const details = await response.text().catch(() => "");
        console.error("Hey Joy push delivery failed", response.status, details.slice(0, 300));
      }
    } catch (error) {
      failed += 1;
      console.error("Hey Joy push encryption failed", error);
    }
  }));

  if (deadEndpoints.length) {
    await env.DB.batch(deadEndpoints.map((endpoint) => (
      env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint)
    )));
  }

  return { sent, failed };
}

async function fetchRainForecast() {
  const response = await fetch(WEATHER_ENDPOINT, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
  return response.json();
}

function summarizeRainForecast(hourly, now) {
  const times = Array.isArray(hourly?.time) ? hourly.time : [];
  const probabilities = Array.isArray(hourly?.precipitation_probability)
    ? hourly.precipitation_probability
    : [];
  const precipitation = Array.isArray(hourly?.precipitation)
    ? hourly.precipitation
    : [];
  const weatherCodes = Array.isArray(hourly?.weather_code)
    ? hourly.weather_code
    : [];
  if (!times.length) return { windowKey: "", windowText: "" };

  const current = vietnamClock(now);
  const currentMinute = current.hour * 60 + current.minute;
  const strongHours = [];

  times.forEach((time, index) => {
    const value = String(time || "");
    if (!value.startsWith(current.dateKey)) return;

    const endHour = Number(value.slice(11, 13));
    if (!Number.isInteger(endHour) || endHour <= 0) return;
    const startHour = endHour - 1;
    if (endHour * 60 <= currentMinute) return;

    const entry = {
      startHour,
      endHour,
      probability: Number(probabilities[index] || 0),
      amount: Number(precipitation[index] || 0),
      weatherCode: Number(weatherCodes[index]),
    };
    if (hasStrongRainSignal(entry)) strongHours.push(entry);
  });

  if (!strongHours.length) return { windowKey: "", windowText: "" };

  const groups = [];
  strongHours.forEach((entry) => {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    if (!previous || entry.startHour !== previous.endHour) groups.push([entry]);
    else group.push(entry);
  });

  const windows = groups.map((group) => (
    `${hourLabel(group[0].startHour)}–${hourLabel(group.at(-1).endHour)}`
  ));
  return {
    windowKey: `${current.dateKey}|${windows.join("|")}`,
    windowText: windows.join(" và "),
  };
}

function hasStrongRainSignal({ probability, amount, weatherCode }) {
  return (probability >= HIGH_PROBABILITY && amount >= SUPPORTING_AMOUNT_MM)
    || amount >= STRONG_AMOUNT_MM
    || (probability >= VERY_HIGH_PROBABILITY && isRainWeatherCode(weatherCode));
}

function isRainWeatherCode(code) {
  return (code >= 51 && code <= 67)
    || (code >= 80 && code <= 82)
    || (code >= 95 && code <= 99);
}

function vietnamClock(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    dateKey: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function hourLabel(hour) {
  return `${String(Math.max(0, Math.min(24, hour))).padStart(2, "0")}:00`;
}

function normalizeSubscription(value) {
  const endpoint = String(value?.endpoint || "").trim();
  const p256dh = String(value?.keys?.p256dh || "").trim();
  const auth = String(value?.keys?.auth || "").trim();
  if (!endpoint.startsWith("https://") || endpoint.length > 4096) {
    return { ok: false, error: "INVALID_PUSH_ENDPOINT" };
  }
  if (!p256dh || !auth || p256dh.length > 512 || auth.length > 256) {
    return { ok: false, error: "INVALID_PUSH_KEYS" };
  }
  const expiration = Number(value?.expirationTime);
  return {
    ok: true,
    value: {
      endpoint,
      expirationTime: Number.isFinite(expiration) && expiration > 0 ? expiration : null,
      keys: { p256dh, auth },
    },
  };
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

function hasPushConfig(env) {
  return Boolean(env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

function requirePushConfig(env) {
  if (!hasPushConfig(env)) throw new Error("PUSH_NOT_CONFIGURED");
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
