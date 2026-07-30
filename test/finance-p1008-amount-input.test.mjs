import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const amountCoreSource = await readFile(new URL("src/features/finance/finance-amount-core.js", root), "utf8");
const p1008AmountSource = await readFile(new URL("project-data/finance/finance-p1008-amount-input-v1.js", root), "utf8");
const dashboard = await readFile(new URL("src/pages/dashboard/index.html", root), "utf8");

const window = {};
vm.runInNewContext(amountCoreSource, { window });
vm.runInNewContext(p1008AmountSource, { globalThis: window, Intl, Number, Object, String });
const amountInput = window.JoyP1008AmountInput;

test("P1008 shorthand amount entry expands thousands exactly once", () => {
  assert.equal(amountInput.parseCommit("570"), 570_000);
  assert.equal(amountInput.parseCommit("2300"), 2_300_000);
  assert.equal(amountInput.parseCommit("570000"), 570_000);
  assert.equal(amountInput.parseCommit("570.000"), 570_000);
  assert.equal(amountInput.parseCommit("2.300.000"), 2_300_000);
});

test("P1008 amount edit mode uses compact values and formatted display values", () => {
  assert.equal(amountInput.editValue(570_000), "570");
  assert.equal(amountInput.editValue(2_300_000), "2300");
  assert.equal(amountInput.displayValue(570_000), "570.000");
  assert.equal(amountInput.displayValue(2_300_000), "2.300.000");
});

test("P1008 stops live thousand formatting so mobile zero entry keeps its caret", () => {
  assert.match(p1008AmountSource, /document\.addEventListener\("input"/);
  assert.match(p1008AmountSource, /event\.stopImmediatePropagation\(\)/);
  assert.match(p1008AmountSource, /sanitizeDigits\(event\.target\)/);
  assert.doesNotMatch(p1008AmountSource, /formatNumber\(.*input\.value/);
  assert.match(p1008AmountSource, /Nhập 570 để lưu 570\.000 ₫/);
});

test("canonical dashboard loads the P1008 amount helper after both shopping scripts", () => {
  const shopping = "finance-p1008-shopping-v1.js?v=joy-finance-p1008-shopping-v1";
  const tables = "finance-p1008-shopping-tables-v1.js?v=joy-finance-p1008-shopping-tables-v3";
  const amount = "finance-p1008-amount-input-v1.js?v=joy-finance-p1008-amount-input-v1";
  assert.ok(dashboard.indexOf(shopping) < dashboard.indexOf(tables));
  assert.ok(dashboard.indexOf(tables) < dashboard.indexOf(amount));
});
