import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

const DAILY_DAY_PATH = "/api/daily-day";
const DAILY_DAY_STORAGE_ID = "__daily_day_state__";
const MAX_STATE_BYTES = 350_000;
const TEMPLATE_IDS = new Set(["morning", "afternoon", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
const WORKOUT_VARIANTS = new Set(["chest", "back", "leg"]);
const STREAK_IDS = new Set(["no-snacks", "no-masturbate", "finasteride"]);

export function isDailyDaySyncRoute(pathname) {
  return pathname === DAILY_DAY_PATH;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeState(value) {
  const source = plainObject(value);
  return {
    core: plainObject(source.core),
    workoutValues: plainObject(source.workoutValues),
    streak: plainObject(source.streak),
  };
}

function parseStored(value) {
  try {
    return normalizeState(JSON.parse(value || "{}"));
  } catch {
    return normalizeState({});
  }
}

function mergeObjects(base, incoming) {
  const result = { ...plainObject(base) };
  for (const [key, value] of Object.entries(plainObject(incoming))) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = mergeObjects(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function mergeState(base, incoming) {
  const current = normalizeState(base);
  const next = normalizeState(incoming);
  return {
    core: mergeObjects(current.core, next.core),
    workoutValues: mergeObjects(current.workoutValues, next.workoutValues),
    streak: mergeObjects(current.streak, next.streak),
  };
}

function validDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function validKey(value, max = 180) {
  const key = String(value || "");
  return Boolean(key) && key.length <= max;
}

function applyMutation(state, mutation) {
  const next = normalizeState(state);
  const type = String(mutation?.type || "");
  const date = String(mutation?.date || "");
  if (!validDateKey(date)) return null;

  if (type === "core-check") {
    const id = String(mutation.id || "");
    if (!validKey(id)) return null;
    next.core.checks = plainObject(next.core.checks);
    next.core.checks[date] = plainObject(next.core.checks[date]);
    next.core.checks[date][id] = Boolean(mutation.value);
    return next;
  }

  if (type === "core-template") {
    const templateId = String(mutation.templateId || "");
    if (!TEMPLATE_IDS.has(templateId)) return null;
    next.core.overrides = plainObject(next.core.overrides);
    next.core.overrides[date] = templateId;
    return next;
  }

  if (type === "core-workout") {
    const variant = String(mutation.variant || "");
    if (!WORKOUT_VARIANTS.has(variant)) return null;
    next.core.workouts = plainObject(next.core.workouts);
    next.core.workouts[date] = variant;
    return next;
  }

  if (type === "workout-value") {
    const itemId = String(mutation.itemId || "");
    if (!validKey(itemId)) return null;
    next.workoutValues[date] = plainObject(next.workoutValues[date]);
    if (mutation.value === null) {
      delete next.workoutValues[date][itemId];
      if (!Object.keys(next.workoutValues[date]).length) delete next.workoutValues[date];
    } else {
      const value = plainObject(mutation.value);
      next.workoutValues[date][itemId] = {
        weight: String(value.weight ?? "").slice(0, 32),
        reps: String(value.reps ?? "").slice(0, 32),
      };
    }
    return next;
  }

  if (type === "streak") {
    const streakId = String(mutation.streakId || "");
    if (!STREAK_IDS.has(streakId)) return null;
    next.streak.days = plainObject(next.streak.days);
    next.streak.days[date] = plainObject(next.streak.days[date]);
    next.streak.days[date][streakId] = Boolean(mutation.value);
    return next;
  }

  return null;
}

function serializedState(state) {
  const normalized = normalizeState(state);
  const serialized = JSON.stringify(normalized);
  if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) return null;
  return { normalized, serialized };
}

async function readRow(email, env) {
  return env.DB.prepare(`
    SELECT data_json, version, updated_at
    FROM project_hubs
    WHERE user_email = ? AND project_id = ?
  `).bind(email, DAILY_DAY_STORAGE_ID).first();
}

async function storeState(email, env, state, currentVersion = 0) {
  const prepared = serializedState(state);
  if (!prepared) return null;
  const version = Number(currentVersion || 0) + 1;
  const updatedAt = Date.now();
  await env.DB.prepare(`
    INSERT INTO project_hubs (user_email, project_id, data_json, version, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_email, project_id) DO UPDATE SET
      data_json = excluded.data_json,
      version = excluded.version,
      updated_at = excluded.updated_at
  `).bind(email, DAILY_DAY_STORAGE_ID, prepared.serialized, version, updatedAt).run();
  return { data: prepared.normalized, version, updatedAt };
}

export async function handleDailyDaySyncRequest(request, env) {
  try {
    if (!["GET", "PUT", "PATCH"].includes(request.method)) {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET, PUT, PATCH" });
    }

    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "GET" && !isSameOrigin(request)) {
      return json({ error: "INVALID_ORIGIN" }, 403);
    }

    const email = session.user_email;
    const current = await readRow(email, env);

    if (request.method === "GET") {
      return json({
        data: parseStored(current?.data_json),
        exists: Boolean(current),
        version: Number(current?.version || 0),
        updatedAt: Number(current?.updated_at || 0),
      });
    }

    const body = await readJson(request);
    const currentState = parseStored(current?.data_json);

    if (request.method === "PUT") {
      const incoming = normalizeState(body?.data);
      const state = body?.merge ? mergeState(currentState, incoming) : incoming;
      const stored = await storeState(email, env, state, Number(current?.version || 0));
      if (!stored) return json({ error: "DAILY_DAY_STATE_TOO_LARGE" }, 413);
      return json({ ok: true, exists: true, ...stored });
    }

    const state = applyMutation(currentState, body?.mutation);
    if (!state) return json({ error: "INVALID_DAILY_DAY_MUTATION" }, 400);
    const stored = await storeState(email, env, state, Number(current?.version || 0));
    if (!stored) return json({ error: "DAILY_DAY_STATE_TOO_LARGE" }, 413);
    return json({ ok: true, exists: true, ...stored });
  } catch (error) {
    console.error("Joy Daily Day sync failed", error);
    return json({ error: "DAILY_DAY_SYNC_FAILED" }, 500);
  }
}
