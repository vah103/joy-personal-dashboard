import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const financeSource = await readFile(new URL("../src/features/finance/finance.js", import.meta.url), "utf8");
const monthLayout = await readFile(new URL("../src/features/finance/finance-month-layout.js", import.meta.url), "utf8");
const monthLayoutStyles = await readFile(new URL("../src/features/finance/finance-month-layout.css", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8");
const financeBundleSource = await readFile(new URL("../scripts/build-finance-bundle.mjs", import.meta.url), "utf8");

test("Finance UI sources parse before deployment", () => {
  assert.doesNotThrow(() => new Function(financeSource));
  assert.doesNotThrow(() => new Function(monthLayout));
});

test("Finance Month view is rendered directly with expandable categories", () => {
  assert.match(financeSource, /function renderMonthView\(content\)/);
  assert.match(financeSource, /finance-ledger-board/);
  assert.match(financeSource, /data-ledger-subcategory/);
  assert.match(financeSource, /finance-ledger-composer/);
  assert.match(financeSource, /bindInlineCategoryForms/);
});

test("Finance Month uses a two-thirds current month and one-third next-month summary", () => {
  assert.doesNotMatch(monthLayout, /MutationObserver/);
  assert.doesNotMatch(monthLayout, /renderMonthView\s*=/);
  assert.doesNotMatch(monthLayout, /renderYearView\s*=/);
  assert.match(monthLayout, /window\.JoyFinanceLayout = Object\.freeze/);
  assert.match(monthLayout, /finance-month-split/);
  assert.match(monthLayoutStyles, /finance-ledger-board/);
  assert.match(monthLayout, /grid-template-columns:minmax\(0,2fr\) minmax\(270px,1fr\)/);
  assert.match(monthLayout, /Next month/);
  assert.match(monthLayout, /data-open-next-month/);
  assert.doesNotMatch(monthLayout, />New income</);
});

test("Finance Month navigation shares the Month and Year tab row", () => {
  assert.match(monthLayout, /finance-tab-month-nav/);
  assert.match(monthLayout, /syncMonthTabNavigation/);
  assert.match(monthLayout, /data-tab-month-shift/);
  assert.doesNotMatch(monthLayout, /finance-month-toolbar/);
});

test("Finance Month removes the repeated summary row and enlarges categories", () => {
  assert.doesNotMatch(monthLayout, /finance-ledger-summary-two/);
  assert.match(monthLayout, /finance-ledger-item-copy b\{font-size:12\.5px\}/);
  assert.match(monthLayout, /finance-ledger-item-button>strong\{font-size:11\.5px\}/);
});

test("Finance Month header fills the available width", () => {
  assert.match(monthLayout, /grid-template-columns:minmax\(0,1fr\) 238px/);
  assert.match(monthLayout, /width:238px;min-width:238px/);
  assert.match(monthLayout, /background:linear-gradient\(135deg,rgba\(255,255,255,\.92\)/);
  assert.match(monthLayout, /finance-ledger-hero>div:first-child::before/);
});

test("Finance privacy only masks the dashboard", () => {
  assert.match(financeSource, /financeData\?\.classList\.toggle\("finance-values-hidden"/);
});

test("Cloudflare build composes canonical Finance JS and CSS bundles", () => {
  assert.match(financeBundleSource, /finance-amount-core\.js/);
  assert.match(financeBundleSource, /finance-dashboard\.js/);
  assert.match(financeBundleSource, /finance-month-layout\.js/);
  assert.match(financeBundleSource, /finance-month-layout\.css/);
  assert.match(financeBundleSource, /writeFile\(resolve\(dist, "finance-demo\.js"\), financeBundle\)/);
  assert.match(financeBundleSource, /writeFile\(resolve\(dist, "finance-demo\.css"\), financeCssBundle\)/);
  assert.doesNotMatch(financeBundleSource, /index\.html|replaceAll?\(/);
  assert.match(dashboard, /finance-demo\.js\?v=joy-finance-core-v10/);
  assert.match(dashboard, /finance-demo\.css\?v=joy-finance-core-v5/);
  assert.doesNotMatch(dashboard, /finance-layout-v2/);
});
