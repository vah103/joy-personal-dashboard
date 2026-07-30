import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const financeCoreSource = await readFile(new URL("src/features/finance/finance.js", root), "utf8");
const amountCoreSource = await readFile(new URL("src/features/finance/finance-amount-core.js", root), "utf8");
const dashboardHtml = await readFile(new URL("src/pages/dashboard/index.html", root), "utf8");
const buildSource = await readFile(new URL("scripts/build.mjs", root), "utf8");
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const window = {};
vm.runInNewContext(amountCoreSource, { window });
const { inputValue: financeAmountInputValue, parse: parseFinanceAmount } = window.JoyFinanceAmount;

test("Finance shorthand amounts are converted once to full VND", () => {
  assert.equal(parseFinanceAmount("1"), 1_000);
  assert.equal(parseFinanceAmount("40"), 40_000);
  assert.equal(parseFinanceAmount("50"), 50_000);
  assert.equal(parseFinanceAmount("150"), 150_000);
  assert.equal(parseFinanceAmount("800"), 800_000);
  assert.equal(parseFinanceAmount("3900"), 3_900_000);
  assert.equal(parseFinanceAmount("10000"), 10_000);
});

test("Finance accepts correctly grouped full VND amounts", () => {
  assert.equal(parseFinanceAmount("50.000"), 50_000);
  assert.equal(parseFinanceAmount("3.900.000"), 3_900_000);
  assert.equal(parseFinanceAmount("3,900,000"), 3_900_000);
  assert.equal(parseFinanceAmount("10 000 000"), 10_000_000);
});

test("Finance rejects invalid or ambiguous amount text", () => {
  for (const value of ["", "0", "-40", "40.5", "3,9", "3.90.000", "3,900.000", "abc", "50k"]) {
    assert.equal(Number.isNaN(parseFinanceAmount(value)), true, value);
  }
});

test("Finance edit mode converts stored VND to a safe shorthand", () => {
  assert.equal(financeAmountInputValue(40_000), "40");
  assert.equal(financeAmountInputValue(150_000), "150");
  assert.equal(financeAmountInputValue(3_900_000), "3900");
  assert.equal(financeAmountInputValue(10_000_000), "10000000");
});

test("Production Finance source owns parsing in both save paths", () => {
  assert.doesNotMatch(financeCoreSource, /name="amount" type="number"/);
  assert.doesNotMatch(financeCoreSource, /step="1000"/);
  assert.match(financeCoreSource, /const amount = financeAmount\.parse\(form\.elements\.amount\?\.value\);/);
  assert.match(financeCoreSource, /payload\.amount = financeAmount\.parse\(payload\.amount\);/);
  assert.match(financeCoreSource, /transaction \? financeAmount\.inputValue\(transaction\.amount\) : ""/);
  assert.doesNotMatch(financeCoreSource, /Number\(form\.elements\.amount\?\.value/);
  assert.doesNotMatch(financeCoreSource, /payload\.amount = Number\(payload\.amount\)/);
  assert.doesNotThrow(() => new vm.Script(financeCoreSource));
});

test("Finance amount parser loads directly before the core bundle", () => {
  const amountIndex = dashboardHtml.indexOf("finance-amount-core.js?v=joy-finance-amount-v1");
  const financeIndex = dashboardHtml.indexOf("finance-demo.js?v=joy-finance-core-v9");
  assert.ok(amountIndex >= 0);
  assert.ok(financeIndex > amountIndex);
  assert.match(buildSource, /\[resolve\(features, "finance", "finance-amount-core\.js"\), "finance-amount-core\.js"\]/);
  const build = packageJson.scripts.build;
  assert.match(build, /scripts\/build\.mjs/);
  assert.doesNotMatch(build, /patch-finance-core-amount/);
});
