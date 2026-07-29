import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import {
  FINANCE_BREAKDOWN_CUTOFF,
  FINANCE_EXPENSE_RESET_IMPORT_KEY,
  financeBreakdownSeedForMigration,
  financeBreakdownSeedTotals,
  validateFinanceBreakdownPayload,
} from "../worker/finance-breakdown-policy.js";

const root = new URL("../", import.meta.url);
const workerSource = await readFile(new URL("worker/finance-with-seed.js", root), "utf8");
const frontendSource = await readFile(new URL("project-data/finance/finance-breakdown-v2.js", root), "utf8");
const frontendStyles = await readFile(new URL("project-data/finance/finance-breakdown-v2.css", root), "utf8");
const injectSource = await readFile(new URL("scripts/inject-finance-v3.mjs", root), "utf8");

function payload(overrides = {}) {
  return {
    type: "expense",
    category: "home",
    subcategory: "Rent",
    amount: 3_900_000,
    occurred_on: FINANCE_BREAKDOWN_CUTOFF,
    status: "planned",
    ...overrides,
  };
}

test("January through July remain compatible with aggregate category totals", () => {
  assert.equal(validateFinanceBreakdownPayload(payload({ occurred_on: "2026-07-31", subcategory: "" })), "");
});

test("August onward requires a valid configured expense detail", () => {
  assert.equal(validateFinanceBreakdownPayload(payload({ subcategory: "" })), "FINANCE_SUBCATEGORY_REQUIRED");
  assert.equal(validateFinanceBreakdownPayload(payload({ subcategory: "Unknown" })), "FINANCE_SUBCATEGORY_INVALID");
  assert.equal(validateFinanceBreakdownPayload(payload({ subcategory: "Household shopping" })), "");
  assert.equal(validateFinanceBreakdownPayload(payload({ type: "income", category: "other-income", subcategory: "" })), "");
});

test("Detailed migration preserves planned category totals", () => {
  assert.deepEqual(financeBreakdownSeedTotals(), {
    "8:home": 580_000,
    "8:haircare": 150_000,
    "10:home": 3_900_000,
  });
});

test("Edited legacy totals are not duplicated", () => {
  const migrated = financeBreakdownSeedForMigration(["sheet-2026-08-expense-home"]);
  assert.equal(migrated.some((transaction) => transaction.month === 8 && transaction.category === "home"), false);
  assert.equal(migrated.some((transaction) => transaction.month === 8 && transaction.category === "haircare"), true);
});

test("Seed, breakdown, reset and validation run through one Worker entry point", () => {
  assert.equal(FINANCE_EXPENSE_RESET_IMPORT_KEY, "finance-expenses-2026-08-12-reset-v1");
  assert.match(workerSource, /ensureFinanceTrackerImport\(email, env\)/);
  assert.match(workerSource, /ensureFinanceBreakdownImport\(email, env\)/);
  assert.match(workerSource, /ensureFinanceExpenseReset\(email, env\)/);
  assert.match(workerSource, /validateFinanceBreakdownPayload\(body\)/);
  assert.match(workerSource, /FINANCE_EXPENSE_RESET_IMPORT_KEY/);
  assert.match(workerSource, /month BETWEEN 8 AND 12/);
  assert.match(workerSource, /type = 'expense'/);
});

test("Expense map and unified amount policy are loaded in deterministic order", () => {
  const breakdownIndex = injectSource.indexOf("finance-breakdown-v2.js");
  const amountIndex = injectSource.indexOf("finance-amount-policy-v3.js");
  assert.ok(breakdownIndex >= 0);
  assert.ok(amountIndex > breakdownIndex);
  assert.match(injectSource, /finance-breakdown-v2\.css/);
  assert.match(frontendSource, /Expense mind map/);
  assert.match(frontendSource, /data-finance-month-mode="breakdown"/);
  assert.match(frontendStyles, /finance-map-branch/);
  assert.match(frontendStyles, /prefers-reduced-motion/);
});

test("New Finance modules pass syntax checks", () => {
  for (const path of [
    "project-data/finance/finance-amount-policy-v3.js",
    "project-data/finance/finance-breakdown-v2.js",
    "worker/finance-breakdown-policy.js",
    "worker/finance-with-seed.js",
    "scripts/inject-finance-v3.mjs",
  ]) {
    const result = spawnSync(process.execPath, ["--check", path], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${path}\n${result.stderr || result.stdout}`);
  }
});
