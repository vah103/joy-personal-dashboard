import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  financeAmountInputValue,
  parseFinanceAmount,
} from "../src/features/finance/finance-amount-core.js";
import {
  patchFinanceCore,
  patchFinanceIndex,
} from "../scripts/patch-finance-core-amount.mjs";

const root = new URL("../", import.meta.url);
const financeCoreSource = await readFile(new URL("src/features/finance/finance.js", root), "utf8");
const amountCoreSource = await readFile(new URL("src/features/finance/finance-amount-core.js", root), "utf8");
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

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

test("Production Finance core owns parsing in both save paths", () => {
  const patched = patchFinanceCore(financeCoreSource, amountCoreSource);

  assert.doesNotMatch(patched, /name="amount" type="number"/);
  assert.doesNotMatch(patched, /step="1000"/);
  assert.match(patched, /const amount = parseFinanceAmount\(form\.elements\.amount\?\.value\);/);
  assert.match(patched, /payload\.amount = parseFinanceAmount\(payload\.amount\);/);
  assert.match(patched, /transaction \? financeAmountInputValue\(transaction\.amount\) : ""/);
  assert.doesNotMatch(patched, /Number\(form\.elements\.amount\?\.value/);
  assert.doesNotMatch(patched, /payload\.amount = Number\(payload\.amount\)/);
  assert.doesNotThrow(() => new vm.Script(patched));
});

test("Finance build cache-busts the patched core from main", () => {
  const index = patchFinanceIndex('<script src="finance-demo.js?v=old" defer></script>');
  assert.match(index, /finance-demo\.js\?v=joy-finance-core-v8/);

  const build = packageJson.scripts.build;
  const canonicalIndex = build.indexOf("scripts/build.mjs");
  const financePatchIndex = build.indexOf("scripts/patch-finance-core-amount.mjs");
  assert.ok(canonicalIndex >= 0);
  assert.ok(financePatchIndex > canonicalIndex);
});
