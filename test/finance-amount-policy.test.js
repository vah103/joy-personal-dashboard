import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const policySource = await readFile(new URL("project-data/finance/finance-amount-policy-v3.js", root), "utf8");
const injectSource = await readFile(new URL("scripts/inject-finance-v3.mjs", root), "utf8");
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

function policyApi() {
  const sandbox = { window: {}, Intl, Number };
  vm.runInNewContext(policySource, sandbox);
  return sandbox.window.JoyFinanceAmountPolicy;
}

test("Finance short inputs are interpreted once as thousands of VND", () => {
  const api = policyApi();
  assert.equal(api.parseFinanceAmount("1"), 1_000);
  assert.equal(api.parseFinanceAmount("30"), 30_000);
  assert.equal(api.parseFinanceAmount("50"), 50_000);
  assert.equal(api.parseFinanceAmount("150"), 150_000);
  assert.equal(api.parseFinanceAmount("800"), 800_000);
  assert.equal(api.parseFinanceAmount("3900"), 3_900_000);
});

test("Finance accepts formatted full VND values", () => {
  const api = policyApi();
  assert.equal(api.parseFinanceAmount("50.000"), 50_000);
  assert.equal(api.parseFinanceAmount("3.900.000"), 3_900_000);
  assert.equal(api.parseFinanceAmount("3,900,000"), 3_900_000);
  assert.equal(api.parseFinanceAmount("10 000 000"), 10_000_000);
});

test("Finance rejects empty, zero, negative and alphabetic values", () => {
  const api = policyApi();
  for (const value of ["", "0", "-50", "abc", "50k"]) {
    assert.equal(Number.isNaN(api.parseFinanceAmount(value)), true, value);
  }
});

test("Edit mode converts stored VND amounts back to safe input values", () => {
  const api = policyApi();
  assert.equal(api.financeAmountInputValue(50_000), "50");
  assert.equal(api.financeAmountInputValue(150_000), "150");
  assert.equal(api.financeAmountInputValue(3_900_000), "3900");
  assert.equal(api.financeAmountInputValue(10_000_000), "10000000");
});

test("Unified policy owns both inline and modal submit paths", () => {
  assert.match(policySource, /originalSaveInlineTransaction/);
  assert.match(policySource, /originalSaveFinanceTransaction/);
  assert.match(policySource, /removeEventListener\("submit", originalSaveFinanceTransaction\)/);
  assert.match(policySource, /addEventListener\("submit", saveFinanceTransaction\)/);
  assert.match(policySource, /originalOpenEntryForm/);
  assert.doesNotMatch(policySource, /pointerdown|requestSubmit|addEventListener\("invalid"|addEventListener\("click"/);
});

test("Production Finance bundle removes native step validation", () => {
  assert.match(injectSource, /type=\\?"text\\?" inputmode=\\?"numeric\\?" autocomplete=\\?"off\\?"/);
  assert.match(injectSource, /step=\\?"1000\\?"/);
  assert.match(injectSource, /Finance production bundle still contains native number-step validation/);
});

test("Finance integration runs directly after the canonical build", () => {
  const build = packageJson.scripts.build;
  const coreIndex = build.indexOf("scripts/build.mjs");
  const financeIndex = build.indexOf("scripts/inject-finance-v3.mjs");
  assert.ok(coreIndex >= 0);
  assert.ok(financeIndex > coreIndex);
  assert.match(injectSource, /joy-finance-core-v6/);
  assert.match(injectSource, /joy-finance-amount-policy-v3/);
});
