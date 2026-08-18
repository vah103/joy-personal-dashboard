import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  monthHeading,
  parseSaleLedger,
  validateSaleDeal,
} from "../worker/finance-sales.js";

const appSource = fs.readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");
const routerSource = fs.readFileSync(new URL("../worker/router.js", import.meta.url), "utf8");
const saleManagerSource = fs.readFileSync(new URL("../src/features/sales/manager/manager.js", import.meta.url), "utf8");

test("finance summary uses the dedicated D1 ledger route", () => {
  assert.ok(routerSource.includes('from "./finance-ledger.js"'));
  assert.ok(!routerSource.includes("finance-with-seed"));
  assert.ok(routerSource.includes("isFinanceLedgerRoute(pathname)"));
  assert.ok(routerSource.includes("handleFinanceLedgerRequest(request, env)"));
  assert.ok(!appSource.includes("getFinanceSummary"));
  assert.ok(!appSource.includes("parseFinanceTracker"));
});

test("Sale Manager follows the current month returned by the backend", () => {
  assert.match(saleManagerSource, /selectedMonth:\s*""/);
  assert.match(saleManagerSource, /payload\.selectedMonth/);
  assert.doesNotMatch(saleManagerSource, /selectedMonth:\s*"2026-07"/);
  assert.doesNotMatch(saleManagerSource, /\|\|\s*"2026-07"/);
  assert.doesNotMatch(saleManagerSource, /state\.months\[6\]/);
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
