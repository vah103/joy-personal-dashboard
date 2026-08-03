import {
  handleDailyBriefRequest as handlePolicyDailyBriefRequest,
  isDailyBriefRoute,
  runDailyBriefSchedule as runPolicyDailyBriefSchedule,
} from "./daily-brief-policy.js";
import {
  focusDailyBriefPayload,
  refreshFocusedMarketSignals,
} from "./daily-brief-focus.js";

const DAILY_BRIEF_AI_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DAILY_BRIEF_BUDGET_KEY = "last_budgeted_ai_refresh";
const BUDGET_AI_MODEL = "@cf/meta/llama-3.2-3b-instruct";

export { isDailyBriefRoute };

export async function handleDailyBriefRequest(request, env, ctx) {
  // Dashboard reads remain AI-free. Market snapshots may refresh in the
  // background, but opening Joy never spends Workers AI neurons.
  if (ctx?.waitUntil) {
    ctx.waitUntil(refreshFocusedMarketSignals(withoutAi(env)).catch((error) => {
      console.error("Joy focused Daily Brief background refresh failed", error);
    }));
  }

  const response = await handlePolicyDailyBriefRequest(request, withoutAi(env), ctx);
  return buildVisibleDailyBriefResponse(response);
}

export async function buildVisibleDailyBriefResponse(response) {
  const contentType = response?.headers?.get?.("Content-Type") || "";
  if (!response?.ok || !contentType.includes("application/json")) return response;

  const originalPayload = await response.json();
  const focusedPayload = focusDailyBriefPayload(originalPayload);
  const originalStories = Array.isArray(originalPayload?.stories) ? originalPayload.stories : [];

  // Keep focused stories as the preferred experience. The classifier is
  // intentionally strict, though, and can match nothing for long periods.
  // Fall back to already policy-approved stories so the dashboard does not
  // show an empty Daily Brief while valid content exists.
  const payload = focusedPayload.stories.length || !originalStories.length
    ? focusedPayload
    : {
        ...originalPayload,
        stories: originalStories.slice(0, 12),
        focus: focusedPayload.focus,
        focusFallback: true,
      };

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.delete("Content-Length");
  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function runDailyBriefSchedule(env) {
  if (!env?.DB) return { skipped: true, reason: "storage-unavailable" };

  const now = Date.now();
  const aiEnabled = isDailyBriefAiEnabled(env);
  const lastRun = await readBudgetTimestamp(env);
  const useAi = aiEnabled && now - lastRun >= DAILY_BRIEF_AI_INTERVAL_MS;

  // Reserve the AI window before inference so a failed or quota-limited call
  // cannot be retried by the every-minute cron. RSS and market refreshes still
  // continue without AI during the remaining budget window.
  if (useAi) await writeBudgetTimestamp(env, now);
  const scheduledEnv = useAi ? withBudgetAi(env) : withoutAi(env);

  let policyResult = null;
  let policyError = "";
  try {
    policyResult = await runPolicyDailyBriefSchedule(scheduledEnv);
  } catch (error) {
    policyError = String(error?.message || error || "policy-refresh-failed");
    console.error("Joy Daily Brief policy refresh failed", error);
  }

  let marketResult = null;
  let marketError = "";
  try {
    marketResult = await refreshFocusedMarketSignals(scheduledEnv, { useAi });
  } catch (error) {
    marketError = String(error?.message || error || "market-refresh-failed");
    console.error("Joy focused Daily Brief market refresh failed", error);
  }

  return {
    skipped: false,
    aiUsed: useAi,
    aiReason: aiEnabled ? (useAi ? "budget-window-open" : "budget-window-closed") : "disabled",
    policyResult,
    policyError: policyError || null,
    marketResult,
    marketError: marketError || null,
  };
}

function isDailyBriefAiEnabled(env) {
  return String(env?.DAILY_BRIEF_AI_ENABLED || "").trim().toLowerCase() === "true";
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
