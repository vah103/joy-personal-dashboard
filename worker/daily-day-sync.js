import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

const DAILY_DAY_PATH = "/api/daily-day";
const DAILY_DAY_STORAGE_ID = "__daily_day_state__";
const MAX_STATE_BYTES = 350_000;
const MAX_WRITE_RETRIES = 5;
const TEMPLATE_IDS = new Set(["morning", "afternoon", "no_workout"]);
const THREE_TEMPLATE_START = "2026-09-16";
const THREE_TEMPLATE_MIGRATION_ID = "daily-day-three-template-20260916-v1";
const WORKOUT_VARIANTS = new Set(["chest", "back", "leg"]);
const LEGACY_STREAKS = Object.freeze([
  { id: "no-snacks", name: "No snacks", targetDays: 14, baseCarry: 0 },
  { id: "no-masturbate", name: "No Masturbate", targetDays: 14, baseCarry: 0 },
  { id: "finasteride", name: "Finasteride", targetDays: 100, baseCarry: 2 },
]);

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

function normalizeTemplateBlocks(value) {
  if (!Array.isArray(value) || value.length > 48) return null;
  const blocks = [];
  for (const rawBlock of value) {
    if (!Array.isArray(rawBlock) || rawBlock.length < 3) return null;
    const time = String(rawBlock[0] ?? "").slice(0, 16);
    const title = String(rawBlock[1] ?? "").slice(0, 160);
    if (!Array.isArray(rawBlock[2]) || rawBlock[2].length > 80) return null;
    const items = rawBlock[2].map((item) => String(item ?? "").trim().slice(0, 220)).filter(Boolean);
    blocks.push([time, title, items]);
  }
  return blocks;
}


function normalizeTargetDays(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10_000 ? parsed : null;
}

function cleanStreakText(value, max) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : "";
}

function addDateDays(dateKey, amount) {
  const value = new Date(`${dateKey}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function streakProgress(run, throughDate = "9999-12-31") {
  const startDate = String(run?.startDate || "");
  const checks = plainObject(run?.checkins);
  const completed = Object.entries(checks).reduce(
    (sum, [dateKey, value]) => sum + Number(
      Boolean(value)
      && validDateKey(dateKey)
      && (!startDate || dateKey >= startDate)
      && dateKey <= throughDate
    ),
    0,
  );
  return Number(run?.baseCarry || 0) + completed;
}

function ensureStreakV2(next, migrationDate) {
  if (Number(next.streak?.schemaVersion) === 2) {
    next.streak.runs = plainObject(next.streak.runs);
    next.streak.suggestions = plainObject(next.streak.suggestions);
    return next.streak;
  }

  const legacyDays = plainObject(next.streak?.days);
  const runs = {};
  for (const legacy of LEGACY_STREAKS) {
    const checkedDates = Object.entries(legacyDays)
      .filter(([dateKey, day]) => validDateKey(dateKey) && Boolean(plainObject(day)[legacy.id]))
      .map(([dateKey]) => dateKey)
      .sort();
    const checkins = Object.fromEntries(checkedDates.map((dateKey) => [dateKey, true]));
    runs[`legacy-${legacy.id}`] = {
      id: `legacy-${legacy.id}`,
      name: legacy.name,
      targetDays: legacy.targetDays,
      startDate: checkedDates[0] || migrationDate,
      enforceFrom: migrationDate,
      status: "active",
      checkins,
      endDate: null,
      endReason: "",
      completedDate: null,
      sourceRunId: null,
      legacyImported: true,
      baseCarry: legacy.baseCarry,
    };
  }

  next.streak = {
    schemaVersion: 2,
    runs,
    suggestions: {},
    legacyDays,
    migratedAt: migrationDate,
  };
  return next.streak;
}

function addStreakSuggestion(streak, run, date, kind) {
  const suggestionId = `suggest-${run.id}-${date}`.slice(0, 180);
  streak.suggestions = plainObject(streak.suggestions);
  streak.suggestions[suggestionId] = {
    id: suggestionId,
    sourceRunId: run.id,
    name: run.name,
    targetDays: run.targetDays,
    startDate: addDateDays(date, 1),
    kind,
  };
}

function finishStreakRun(streak, run, date, status, reason = "") {
  run.status = status;
  run.endDate = date;
  run.endReason = status === "ended" ? cleanStreakText(reason, 500) : "";
  run.completedDate = status === "completed" ? date : null;
  addStreakSuggestion(streak, run, date, status === "completed" ? "continue" : "restart");
}

function applyMutation(state, mutation) {
  const next = normalizeState(state);
  const type = String(mutation?.type || "");
  const date = String(mutation?.date || "");
  if (!validDateKey(date)) return null;

  if (type === "three-template-migration") {
    if (date !== THREE_TEMPLATE_START) return null;
    next.core.migrations = plainObject(next.core.migrations);
    if (next.core.migrations[THREE_TEMPLATE_MIGRATION_ID]) return next;

    const keepBeforeCutoff = (value) => Object.fromEntries(
      Object.entries(plainObject(value)).filter(([dateKey]) => validDateKey(dateKey) && dateKey < date),
    );

    next.core.checks = keepBeforeCutoff(next.core.checks);
    next.core.overrides = keepBeforeCutoff(next.core.overrides);
    next.core.workouts = keepBeforeCutoff(next.core.workouts);
    next.core.templateVersions = {};
    next.core.backfills = {};
    next.core.migrations[THREE_TEMPLATE_MIGRATION_ID] = true;
    return next;
  }

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

  if (type === "template-version") {
    const templateId = String(mutation.templateId || "");
    if (!TEMPLATE_IDS.has(templateId)) return null;
    const blocks = normalizeTemplateBlocks(mutation.blocks);
    if (!blocks) return null;
    next.core.templateVersions = plainObject(next.core.templateVersions);
    const existing = Array.isArray(next.core.templateVersions[templateId])
      ? next.core.templateVersions[templateId]
      : [];
    next.core.templateVersions[templateId] = [
      ...existing.filter((entry) => validDateKey(entry?.effectiveFrom) && entry.effectiveFrom !== date),
      { effectiveFrom: date, blocks },
    ]
      .sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)))
      .slice(-120);
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

  if (type === "streak-v2-migrate") {
    ensureStreakV2(next, date);
    return next;
  }

  if (type.startsWith("streak-")) {
    const streak = ensureStreakV2(next, date);
    streak.runs = plainObject(streak.runs);
    streak.suggestions = plainObject(streak.suggestions);

    if (type === "streak-create") {
      const runId = String(mutation.runId || "");
      const name = cleanStreakText(mutation.name, 120);
      const targetDays = normalizeTargetDays(mutation.targetDays);
      const startDate = String(mutation.startDate || date);
      if (!validKey(runId, 120) || streak.runs[runId] || !name || !targetDays || !validDateKey(startDate)) return null;
      streak.runs[runId] = {
        id: runId,
        name,
        targetDays,
        startDate,
        enforceFrom: startDate,
        status: "active",
        checkins: {},
        endDate: null,
        endReason: "",
        completedDate: null,
        sourceRunId: validKey(mutation.sourceRunId, 120) ? String(mutation.sourceRunId) : null,
        legacyImported: false,
        baseCarry: 0,
      };
      return next;
    }

    if (type === "streak-update") {
      const runId = String(mutation.runId || "");
      const run = plainObject(streak.runs[runId]);
      if (!runId || run.status !== "active") return null;
      const name = cleanStreakText(mutation.name, 120);
      const targetDays = normalizeTargetDays(mutation.targetDays);
      const startDate = String(mutation.startDate || run.startDate || date);
      if (!name || !targetDays || !validDateKey(startDate)) return null;
      run.name = name;
      run.targetDays = targetDays;
      run.startDate = startDate;
      if (!validDateKey(run.enforceFrom) || run.enforceFrom < startDate) run.enforceFrom = startDate;
      streak.runs[runId] = run;
      if (streakProgress(run, date) >= targetDays) finishStreakRun(streak, run, date, "completed");
      return next;
    }

    if (type === "streak-check") {
      const runId = String(mutation.runId || "");
      const run = plainObject(streak.runs[runId]);
      if (!runId || run.status !== "active" || date < String(run.startDate || "")) return null;
      run.checkins = plainObject(run.checkins);
      if (Boolean(mutation.value)) run.checkins[date] = true;
      else delete run.checkins[date];
      streak.runs[runId] = run;
      const targetDays = normalizeTargetDays(run.targetDays);
      if (targetDays && Boolean(mutation.value) && streakProgress(run, date) >= targetDays) {
        finishStreakRun(streak, run, date, "completed");
      }
      return next;
    }

    if (type === "streak-end") {
      const runId = String(mutation.runId || "");
      const run = plainObject(streak.runs[runId]);
      if (!runId || run.status !== "active" || date < String(run.startDate || "")) return null;
      finishStreakRun(streak, run, date, "ended", mutation.reason);
      streak.runs[runId] = run;
      return next;
    }

    if (type === "streak-suggestion-dismiss") {
      const suggestionId = String(mutation.suggestionId || "");
      if (!validKey(suggestionId, 180) || !streak.suggestions[suggestionId]) return null;
      delete streak.suggestions[suggestionId];
      return next;
    }

    if (type === "streak-suggestion-accept") {
      const suggestionId = String(mutation.suggestionId || "");
      const suggestion = plainObject(streak.suggestions[suggestionId]);
      const runId = String(mutation.runId || "");
      const name = cleanStreakText(mutation.name || suggestion.name, 120);
      const targetDays = normalizeTargetDays(mutation.targetDays ?? suggestion.targetDays);
      const startDate = String(mutation.startDate || suggestion.startDate || date);
      if (!suggestion.id || !validKey(runId, 120) || streak.runs[runId] || !name || !targetDays || !validDateKey(startDate)) return null;
      streak.runs[runId] = {
        id: runId,
        name,
        targetDays,
        startDate,
        enforceFrom: startDate,
        status: "active",
        checkins: {},
        endDate: null,
        endReason: "",
        completedDate: null,
        sourceRunId: validKey(suggestion.sourceRunId, 120) ? String(suggestion.sourceRunId) : null,
        legacyImported: false,
        baseCarry: 0,
      };
      delete streak.suggestions[suggestionId];
      return next;
    }
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

function changes(result) {
  return Number(result?.meta?.changes || 0);
}

async function optimisticWrite(email, env, transform) {
  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
    const current = await readRow(email, env);
    const currentVersion = Number(current?.version || 0);
    const nextState = transform(parseStored(current?.data_json));
    if (!nextState) return { invalid: true };
    const prepared = serializedState(nextState);
    if (!prepared) return { tooLarge: true };
    const version = currentVersion + 1;
    const updatedAt = Date.now();

    if (!current) {
      const inserted = await env.DB.prepare(`
        INSERT OR IGNORE INTO project_hubs (user_email, project_id, data_json, version, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(email, DAILY_DAY_STORAGE_ID, prepared.serialized, version, updatedAt).run();
      if (changes(inserted) === 1) {
        return { data: prepared.normalized, version, updatedAt };
      }
      continue;
    }

    const updated = await env.DB.prepare(`
      UPDATE project_hubs
      SET data_json = ?, version = ?, updated_at = ?
      WHERE user_email = ? AND project_id = ? AND version = ?
    `).bind(
      prepared.serialized,
      version,
      updatedAt,
      email,
      DAILY_DAY_STORAGE_ID,
      currentVersion,
    ).run();
    if (changes(updated) === 1) {
      return { data: prepared.normalized, version, updatedAt };
    }
  }
  return { conflict: true };
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
    if (request.method === "GET") {
      const current = await readRow(email, env);
      return json({
        data: parseStored(current?.data_json),
        exists: Boolean(current),
        version: Number(current?.version || 0),
        updatedAt: Number(current?.updated_at || 0),
      });
    }

    const body = await readJson(request);
    const stored = request.method === "PUT"
      ? await optimisticWrite(email, env, (currentState) => {
          const incoming = normalizeState(body?.data);
          return body?.merge ? mergeState(currentState, incoming) : incoming;
        })
      : await optimisticWrite(email, env, (currentState) => applyMutation(currentState, body?.mutation));

    if (stored.invalid) return json({ error: "INVALID_DAILY_DAY_MUTATION" }, 400);
    if (stored.tooLarge) return json({ error: "DAILY_DAY_STATE_TOO_LARGE" }, 413);
    if (stored.conflict) return json({ error: "DAILY_DAY_SYNC_CONFLICT" }, 409);
    return json({ ok: true, exists: true, ...stored });
  } catch (error) {
    console.error("Joy Daily Day sync failed", error);
    return json({ error: "DAILY_DAY_SYNC_FAILED" }, 500);
  }
}
