import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const financeSourceDir = resolve(root, "src", "features", "finance");
const projectFinanceDir = resolve(root, "project-data", "finance");
const dist = resolve(root, "dist");
const distProjectFinanceDir = resolve(dist, "project-data", "finance");

const paths = {
  amount: resolve(financeSourceDir, "finance-amount-core.js"),
  core: resolve(financeSourceDir, "finance.js"),
  beautyCare: resolve(financeSourceDir, "finance-beauty-care.js"),
  dashboard: resolve(financeSourceDir, "finance-dashboard.js"),
  dashboardSummary: resolve(financeSourceDir, "finance-dashboard-summary.js"),
  dashboardGoldLive: resolve(financeSourceDir, "finance-gold-live-value.js"),
  monthLayout: resolve(financeSourceDir, "finance-month-layout.js"),
  coreCss: resolve(financeSourceDir, "finance.css"),
  dashboardGoldLiveCss: resolve(financeSourceDir, "finance-gold-live-value.css"),
  privacyMaskCss: resolve(financeSourceDir, "finance-privacy-mask.css"),
  monthLayoutCss: resolve(financeSourceDir, "finance-month-layout.css"),
  p1008: resolve(projectFinanceDir, "finance-p1008.js"),
  p1008Layout: resolve(financeSourceDir, "finance-p1008-layout.js"),
  p1008Css: resolve(projectFinanceDir, "finance-p1008.css"),
  p1008LayoutCss: resolve(financeSourceDir, "finance-p1008-layout.css"),
};

function extractInlineStyle(source, {
  functionStart,
  nextFunctionStart,
  invocation,
  label,
}) {
  const start = source.indexOf(functionStart);
  const end = source.indexOf(nextFunctionStart, start);
  if (start === -1 || end === -1) {
    throw new Error(`Could not locate ${label} style installer`);
  }

  const block = source.slice(start, end);
  const assignment = "style.textContent = `";
  const cssStart = block.indexOf(assignment);
  const cssEnd = block.lastIndexOf("`;");
  if (cssStart === -1 || cssEnd === -1 || cssEnd <= cssStart) {
    throw new Error(`Could not extract ${label} styles`);
  }

  const css = block.slice(cssStart + assignment.length, cssEnd).trim();
  const javascript = `${source.slice(0, start)}${source.slice(end)}`
    .replace(invocation, "\n")
    .trim();

  if (javascript.includes(functionStart) || javascript.includes(invocation.trim())) {
    throw new Error(`${label} style installer remains in JavaScript bundle`);
  }

  return { css, javascript };
}

const [
  amountSource,
  financeSource,
  beautyCareSource,
  dashboardSource,
  dashboardSummarySource,
  dashboardGoldLiveSource,
  monthLayoutSource,
  financeCss,
  dashboardGoldLiveCss,
  privacyMaskCss,
  monthLayoutCss,
  p1008Source,
  p1008LayoutSource,
  p1008Css,
  p1008LayoutCss,
] = await Promise.all([
  readFile(paths.amount, "utf8"),
  readFile(paths.core, "utf8"),
  readFile(paths.beautyCare, "utf8"),
  readFile(paths.dashboard, "utf8"),
  readFile(paths.dashboardSummary, "utf8"),
  readFile(paths.dashboardGoldLive, "utf8"),
  readFile(paths.monthLayout, "utf8"),
  readFile(paths.coreCss, "utf8"),
  readFile(paths.dashboardGoldLiveCss, "utf8"),
  readFile(paths.privacyMaskCss, "utf8"),
  readFile(paths.monthLayoutCss, "utf8"),
  readFile(paths.p1008, "utf8"),
  readFile(paths.p1008Layout, "utf8"),
  readFile(paths.p1008Css, "utf8"),
  readFile(paths.p1008LayoutCss, "utf8"),
]);

if (!amountSource.includes("JoyFinanceAmount")) {
  throw new Error("Finance amount source does not register JoyFinanceAmount");
}
if (!financeSource.includes("window.JoyFinanceAmount")) {
  throw new Error("Finance core does not consume JoyFinanceAmount");
}
if (!beautyCareSource.includes('label: "Beauty care"')) {
  throw new Error("Finance beauty care category source is missing");
}
if (!dashboardSummarySource.includes("syncProjectedFinanceSummary")) {
  throw new Error("Finance projected dashboard summary source is missing");
}
if (!dashboardGoldLiveSource.includes('const GOLD_PRICE_ENDPOINT = "/api/finance/gold-price"')) {
  throw new Error("Finance live gold value source is missing its price endpoint");
}
if (!privacyMaskCss.includes("finance-values-hidden")) {
  throw new Error("Finance skeleton privacy mask source is missing");
}
if (!p1008Source.includes('const API_PATH = "/api/p1008"')) {
  throw new Error("P1008 core source is missing its account API");
}

const dashboard = extractInlineStyle(dashboardSource, {
  functionStart: "  function installDashboardStyles() {",
  nextFunctionStart: "\n\n  function makeMonthButton()",
  invocation: "\n  installDashboardStyles();",
  label: "Finance dashboard",
});
const monthLayout = extractInlineStyle(monthLayoutSource, {
  functionStart: "  function installSplitMonthStyles() {",
  nextFunctionStart: "\n\n  function nextMonthAfter(monthKey)",
  invocation: "\n  installSplitMonthStyles();",
  label: "Finance month layout",
});

const financeBundle = [
  amountSource.trim(),
  financeSource.trim(),
  beautyCareSource.trim(),
  dashboard.javascript,
  dashboardSummarySource.trim(),
  dashboardGoldLiveSource.trim(),
  monthLayout.javascript,
  "",
].join("\n\n");
const financeCssBundle = [
  financeCss.trim(),
  monthLayoutCss.trim(),
  dashboard.css,
  dashboardGoldLiveCss.trim(),
  privacyMaskCss.trim(),
  monthLayout.css,
  "",
].join("\n\n");
const p1008Bundle = [
  p1008Source.trim(),
  p1008LayoutSource.trim(),
  "",
].join("\n\n");
const p1008CssBundle = [
  p1008Css.trim(),
  p1008LayoutCss.trim(),
  "",
].join("\n\n");

await mkdir(distProjectFinanceDir, { recursive: true });
await Promise.all([
  writeFile(resolve(dist, "finance-demo.js"), financeBundle),
  writeFile(resolve(dist, "finance-demo.css"), financeCssBundle),
  writeFile(resolve(distProjectFinanceDir, "finance-p1008.js"), p1008Bundle),
  writeFile(resolve(distProjectFinanceDir, "finance-p1008.css"), p1008CssBundle),
]);

console.log("Finance canonical bundles built directly at core v11 and P1008 v5");
