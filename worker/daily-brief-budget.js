import {
  handleDailyBriefRequest as handlePolicyDailyBriefRequest,
  isDailyBriefRoute,
  runDailyBriefSchedule as runPolicyDailyBriefSchedule,
} from "./daily-brief-policy.js";

const DAILY_BRIEF_AI_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DAILY_BRIEF_BUDGET_KEY = "last_budgeted_ai_refresh";
const BUDGET_AI_MODEL = "@cf/meta/llama-3.2-3b-instruct";

export { isDailyBriefRoute };

export async function handleDailyBriefRequest(request, env, ctx) {
  // Dashboard reads must never spend the shared Workers AI allowance.
  // Existing stories remain available, while stale or empty data can use
  // the deterministic RSS heuristic fallback in daily-brief.js.
  return handlePolicyDailyBriefRequest(request, withoutAi(env), ctx);
}

export async function runDailyBriefSchedule(env) {
  if (!env?.DB) return { skipped: true, reason: "storage-unavailable" };

  await ensureBudgetTable(env);
  const now = Date.now();
  const lastRun = await readBudgetTimestamp(env);
  if (now - lastRun < DAILY_BRIEF_AI_INTERVAL_MS) {
    return { skipped: true, reason: "ai-budget-window" };
  }

  // Reserve the window before inference so a failed or quota-limited call is
  // not retried by the every-minute cron and cannot create an error storm.
  await writeBudgetTimestamp(env, now);
  return runPolicyDailyBriefSchedule(withBudgetAi(env));
}

function withoutAi(env) {
  if (!env || typeof env !== "object") return env;
  return new Proxy(env, {
    get(target, property, receiver) {
      if (property === "AI") return undefined;
      return Reflect.get(target, property, receiver);
    },
  });
}

function withBudgetAi(env) {
  return new Proxy(env, {
    get(target, property, receiver) {
      if (property === "DAILY_BRIEF_AI_MODEL") return BUDGET_AI_MODEL;
      return Reflect.get(target, property, receiver);
    },
  });
}

async function ensureBudgetTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS daily_brief_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
}

async function readBudgetTimestamp(env) {
  const row = await env.DB.prepare(
    "SELECT value FROM daily_brief_meta WHERE key = ?",
  ).bind(DAILY_BRIEF_BUDGET_KEY).first();
  return Number(row?.value || 0);
}

async function writeBudgetTimestamp(env, value) {
  await env.DB.prepare(`
    INSERT INTO daily_brief_meta (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).bind(DAILY_BRIEF_BUDGET_KEY, String(value), value).run();
}
