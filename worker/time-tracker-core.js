export const TIME_TRACKER_BUDGETS = Object.freeze({
  sleep: 8,
  chores: 3,
  income: 2,
  gym: 2,
  relax: 1,
  thesis: 4,
  english: 1,
  ai: 2,
  career: 1,
});

export const STUDY_ACTIVITIES = Object.freeze(["thesis", "english", "ai", "career"]);
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function vietnamDayBounds(now = Date.now()) {
  const shifted = now + VIETNAM_OFFSET_MS;
  const start = Math.floor(shifted / DAY_MS) * DAY_MS - VIETNAM_OFFSET_MS;
  return {
    date: new Date(shifted).toISOString().slice(0, 10),
    start,
    end: start + DAY_MS,
  };
}

export function intersectDuration(start, end, dayStart, dayEnd) {
  const from = Math.max(Number(start) || 0, dayStart);
  const to = Math.min(Number(end) || 0, dayEnd);
  return Math.max(0, to - from);
}

export function summarizeTimeTracker({ rows = [], active = null, now = Date.now() } = {}) {
  const day = vietnamDayBounds(now);
  const totals = Object.fromEntries(Object.keys(TIME_TRACKER_BUDGETS).map((id) => [id, 0]));
  for (const entry of rows) {
    if (Object.hasOwn(totals, entry.activity)) {
      totals[entry.activity] += Math.max(0, Number(entry.duration_ms) || 0);
    }
  }
  const activityId = active?.active_activity;
  const startedAt = Number(active?.active_started_at);
  if (Object.hasOwn(totals, activityId) && Number.isFinite(startedAt) && startedAt > 0) {
    totals[activityId] += intersectDuration(startedAt, now, day.start, day.end);
  }
  const studyMs = STUDY_ACTIVITIES.reduce((total, id) => total + totals[id], 0);
  const recordedMs = Object.values(totals).reduce((total, ms) => total + ms, 0);
  return {
    date: day.date,
    dayStart: day.start,
    dayEnd: day.end,
    totals,
    studyMs,
    recordedMs,
    unrecordedBudgetMs: Math.max(0, DAY_MS - recordedMs),
    budgetsHours: TIME_TRACKER_BUDGETS,
    studyBudgetHours: 8,
    dayBudgetHours: 24,
    serverNow: now,
    activeActivity: Object.hasOwn(totals, activityId) ? activityId : null,
    activeStartedAt: Object.hasOwn(totals, activityId) && startedAt > 0 ? startedAt : null,
    version: Number(active?.version) || 0,
  };
}
