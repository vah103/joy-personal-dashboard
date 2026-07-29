import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const budgetPath = new URL("worker/daily-brief-budget.js", root);
const routerPath = new URL("worker/router.js", root);
const wranglerPath = new URL("wrangler.jsonc", root);

const [budget, router, wrangler] = await Promise.all([
  readFile(budgetPath, "utf8"),
  readFile(routerPath, "utf8"),
  readFile(wranglerPath, "utf8"),
]);

test("Daily Brief dashboard reads do not consume Workers AI", () => {
  assert.match(budget, /handlePolicyDailyBriefRequest\(request, withoutAi\(env\), ctx\)/);
  assert.match(budget, /if \(property === "AI"\) return undefined/);
  assert.match(router, /from "\.\/daily-brief-budget\.js"/);
});

test("Daily Brief scheduled AI is disabled by default while RSS remains active", () => {
  assert.match(wrangler, /"DAILY_BRIEF_AI_ENABLED"\s*:\s*"false"/);
  assert.match(budget, /if \(!isDailyBriefAiEnabled\(env\)\)/);
  assert.match(budget, /runPolicyDailyBriefSchedule\(withoutAi\(env\)\)/);
  assert.match(budget, /DAILY_BRIEF_AI_ENABLED/);
});

test("Daily Brief keeps an explicit opt-in budget path for later re-enabling", () => {
  assert.match(budget, /6 \* 60 \* 60 \* 1000/);
  assert.match(budget, /@cf\/meta\/llama-3\.2-3b-instruct/);
  assert.match(budget, /last_budgeted_ai_refresh/);
  assert.match(budget, /runPolicyDailyBriefSchedule\(withBudgetAi\(env\)\)/);
});

test("Daily Brief AI budget files pass syntax checks", () => {
  for (const path of [budgetPath, routerPath]) {
    const result = spawnSync(process.execPath, ["--check", fileURLToPath(path)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
