import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");

const syncScript = String.raw`
;(() => {
  const API_PATH = "/api/daily-day";
  const CORE_KEY = "joy-daily-day-v1";
  const WORKOUT_KEY = "joy-daily-day-workout-values-v1";
  const STREAK_KEY = "joy-daily-day-streak-v1";
  const MIGRATION_KEY = "joy-daily-day-cloud-migrated-v1";
  const WATCHED_KEYS = new Set([CORE_KEY, WORKOUT_KEY, STREAK_KEY]);
  let initialized = false;
  let pulling = false;
  let mutationQueue = Promise.resolve();
  let pendingMutations = 0;
  let latestConfirmedState = null;
  let lastPullAt = 0;

  const parse = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  };

  const localState = () => ({
    core: parse(CORE_KEY),
    workoutValues: parse(WORKOUT_KEY),
    streak: parse(STREAK_KEY),
  });

  const stableValue = (value) => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  };
  const stableJson = (value) => JSON.stringify(stableValue(value));

  const applyState = (data) => {
    const source = data && typeof data === "object" ? data : {};
    const previousCore = parse(CORE_KEY);
    const previousWorkout = parse(WORKOUT_KEY);
    const previousStreak = parse(STREAK_KEY);
    const nextCoreObject = source.core && typeof source.core === "object" ? source.core : {};
    const nextWorkoutObject = source.workoutValues && typeof source.workoutValues === "object" ? source.workoutValues : {};
    const nextStreakObject = source.streak && typeof source.streak === "object" ? source.streak : {};

    const coreChanged = stableJson(previousCore) !== stableJson(nextCoreObject);
    const workoutValuesChanged = stableJson(previousWorkout) !== stableJson(nextWorkoutObject);
    const streakChanged = stableJson(previousStreak) !== stableJson(nextStreakObject);
    if (!coreChanged && !workoutValuesChanged && !streakChanged) return false;

    const detail = {
      checksChanged: stableJson(previousCore.checks || {}) !== stableJson(nextCoreObject.checks || {}),
      overridesChanged: stableJson(previousCore.overrides || {}) !== stableJson(nextCoreObject.overrides || {}),
      coreWorkoutsChanged: stableJson(previousCore.workouts || {}) !== stableJson(nextCoreObject.workouts || {}),
      templateVersionsChanged: stableJson(previousCore.templateVersions || {}) !== stableJson(nextCoreObject.templateVersions || {}),
      workoutValuesChanged,
      streakChanged,
    };

    if (coreChanged) localStorage.setItem(CORE_KEY, JSON.stringify(nextCoreObject));
    if (workoutValuesChanged) localStorage.setItem(WORKOUT_KEY, JSON.stringify(nextWorkoutObject));
    if (streakChanged) localStorage.setItem(STREAK_KEY, JSON.stringify(nextStreakObject));
    window.dispatchEvent(new CustomEvent("joy:daily-day-cloud-applied", { detail }));
    return true;
  };

  const request = async (method, body) => {
    const response = await fetch(API_PATH, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || "DAILY_DAY_SYNC_FAILED");
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const pull = async ({ force = false } = {}) => {
    if (pulling || !initialized || pendingMutations > 0) return;
    if (!force && Date.now() - lastPullAt < 2500) return;
    if (document.querySelector("#daily-day-modal .dd-exercise-line.editing")) return;
    pulling = true;
    try {
      const cloud = await request("GET");
      lastPullAt = Date.now();
      // A local mutation may have started while this GET was in flight. Never
      // let an older cloud snapshot overwrite optimistic local state.
      if (pendingMutations > 0) return;
      if (cloud.exists) applyState(cloud.data);
    } catch (error) {
      if (error.status !== 401) console.warn("Daily Day pull failed", error);
    } finally {
      pulling = false;
    }
  };

  const initialize = async () => {
    try {
      let cloud = await request("GET");
      const historyBackfill = window.__JOY_DAILY_DAY_HISTORY_BACKFILL__;
      const cloudHasHistory = Boolean(
        historyBackfill?.id
        && cloud?.data?.core?.backfills?.[historyBackfill.id],
      );

      if (historyBackfill?.data && !cloudHasHistory) {
        const backfilled = await request("PUT", { data: historyBackfill.data, merge: true });
        cloud = { ...backfilled, exists: true };
        applyState(backfilled.data);
      }

      const migrated = localStorage.getItem(MIGRATION_KEY) === "1";
      if (!migrated) {
        const merged = await request("PUT", { data: localState(), merge: true });
        applyState(merged.data);
        localStorage.setItem(MIGRATION_KEY, "1");
      } else if (cloud.exists) {
        applyState(cloud.data);
      } else {
        const seeded = await request("PUT", { data: localState(), merge: true });
        applyState(seeded.data);
      }
      const migratedThreeTemplates = await request("PATCH", {
        mutation: { type: "three-template-migration", date: "2026-09-16" },
      });
      if (migratedThreeTemplates?.data) applyState(migratedThreeTemplates.data);
      lastPullAt = Date.now();
    } catch (error) {
      if (error.status !== 401) console.warn("Daily Day initial sync failed", error);
    } finally {
      initialized = true;
    }
  };

  const patch = (mutation) => {
    pendingMutations += 1;
    mutationQueue = mutationQueue
      .catch(() => {})
      .then(async () => {
        try {
          let result = await request("PATCH", { mutation });
          if (result?.data) latestConfirmedState = result.data;
        } catch (error) {
          if (error.status === 409) {
            await new Promise((resolve) => setTimeout(resolve, 120));
            const result = await request("PATCH", { mutation });
            if (result?.data) latestConfirmedState = result.data;
          } else if (error.status !== 401) {
            throw error;
          }
        }
      })
      .catch((error) => console.warn("Daily Day change sync failed", error))
      .finally(() => {
        pendingMutations = Math.max(0, pendingMutations - 1);
        if (pendingMutations !== 0) return;
        const confirmed = latestConfirmedState;
        latestConfirmedState = null;
        if (confirmed) applyState(confirmed);
      });
    return mutationQueue;
  };

  window.JoyDailyDaySync = Object.freeze({ patch });

  const selectedDate = () =>
    document.querySelector("#daily-day-modal .dd-week button.active[data-dd-date]")?.dataset.ddDate || "";

  const workoutValue = (date, itemId) => {
    const data = parse(WORKOUT_KEY);
    return data?.[date]?.[itemId] || null;
  };

  const streakValue = (date, streakId) => {
    const data = parse(STREAK_KEY);
    return Boolean(data?.days?.[date]?.[streakId]);
  };

  // Daily Day rerenders its markup synchronously after a local interaction.
  // Observe interactions during capture so the sync layer sees the original
  // input/button before that node is detached from #daily-day-modal.
  document.addEventListener("change", (event) => {
    const check = event.target.closest?.("#daily-day-modal input[data-dd-check]");
    if (check) {
      const date = selectedDate();
      if (date) patch({ type: "core-check", date, id: check.dataset.ddCheck, value: check.checked });
      return;
    }

    const select = event.target.closest?.("#daily-day-modal select[data-dd-select]");
    if (select) {
      const date = selectedDate();
      if (date) patch({ type: "core-template", date, templateId: select.value });
    }
  }, true);

  document.addEventListener("click", (event) => {
    const workout = event.target.closest?.("#daily-day-modal [data-dd-workout]");
    if (workout) {
      const date = selectedDate();
      if (date) setTimeout(() => patch({ type: "core-workout", date, variant: workout.dataset.ddWorkout }), 0);
      return;
    }

    const exerciseButton = event.target.closest?.("#daily-day-modal .dd-exercise-save, #daily-day-modal .dd-exercise-reset");
    if (exerciseButton) {
      const date = selectedDate();
      const line = exerciseButton.closest(".dd-exercise-line");
      const itemId = line?.querySelector("input[data-dd-check]")?.dataset.ddCheck || "";
      if (date && itemId) {
        setTimeout(() => patch({ type: "workout-value", date, itemId, value: workoutValue(date, itemId) }), 0);
      }
      return;
    }

    const streak = event.target.closest?.("#daily-day-modal [data-dd-streak-check]");
    if (streak) {
      const date = selectedDate();
      const streakId = streak.dataset.ddStreakCheck;
      if (date && streakId) {
        setTimeout(() => patch({ type: "streak", date, streakId, value: streakValue(date, streakId) }), 0);
      }
      return;
    }

    if (event.target.closest?.("#todo-title,[data-dd-today]")) {
      setTimeout(() => pull({ force: true }), 0);
    }
  }, true);

  window.addEventListener("focus", () => pull({ force: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pull({ force: true });
  });
  window.addEventListener("storage", (event) => {
    if (WATCHED_KEYS.has(event.key)) pull({ force: true });
  });

  // Poll silently while the modal is visible. Polls are also suppressed while
  // local mutations are pending, so an older GET snapshot cannot undo a fresh
  // optimistic checkbox/template/workout/streak change.
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const modal = document.querySelector("#daily-day-modal");
    if (modal && !modal.hidden) pull();
  }, 8000);

  initialize();
})();
`;

await appendFile(scriptTarget, syncScript);
console.log("Daily Day account sync appended");
