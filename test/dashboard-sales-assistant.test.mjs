import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard loads the Sale Assistant from focused frontend modules", async () => {
  const [dashboard, build, bootstrap, view, dashboardSale, styles] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-sales.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/assistant-view.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/dashboard-sale.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/sales-assistant.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /sales-assistant\.css\?v=joy-dashboard-sales-assistant-v6/);
  assert.match(dashboard, /type="module" src="sales-assistant\.js\?v=joy-dashboard-sales-assistant-v5"/);
  assert.match(dashboard, /room-summary\.css\?v=joy-room-summary-v1/);
  assert.match(build, /copyCanonicalSalesTree/);
  assert.match(build, /publicEntries/);
  assert.match(build, /versionPageAssets/);
  assert.match(bootstrap, /installAssistantView/);
  assert.match(bootstrap, /installAppointmentForm/);
  assert.match(bootstrap, /installDashboardSale\(\);\s*\n\s*installAssistantView/);
  assert.doesNotMatch(bootstrap, /if\s*\(\s*!installDashboardSale\(\)\s*\)\s*return/);
  assert.match(bootstrap, /focusActiveAssistantMode/);
  assert.match(bootstrap, /room-summary\/room-summary\.js/);
  assert.match(view, /data-assistant-mode="summary"/);
  assert.match(view, /id="room-summary-input"/);
  assert.match(view, /joy:sale-history-open/);
  assert.doesNotMatch(view, /sale-appointment-input"\)\?\.focus/);
  assert.match(dashboardSale, /dataset\.action = "open-sales-assistant"/);
  assert.match(dashboardSale, /id = "sales-commission"/);
  assert.match(dashboardSale, /refreshDashboardViewings/);
  assert.doesNotMatch(view, /Schedule a viewing/);
  assert.doesNotMatch(styles, /\.sales-assistant-launch/);
});

test("Sale Assistant scopes mode DOM and background History refresh does not steal focus", async () => {
  const [bootstrap, view] = await Promise.all([
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/assistant-view.js", import.meta.url), "utf8"),
  ]);
  assert.match(view, /modal\.querySelector\("\[data-assistant-mode\]\.active"\)/);
  assert.match(view, /modal\.querySelectorAll\("\[data-assistant-mode\]"\)/);
  assert.match(view, /modal\.querySelectorAll\("\[data-assistant-panel\]"\)/);
  assert.doesNotMatch(view, /document\.querySelectorAll\("\[data-assistant-mode\]"\)/);
  assert.doesNotMatch(view, /document\.querySelectorAll\("\[data-assistant-panel\]"\)/);
  assert.match(view, /requestHistoryLoad\(\{ focus: false \}\)/);
  assert.match(bootstrap, /event\.detail\?\.focus === false/);
});

test("Sale Assistant owns and cleans up its History refresh timer", async () => {
  const view = await readFile(new URL("../src/features/sales/assistant/assistant-view.js", import.meta.url), "utf8");
  assert.match(view, /let historyRefreshTimerId = 0/);
  assert.match(view, /clearHistoryRefreshTimer/);
  assert.match(view, /window\.clearInterval\(historyRefreshTimerId\)/);
  assert.match(view, /startHistoryRefreshTimer\(modal\)/);
  assert.match(view, /assistantViewController\?\.abort\(\)/);
  assert.match(view, /const controller = new AbortController\(\)/);
  assert.match(view, /return \(\) => \{/);
  assert.match(view, /delete modal\.dataset\.saleAssistantViewInstalled/);
});

test("dashboard Sale card keeps Upcoming and explicit Assistant/Manager actions", async () => {
  const [dashboard, dashboardSale] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/dashboard-sale.js", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /Upcoming viewings/i);
  assert.match(dashboard, /Manage 2026/);
  assert.match(dashboardSale, /saleAssistant\.action/);
  assert.match(dashboardSale, /sales\.managerAction/);
  assert.match(dashboardSale, /overview\.append\(upcoming\)/);
});
