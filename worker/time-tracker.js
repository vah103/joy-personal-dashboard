import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";
import {
  intersectDuration,
  summarizeTimeTracker,
  TIME_TRACKER_BUDGETS,
  vietnamDayBounds,
} from "./time-tracker-core.js";

const API_PATH = "/api/time-tracker";
const SWITCH_PATH = "/api/time-tracker/switch";

export function isTimeTrackerRoute(pathname) {
  return pathname === API_PATH || pathname === SWITCH_PATH;
}

async function readState(email, env) {
  return env.DB.prepare(`
    SELECT active_activity, active_started_at, version
    FROM daily_time_tracker_state WHERE user_email = ?
  `).bind(email).first();
}

async function snapshot(email, env, now = Date.now()) {
  const day = vietnamDayBounds(now);
  const [state, closed, recent] = await Promise.all([
    readState(email, env),
    env.DB.prepare(`
      SELECT activity,
        SUM(MAX(0, MIN(ended_at, ?) - MAX(started_at, ?))) AS duration_ms
      FROM daily_time_tracker_sessions
      WHERE user_email = ? AND started_at < ? AND ended_at > ?
      GROUP BY activity
    `).bind(day.end, day.start, email, day.end, day.start).all(),
    env.DB.prepare(`
      SELECT id, activity, started_at, ended_at
      FROM daily_time_tracker_sessions
      WHERE user_email = ? AND started_at < ? AND ended_at > ?
      ORDER BY ended_at DESC, id DESC LIMIT 10
    `).bind(email, day.end, day.start).all(),
  ]);
  return {
    ...summarizeTimeTracker({ rows: closed.results || [], active: state, now }),
    history: (recent.results || []).map((entry) => ({
      id: entry.id,
      activity: entry.activity,
      startedAt: Math.max(Number(entry.started_at), day.start),
      endedAt: Math.min(Number(entry.ended_at), day.end),
      durationMs: intersectDuration(entry.started_at, entry.ended_at, day.start, day.end),
    })),
  };
}

async function switchActivity(request, email, env) {
  const body = await readJson(request);
  const activity = body.activity === null ? null : body.activity;
  const expectedVersion = body.expectedVersion;
  if (activity !== null && !Object.hasOwn(TIME_TRACKER_BUDGETS, activity)) {
    return json({ error: "INVALID_ACTIVITY" }, 400);
  }
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    return json({ error: "INVALID_VERSION" }, 400);
  }

  const now = Date.now();
  // Create the empty state once. All concurrent changes are guarded by version.
  await env.DB.prepare(`
    INSERT OR IGNORE INTO daily_time_tracker_state
      (user_email, active_activity, active_started_at, version, updated_at)
    VALUES (?, NULL, NULL, 0, ?)
  `).bind(email, now).run();

  const previous = await readState(email, env);
  if (Number(previous?.version) !== expectedVersion) {
    return json({ error: "VERSION_CONFLICT", snapshot: await snapshot(email, env) }, 409);
  }
  if (previous?.active_activity === activity) {
    return json(await snapshot(email, env));
  }

  // D1 batch executes as one transaction. A losing concurrent request writes
  // neither a duplicate session nor an overlapping active timer.
  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO daily_time_tracker_sessions
        (user_email, activity, started_at, ended_at, created_at)
      SELECT user_email, active_activity, active_started_at,
             MAX(active_started_at, ?), ?
      FROM daily_time_tracker_state
      WHERE user_email = ? AND version = ?
        AND active_activity IS NOT NULL AND active_started_at IS NOT NULL
    `).bind(now, now, email, expectedVersion),
    env.DB.prepare(`
      UPDATE daily_time_tracker_state
      SET active_activity = ?, active_started_at = ?, version = version + 1, updated_at = ?
      WHERE user_email = ? AND version = ?
    `).bind(activity, activity ? now : null, now, email, expectedVersion),
  ]);
  if (Number(results?.[1]?.meta?.changes) !== 1) {
    return json({ error: "VERSION_CONFLICT", snapshot: await snapshot(email, env) }, 409);
  }
  return json(await snapshot(email, env));
}

export async function handleTimeTrackerRequest(request, env) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "GET" && !isSameOrigin(request)) {
      return json({ error: "INVALID_ORIGIN" }, 403);
    }
    const pathname = new URL(request.url).pathname;
    if (pathname === API_PATH && request.method === "GET") {
      return json(await snapshot(session.user_email, env));
    }
    if (pathname === SWITCH_PATH && request.method === "POST") {
      return switchActivity(request, session.user_email, env);
    }
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  } catch (error) {
    console.error("Joy time tracker request failed", error);
    return json({ error: "TIME_TRACKER_UNAVAILABLE" }, 500);
  }
}
