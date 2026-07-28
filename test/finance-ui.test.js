import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const financeSource = await readFile(new URL("../src/features/finance/finance.js", import.meta.url), "utf8");
const financeOverlay = await readFile(new URL("../project-data/finance/finance-layout-v2.js", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("Finance UI source parses before deployment", () => {
  assert.doesNotThrow(() => new Function(financeSource));
  assert.doesNotThrow(() => new Function(financeOverlay));
});

test("Finance Month view is rendered directly with expandable categories", () => {
  assert.match(financeSource, /function renderMonthView\(content\)/);
  assert.match(financeSource, /finance-ledger-board/);
  assert.match(financeSource, /data-ledger-subcategory/);
  assert.match(financeSource, /finance-ledger-composer/);
  assert.match(financeSource, /bindInlineCategoryForms/);
});

test("Finance Month uses a two-thirds current month and one-third next-month summary", () => {
  assert.doesNotMatch(financeOverlay, /MutationObserver/);
  assert.match(financeOverlay, /finance-month-split/);
  assert.match(financeOverlay, /grid-template-columns:minmax\(0,2fr\) minmax\(270px,1fr\)/);
  assert.match(financeOverlay, /Next month/);
  assert.match(financeOverlay, /data-open-next-month/);
  assert.doesNotMatch(financeOverlay, />New income</);
});

test("Finance privacy only masks the dashboard", () => {
  assert.match(financeSource, /financeData\?\.classList\.toggle\("finance-values-hidden"/);
});

test("Cloudflare build loads the direct Finance renderer and month layout", () => {
  assert.match(buildSource, /finance-demo\.js\?v=joy-finance-core-v4/);
  assert.match(buildSource, /project-data\/finance\/finance-layout-v2\.js/);
});
