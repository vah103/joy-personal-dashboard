import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const financeCoreSource = await readFile(new URL("src/features/finance/finance.js", root), "utf8");
const amountCoreSource = await readFile(new URL("src/features/finance/finance-amount-core.js", root), "utf8");
const bundleSource = await readFile(new URL("scripts/build-finance-bundle.mjs", root), "utf8");
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

test("Finance build composes canonical sources without patching the bundle", () => {
  assert.match(bundleSource, /finance-amount-core\.js/);
  assert.match(bundleSource, /src", "features", "finance", "finance\.js/);
  assert.match(bundleSource, /writeFile\(financeBundlePath, bundle\)/);
  assert.match(bundleSource, /joy-finance-core-v9/);
  assert.doesNotMatch(bundleSource, /replaceExact|patchFinanceCore|parserAnchor/);

  const build = packageJson.scripts.build;
  const canonicalIndex = build.indexOf("scripts/build.mjs");
  const financeBundleIndex = build.indexOf("scripts/build-finance-bundle.mjs");
  const p1008Index = build.indexOf("scripts/cache-bust-finance-p1008.mjs");
  assert.ok(canonicalIndex >= 0);
  assert.ok(financeBundleIndex > canonicalIndex);
  assert.ok(p1008Index > financeBundleIndex);
  assert.doesNotMatch(build, /patch-finance-core-amount/);
});
