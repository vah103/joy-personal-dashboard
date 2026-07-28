import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../", import.meta.url);
const budgetPath = new URL("worker/daily-brief-budget.js", root);
const routerPath = new URL("worker/router.js", root);

const [budget, router] = await Promise.all([
  readFile(budgetPath, "utf8"),
  readFile(routerPath, "utf8"),
]);

test("Daily Brief dashboard reads do not consume Workers AI", () => {
  assert.match(budget, /handlePolicyDailyBriefRequest\(request, withoutAi\(env\), ctx\)/);
  assert.match(budget, /if \(property === "AI"\) return undefined/);
  assert.match(router, /from "\.\/daily-brief-budget\.js"/);
});

test("Daily Brief scheduled AI is limited and uses a smaller model", () => {
  assert.match(budget, /6 \* 60 \* 60 \* 1000/);
  assert.match(budget, /@cf\/meta\/llama-3\.2-3b-instruct/);
  assert.match(budget, /last_budgeted_ai_refresh/);
  assert.match(budget, /await writeBudgetTimestamp\(env, now\)/);
  assert.match(budget, /runPolicyDailyBriefSchedule\(withBudgetAi\(env\)\)/);
});

test("Daily Brief AI budget files pass syntax checks", () => {
  for (const path of [budgetPath, routerPath]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
