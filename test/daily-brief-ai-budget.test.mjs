import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const budgetPath = new URL("worker/daily-brief-budget.js", root);
const focusPath = new URL("worker/daily-brief-focus.js", root);
const routerPath = new URL("worker/router.js", root);
const wranglerPath = new URL("wrangler.jsonc", root);

const [budget, focus, router, wrangler] = await Promise.all([
  readFile(budgetPath, "utf8"),
  readFile(focusPath, "utf8"),
  readFile(routerPath, "utf8"),
  readFile(wranglerPath, "utf8"),
]);

test("Daily Brief dashboard reads do not consume Workers AI", () => {
  assert.match(budget, /handlePolicyDailyBriefRequest\(request, withoutAi\(env\), ctx\)/);
  assert.match(budget, /if \(property === "AI"\) return undefined/);
  assert.match(budget, /buildVisibleDailyBriefResponse\(response\)/);
  assert.match(router, /from "\.\/daily-brief-budget\.js"/);
});

test("Daily Brief AI is enabled only through the six-hour budget path", () => {
  assert.match(wrangler, /"DAILY_BRIEF_AI_ENABLED"\s*:\s*"true"/);
  assert.match(budget, /6 \* 60 \* 60 \* 1000/);
  assert.match(budget, /@cf\/meta\/llama-3\.2-3b-instruct/);
  assert.match(budget, /last_budgeted_ai_refresh/);
  assert.match(budget, /const useAi = aiEnabled && now - lastRun >= DAILY_BRIEF_AI_INTERVAL_MS/);
  assert.match(budget, /useAi \? withBudgetAi\(env\) : withoutAi\(env\)/);
});

test("RSS and market refreshes continue when the AI window is closed", () => {
  assert.match(budget, /runPolicyDailyBriefSchedule\(scheduledEnv\)/);
  assert.match(budget, /refreshFocusedMarketSignals\(scheduledEnv, \{ useAi \}\)/);
  assert.match(focus, /30 \* 60 \* 1000/);
  assert.match(focus, /api\.coingecko\.com\/api\/v3\/simple\/price/);
  assert.match(focus, /extractBaoTinManhHaiGoldQuote/);
});

test("Daily Brief focused files pass syntax checks", () => {
  for (const path of [budgetPath, focusPath, routerPath]) {
    const result = spawnSync(process.execPath, ["--check", fileURLToPath(path)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
