import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardSource = await readFile(new URL("../project-data/finance/finance-dashboard-v1.js", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("Finance outer dashboard uses the sharp visual system", () => {
  assert.match(dashboardSource, /finance-dashboard-polished/);
  assert.match(dashboardSource, /font-family:\"Instrument Sans\"/);
  assert.match(dashboardSource, /finance-period-button/);
  assert.match(dashboardSource, /grid-template-columns:minmax\(175px,1\.42fr\)/);
});

test("Finance outer dashboard removes redundant header actions", () => {
  assert.match(dashboardSource, /finance-add-expense\"\)\?\.remove/);
  assert.match(dashboardSource, /querySelector\(\"\[data-finance-open\]\"\)\?\.remove/);
  assert.match(dashboardSource, /openFinanceWorkspace\(\"month\"\)/);
});

test("Finance outer dashboard displays full values and English chart months", () => {
  assert.match(dashboardSource, /element\.dataset\.financeValue = formatVnd\(amount\)/);
  assert.match(dashboardSource, /\[\"Jan\", \"Feb\", \"Mar\"/);
  assert.match(dashboardSource, /useEnglishChartMonths/);
});

test("Cloudflare build loads the outer Finance dashboard module", () => {
  assert.match(buildSource, /project-data\/finance\/finance-dashboard-v1\.js\?v=joy-finance-dashboard-v1/);
});
