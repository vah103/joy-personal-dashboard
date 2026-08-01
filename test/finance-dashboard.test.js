import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardSource = await readFile(new URL("../src/features/finance/finance-dashboard.js", import.meta.url), "utf8");
const dashboardSummarySource = await readFile(new URL("../src/features/finance/finance-dashboard-summary.js", import.meta.url), "utf8");
const financeCoreSource = await readFile(new URL("../src/features/finance/finance.js", import.meta.url), "utf8");
const dashboardThemeSource = await readFile(new URL("../src/features/theme/dashboard-openai-headings.css", import.meta.url), "utf8");
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

test("only the outer Finance card switches to full VND values", () => {
  assert.match(financeCoreSource, /element\.dataset\.financeValue = formatCompactVnd\(amount\)/);
  assert.match(dashboardSummarySource, /element\.dataset\.financeValue = formatVnd\(amount\)/);
  assert.match(dashboardSummarySource, /finance-full-money-values/);
  assert.match(dashboardSummarySource, /"year-end": financeSummary\?\.annual\?\.projectedYearEnd/);
  assert.match(dashboardThemeSource, /finance-full-money-values \.finance-available > strong/);
  assert.match(dashboardThemeSource, /font-size: clamp\(28px, 2\.65vw, 34px\)/);
  assert.match(dashboardThemeSource, /font-size: clamp\(16px, 1\.45vw, 20px\)/);
  assert.doesNotMatch(financeCoreSource, /setMoneyValue\s*=\s*fullValueSetter/);
});

test("Finance year-end cash value overrides the later injected card rule", () => {
  assert.match(
    dashboardSource,
    /finance-overview>\.finance-overview-stat:nth-child\(4\) strong\{[\s\S]*font-size:clamp\(20px,1\.8vw,23px\);/,
  );
  assert.match(
    dashboardThemeSource,
    /\[data-finance-field="year-end"\] \{[\s\S]*font-size: clamp\(13px, \.88vw, 15px\) !important;[\s\S]*font-weight: 500 !important;[\s\S]*letter-spacing: -\.008em !important;[\s\S]*line-height: 1\.1 !important;/,
  );
});

test("Finance outer dashboard mirrors the popup projected month totals", () => {
  assert.match(dashboardSummarySource, /const projected = financeSummary\?\.current\?\.projected/);
  assert.match(dashboardSummarySource, /remaining: projected\.remaining/);
  assert.match(dashboardSummarySource, /income: projected\.income/);
  assert.match(dashboardSummarySource, /expenses: projected\.expenses/);
  assert.match(dashboardSummarySource, /Closing balance/);
  assert.match(dashboardSummarySource, /Actual \+ planned/);
  assert.match(dashboardSummarySource, /setFinancePrivacy\(financeValuesHidden\)/);

  assert.match(financeCoreSource, /incomeTotal = Number\(month\.projected\?\.income/);
  assert.match(financeCoreSource, /expenseTotal = Number\(month\.projected\?\.expenses/);
  assert.match(financeCoreSource, /closing = Number\(month\.projected\?\.remaining/);
});

test("Finance year-end card uses the supplied coin artwork in taels", () => {
  assert.match(dashboardSummarySource, /const GOLD_HELD_TAEL = 0\.05/);
  assert.match(dashboardSummarySource, /const GOLD_COIN_IMAGE = "data:image\/webp;base64,/);
  assert.match(dashboardSummarySource, /minimumFractionDigits: 2/);
  assert.match(dashboardSummarySource, /return `\$\{amount\} tael`/);
  assert.match(dashboardSummarySource, /finance-year-end-card/);
  assert.match(dashboardSummarySource, /finance-year-end-content/);
  assert.match(dashboardSummarySource, /finance-year-end-gold-icon/);
  assert.match(dashboardSummarySource, /document\.createElement\("img"\)/);
  assert.match(dashboardSummarySource, /image\.src = GOLD_COIN_IMAGE/);
  assert.match(dashboardSummarySource, /image\.decoding = "async"/);
  assert.doesNotMatch(dashboardSummarySource, /<svg viewBox=/);
  assert.match(dashboardSummarySource, /Projected cash balance/);
  assert.doesNotMatch(dashboardSummarySource, /label\.textContent = "Gold held"/);
  assert.doesNotMatch(dashboardSummarySource, /chỉ/);
  assert.match(dashboardSummarySource, /value\.dataset\.financeMask = "•••"/);
  assert.match(dashboardSummarySource, /syncYearEndGoldHolding\(\)/);
  assert.match(dashboardThemeSource, /\.finance-year-end-gold-icon img/);
  assert.match(dashboardThemeSource, /object-fit: cover/);
  assert.match(dashboardThemeSource, /transform: scale\(1\.06\)/);
  assert.doesNotMatch(dashboardThemeSource, /\.finance-year-end-gold-icon svg/);
  assert.doesNotMatch(dashboardThemeSource, /border-top:/);

  const cashValues = dashboardSummarySource.match(/const values = \{([\s\S]*?)\n    \};/)?.[1] || "";
  assert.doesNotMatch(cashValues, /GOLD_HELD_TAEL|gold/i);
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
  assert.match(bundleSource, /finance-dashboard-summary\.js/);
  assert.match(bundleSource, /dashboardSummarySource\.trim\(\)/);
  assert.match(dashboardHtml, /finance-demo\.js\?v=joy-finance-core-v10/);
  assert.doesNotMatch(dashboardHtml, /finance-dashboard-v1\.js/);
});
