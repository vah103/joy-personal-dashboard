import webpush from "web-push";

const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&hourly=precipitation_probability,precipitation,weather_code&timezone=Asia%2FHo_Chi_Minh&forecast_days=1";
const CHECK_EVERY_MINUTES = 5;
const HIGH_PROBABILITY = 70;
const VERY_HIGH_PROBABILITY = 80;
const SUPPORTING_AMOUNT_MM = 0.3;
const STRONG_AMOUNT_MM = 1;

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
  }, env);

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

async function sendPushRows(rows, payload, env) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );

  const deadEndpoints = [];
  let sent = 0;

  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify(payload),
        {
          TTL: 30 * 60,
          urgency: "high",
          topic: "hey-joy-rain",
        },
      );
      sent += 1;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        deadEndpoints.push(row.endpoint);
      } else {
        console.error("Hey Joy rain push delivery failed", statusCode || error);
      }
    }
  }));

  if (deadEndpoints.length) {
    await env.DB.batch(deadEndpoints.map((endpoint) => (
      env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint)
    )));
  }

  return { sent };
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
    const entry = {
      startHour: endHour - 1,
      endHour,
      probability: Number(probabilities[index] || 0),
      amount: Number(precipitation[index] || 0),
      weatherCode: Number(weatherCodes[index]),
    };
    if (hasStrongRainSignal(entry)) strongHours.push(entry);
  });

  const groups = [];
  strongHours.forEach((entry) => {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    if (!previous || entry.startHour !== previous.endHour) groups.push([entry]);
    else group.push(entry);
  });

  const upcomingGroups = groups.filter((group) => (
    group.at(-1).endHour * 60 > currentMinute
  ));
  if (!upcomingGroups.length) return { windowKey: "", windowText: "" };

  const windows = upcomingGroups.map((group) => {
    const startHour = group[0].startHour;
    const endHour = group.at(-1).endHour;
    const ongoing = startHour * 60 <= currentMinute;
    return {
      display: `${hourLabel(startHour)}–${hourLabel(endHour)}`,
      key: ongoing ? `ongoing-${endHour}` : `${startHour}-${endHour}`,
    };
  });

  return {
    windowKey: `${current.dateKey}|${windows.map((window) => window.key).join("|")}`,
    windowText: windows.map((window) => window.display).join(" và "),
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

function hasPushConfig(env) {
  return Boolean(env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}
