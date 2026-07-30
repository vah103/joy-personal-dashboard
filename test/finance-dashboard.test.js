import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardSource = await readFile(new URL("../src/features/finance/finance-dashboard.js", import.meta.url), "utf8");
const dashboardHtml = await readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8");
const bundleSource = await readFile(new URL("../scripts/build-finance-bundle.mjs", import.meta.url), "utf8");

test("Finance outer dashboard uses the money typography at 35px", () => {
  assert.match(dashboardSource, /panel-title-button\{/);
  assert.match(dashboardSource, /color:#2e454d/);
  assert.match(dashboardSource, /font-family:"Instrument Sans",Arial,sans-serif!important/);
  assert.match(dashboardSource, /font-size:35px/);
  assert.match(dashboardSource, /letter-spacing:-\.04em!important/);
  assert.match(dashboardSource, /finance-period-button/);
  assert.match(dashboardSource, /font-size:15px/);
});

test("Finance outer dashboard removes redundant header actions", () => {
  assert.match(dashboardSource, /finance-add-expense"\)\?\.remove/);
  assert.match(dashboardSource, /querySelector\("\[data-finance-open\]"\)\?\.remove/);
  assert.match(dashboardSource, /openFinanceWorkspace\("month"\)/);
});

test("Finance outer dashboard keeps compact money values", () => {
  assert.doesNotMatch(dashboardSource, /setMoneyValue\s*=\s*fullValueSetter/);
  assert.doesNotMatch(dashboardSource, /element\.dataset\.financeValue = formatVnd\(amount\)/);
});

test("Finance chart months stay English after every render", () => {
  assert.match(dashboardSource, /\["Jan", "Feb", "Mar"/);
  assert.match(dashboardSource, /joy:finance-chart-rendered/);
  assert.match(dashboardSource, /joy:finance-dashboard-rendered/);
  assert.doesNotMatch(dashboardSource, /new MutationObserver/);
  assert.doesNotMatch(dashboardSource, /renderFinanceChart\s*=/);
  assert.doesNotMatch(dashboardSource, /renderFinanceDashboard\s*=/);
});

test("Finance outer labels are larger and clearer", () => {
  assert.match(dashboardSource, /finance-overview-stat small\{/);
  assert.match(dashboardSource, /font-size:10\.5px/);
  assert.match(dashboardSource, /font-size:clamp\(19px,1\.75vw,24px\)/);
});

test("dashboard presentation is absorbed into the Finance bundle", () => {
  assert.match(bundleSource, /finance-dashboard\.js/);
  assert.match(dashboardHtml, /finance-demo\.js\?v=joy-finance-core-v10/);
  assert.doesNotMatch(dashboardHtml, /finance-dashboard-v1\.js/);
});
