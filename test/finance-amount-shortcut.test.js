import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("project-data/finance/finance-amount-shortcut-v1.js", root), "utf8");
const buildSource = await readFile(new URL("scripts/build.mjs", root), "utf8");
const postBuildSource = await readFile(new URL("scripts/cache-bust-turtlebot-plan.mjs", root), "utf8");

function loadShortcutApi() {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.JoyFinanceAmountShortcuts;
}

test("Finance short amounts are interpreted as thousands of VND", () => {
  const api = loadShortcutApi();
  assert.equal(api.normalizeAmountInput("50"), 50_000);
  assert.equal(api.normalizeAmountInput("150"), 150_000);
  assert.equal(api.normalizeAmountInput("800"), 800_000);
  assert.equal(api.normalizeAmountInput("3900"), 3_900_000);
});

test("Fully entered large VND amounts remain unchanged", () => {
  const api = loadShortcutApi();
  assert.equal(api.normalizeAmountInput("3900000"), 3_900_000);
  assert.equal(api.normalizeAmountInput("10000000"), 10_000_000);
});

test("Existing transactions display a safe short value when editable", () => {
  const api = loadShortcutApi();
  assert.equal(api.amountInputDisplayValue(50_000), "50");
  assert.equal(api.amountInputDisplayValue(150_000), "150");
  assert.equal(api.amountInputDisplayValue(3_900_000), "3900");
  assert.equal(api.amountInputDisplayValue(10_000_000), "10000000");
});

test("Cloudflare build loads and cache-busts the Finance amount shortcut", () => {
  const breakdownIndex = buildSource.indexOf("finance-breakdown-v1.js?v=joy-finance-breakdown-v1");
  const shortcutIndex = buildSource.indexOf("finance-amount-shortcut-v1.js?v=joy-finance-amount-shortcut-v1");
  assert.ok(breakdownIndex >= 0);
  assert.ok(shortcutIndex > breakdownIndex);
  assert.match(postBuildSource, /joy-finance-amount-shortcut-v3/);
});

test("Post-build output removes the browser step mismatch for Income and Expense", () => {
  assert.match(postBuildSource, /finance\.replaceAll\('step="1000"', 'step="1"'\)/);
  assert.match(source, /input\.step = "1"/);
  assert.match(source, /pointerdown/);
  assert.match(source, /requestSubmit\(\)/);
});