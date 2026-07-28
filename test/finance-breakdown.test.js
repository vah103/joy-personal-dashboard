import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import {
  FINANCE_BREAKDOWN_CUTOFF,
  financeBreakdownSeedTotals,
  validateFinanceBreakdownPayload,
} from "../worker/finance-breakdown-policy.js";

const root = new URL("../", import.meta.url);
const frontendSource = await readFile(new URL("project-data/finance/finance-breakdown-v1.js", root), "utf8");
const frontendStyles = await readFile(new URL("project-data/finance/finance-breakdown-v1.css", root), "utf8");

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

test("August onward requires a valid subcategory when the category has details", () => {
  assert.equal(validateFinanceBreakdownPayload(payload({ subcategory: "" })), "FINANCE_SUBCATEGORY_REQUIRED");
  assert.equal(validateFinanceBreakdownPayload(payload({ subcategory: "Unknown" })), "FINANCE_SUBCATEGORY_INVALID");
  assert.equal(validateFinanceBreakdownPayload(payload({ subcategory: "Household shopping" })), "");
});

test("Leaf expense categories remain valid without a subcategory", () => {
  assert.equal(validateFinanceBreakdownPayload(payload({ category: "dating", subcategory: "" })), "");
});

test("Detailed seed preserves the existing planned category totals", () => {
  assert.deepEqual(financeBreakdownSeedTotals(), {
    "8:home": 580_000,
    "8:haircare": 150_000,
    "10:home": 3_900_000,
  });
});

test("Finance month UI includes overview, expense map, mind-map branches and transitions", () => {
  assert.match(frontendSource, /data-finance-month-view="overview"/);
  assert.match(frontendSource, /data-finance-month-view="breakdown"/);
  assert.match(frontendSource, /Expense mind map/);
  assert.match(frontendStyles, /finance-map-branch-in/);
  assert.match(frontendStyles, /prefers-reduced-motion/);
  assert.doesNotThrow(() => new Function(frontendSource));
});

test("Finance breakdown worker modules pass syntax checks", () => {
  for (const path of ["worker/finance-breakdown-policy.js", "worker/finance-breakdown.js", "project-data/finance/finance-breakdown-v1.js"]) {
    const result = spawnSync(process.execPath, ["--check", path], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
