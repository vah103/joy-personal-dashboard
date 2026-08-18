import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard HTML loads the visible Sale Assistant", async () => {
  const [dashboard, build, entry, assistant, view, styles] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/assistant-view.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.css", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /sales-assistant\.css\?v=joy-dashboard-sales-assistant-v6/);
  assert.match(dashboard, /type="module" src="sales-assistant\.js\?v=joy-dashboard-sales-assistant-v5"/);
  assert.match(dashboard, /room-summary\.css\?v=joy-room-summary-v1/);
  assert.match(build, /resolve\(salesFeatures, "sale-appointment\.js"\)/);
  assert.match(entry, /\.\/assistant\/assistant\.js/);
  assert.match(view, /data-assistant-mode="appointment" data-i18n-skip>Appointments<\/button>/);
  assert.match(view, /data-assistant-mode="summary" data-i18n-skip>Room summary<\/button>/);
  assert.match(view, /data-assistant-mode="history" data-i18n-skip>History<\/button>/);
  assert.match(view, /appointment: "Appointments"/);
  assert.match(view, /summary: "Room summary"/);
  assert.match(view, /history: "History"/);
  assert.match(view, /<strong>Schedule a viewing<\/strong>/);
  assert.doesNotMatch(view, /Nhập một câu → kiểm tra → lưu vào Sheet/);
  assert.match(view, /data-action = "open-sales-assistant"|dataset\.action = "open-sales-assistant"/);
  assert.match(assistant, /import\("\/room-summary\.js\?v=joy-room-summary-v1"\)/);
  assert.match(styles, /\.sales-assistant-launch\s*\{[^}]*padding:\s*9px 11px/s);
  assert.match(styles, /\.sales-assistant-launch-icon\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px/s);
  assert.match(styles, /\.sales-assistant-modal/);
  assert.match(styles, /\.sales-history-table\s*\{[^}]*font-size:\s*13px;/s);
  assert.match(styles, /\.sales-history-table td:nth-child\(2\)[\s\S]*font-weight:\s*850;/);
  assert.match(styles, /\.sales-history-table th:last-child,[\s\S]*position:\s*sticky;[\s\S]*right:\s*0;/);
});

test("assistant keeps Upcoming Viewings and Manage 2026 intact", async () => {
  const [dashboard, view] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/assistant-view.js", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /Upcoming viewings/i);
  assert.match(dashboard, /Manage 2026/);
  assert.match(view, /salesSummary\.after\(launch\)/);
  assert.match(view, /manageButton\.before\(actions\)/);
});
