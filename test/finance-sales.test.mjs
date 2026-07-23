import assert from "node:assert/strict";
import test from "node:test";

import {
  monthHeading,
  parseFinanceTracker,
  parseSaleLedger,
  validateSaleDeal,
} from "../worker/finance-sales.js";

test("reads only finance summary values for the selected month", () => {
  const rows = Array.from({ length: 25 }, () => []);
  rows[1] = [null, "Jan 2026", null, 2_000_000];
  rows[3] = [null, "Income", 10_000_000, "Expenses", 8_000_000];
  rows[21] = [null, "Jul 2026", null, 3_480_000];
  rows[23] = [null, "Income", 14_520_000, "Expenses", 11_040_000];

  const finance = parseFinanceTracker(rows, { selectedMonth: "2026-07" });
  assert.equal(finance.current.label, "July 2026");
  assert.equal(finance.current.income, 14_520_000);
  assert.equal(finance.current.expenses, 11_040_000);
  assert.equal(finance.current.remaining, 3_480_000);
  assert.equal(finance.months.length, 12);
});

test("normalizes a two-row Sale entry and leaves a missing July at zero", () => {
  const rows = [
    [],
    [null, "Jun 2026", null, null, 1_800_000],
    [],
    [null, "Address", "Customer", "Host", "Commission"],
    [null, "20 Example", "Demo Customer", "Demo Host", 1_800_000],
    [null, 3_600_000, "0300000000", 0.5],
  ];

  const ledger = parseSaleLedger(rows);
  const june = ledger.months.find((month) => month.key === "2026-06");
  const july = ledger.months.find((month) => month.key === "2026-07");
  assert.equal(june.count, 1);
  assert.equal(june.deals[0].rent, 3_600_000);
  assert.equal(june.deals[0].rate, 0.5);
  assert.equal(july.count, 0);
  assert.equal(july.total, 0);
});

test("validates new 2026 Sale deals and calculates commission", () => {
  const result = validateSaleDeal({
    month: "2026-07",
    customer: "New customer",
    address: "63 Example",
    host: "Example host",
    phone: "0312345678",
    rent: "3.000.000 đ",
    rate: "40%",
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.rent, 3_000_000);
  assert.equal(result.value.rate, 0.4);
  assert.equal(result.value.commission, 1_200_000);
  assert.equal(monthHeading(result.value.month), "Jul 2026");
});
