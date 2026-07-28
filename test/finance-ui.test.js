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

test("Finance Month navigation shares the Month and Year tab row", () => {
  assert.match(financeOverlay, /finance-tab-month-nav/);
  assert.match(financeOverlay, /syncMonthTabNavigation/);
  assert.match(financeOverlay, /data-tab-month-shift/);
  assert.doesNotMatch(financeOverlay, /finance-month-toolbar/);
});

test("Finance Month removes the repeated summary row and enlarges categories", () => {
  assert.doesNotMatch(financeOverlay, /finance-ledger-summary-two/);
  assert.match(financeOverlay, /finance-ledger-item-copy b\{font-size:12\.5px\}/);
  assert.match(financeOverlay, /finance-ledger-item-button>strong\{font-size:11\.5px\}/);
});

test("Finance Month header uses two balanced cards", () => {
  assert.match(financeOverlay, /grid-template-columns:repeat\(2,minmax\(0,238px\)\)/);
  assert.match(financeOverlay, /background:linear-gradient\(135deg,#466873,#607d78\)/);
  assert.match(financeOverlay, /min-height:94px/);
});

test("Finance privacy only masks the dashboard", () => {
  assert.match(financeSource, /financeData\?\.classList\.toggle\("finance-values-hidden"/);
});

test("Cloudflare build loads the direct Finance renderer and current month layout", () => {
  assert.match(buildSource, /finance-demo\.js\?v=joy-finance-core-v4/);
  assert.match(buildSource, /project-data\/finance\/finance-layout-v2\.js\?v=joy-finance-month-layout-v4/);
});