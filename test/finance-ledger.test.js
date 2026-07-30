import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { summarizeFinanceTransactions, validateFinanceTransaction } from "../worker/finance-ledger.js";

function tx(overrides) {
  const occurred_on = overrides.occurred_on || "2026-01-01";
  return {
    id: crypto.randomUUID(),
    occurred_on,
    year: Number(occurred_on.slice(0, 4)),
    month: Number(occurred_on.slice(5, 7)),
    type: "income",
    category: "other-income",
    amount: 0,
    status: "actual",
    ...overrides,
  };
}

test("Carryover is shown in monthly income but excluded from annual income", () => {
  const summary = summarizeFinanceTransactions([
    tx({ category: "carryover", amount: 1_000_000 }),
    tx({ category: "allowance", amount: 4_500_000 }),
    tx({ type: "expense", category: "home", amount: 3_900_000 }),
  ], { year: 2026, selectedMonth: "2026-01" });

  assert.equal(summary.current.actual.income, 5_500_000);
  assert.equal(summary.current.actual.remaining, 1_600_000);
  assert.equal(summary.annual.currentBalance, 1_600_000);
  assert.equal(summary.annual.actualIncome, 4_500_000);
});

test("Closing balance automatically becomes next month's Carryover", () => {
  const summary = summarizeFinanceTransactions([
    tx({ category: "allowance", amount: 5_000_000 }),
    tx({ type: "expense", category: "meals", amount: 1_000_000 }),
    tx({ occurred_on: "2026-02-01", category: "sale", amount: 2_000_000 }),
  ], { year: 2026, selectedMonth: "2026-02" });

  assert.equal(summary.months[0].actual.remaining, 4_000_000);
  assert.equal(summary.months[1].actual.carryover, 4_000_000);
  assert.equal(summary.months[1].actual.remaining, 6_000_000);
});

test("Planned transactions affect projection but not actual balance", () => {
  const summary = summarizeFinanceTransactions([
    tx({ category: "allowance", amount: 4_500_000 }),
    tx({ occurred_on: "2026-02-01", category: "allowance", amount: 4_500_000, status: "planned" }),
    tx({ occurred_on: "2026-02-02", type: "expense", category: "home", amount: 3_900_000, status: "planned" }),
  ], { year: 2026, selectedMonth: "2026-02" });

  assert.equal(summary.current.actual.remaining, 4_500_000);
  assert.equal(summary.current.projected.remaining, 5_100_000);
  assert.equal(summary.annual.actualIncome, 4_500_000);
  assert.equal(summary.annual.projectedIncome, 9_000_000);
});

test("Transaction validation accepts the requested category model", () => {
  const result = validateFinanceTransaction({
    type: "expense",
    category: "money-leaks",
    subcategory: "Mistakes",
    amount: 70_000,
    occurred_on: "2026-07-27",
    status: "actual",
    note: "Mất tiền ngu",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.amount, 70_000);
});

test("Finance runtime reads D1 directly without a bundled personal seed", async () => {
  const router = await readFile(new URL("../worker/router.js", import.meta.url), "utf8");
  const ledger = await readFile(new URL("../worker/finance-ledger.js", import.meta.url), "utf8");

  assert.match(router, /from "\.\/finance-ledger\.js"/);
  assert.doesNotMatch(router, /finance-with-seed/);
  assert.match(ledger, /source: "Joy Finance"/);
  assert.doesNotMatch(ledger, /Finance Tracker 2026 imported once/);

  await assert.rejects(
    access(new URL("../worker/finance-with-seed.js", import.meta.url)),
    (error) => error?.code === "ENOENT",
  );
});
