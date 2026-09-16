import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard HTML loads the visible Sale Assistant", async () => {
  const [dashboard, build, script, styles, rowEditStyles, saleEnglishUi] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.css", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-history-row-edit.css", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-english-ui.js", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /sales-assistant\.css\?v=joy-dashboard-sales-assistant-v6/);
  assert.match(dashboard, /type="module" src="sales-assistant\.js\?v=joy-dashboard-sales-assistant-v5"/);
  assert.match(dashboard, /room-summary\.css\?v=joy-room-summary-v1/);
  assert.match(build, /resolve\(salesFeatures, "sale-appointment\.js"\)/);
  assert.match(script, /from "\/i18n\/index\.js\?v=joy-i18n-v1"/);
  assert.match(script, /t\("cleanup\.sale\.scheduleViewing"\)/);
  assert.match(script, /t\("saleAssistant\.roomInfoSummary"\)/);
  assert.match(script, /t\("saleAssistant\.viewingHistory"\)/);
  assert.doesNotMatch(script, /appointment:\s*"Hẹn khách xem phòng"/);
  assert.doesNotMatch(script, /summary:\s*"Tóm tắt thông tin phòng"/);
  assert.doesNotMatch(script, /history:\s*"Lịch sử hẹn khách"/);
  assert.doesNotMatch(script, /Nhập một câu → kiểm tra → lưu vào Sheet/);
  assert.match(script, /data-action = "open-sales-assistant"|dataset\.action = "open-sales-assistant"/);
  assert.match(script, /import\("\.\/room-summary\.js\?v=joy-room-summary-v1"\)/);
  assert.match(styles, /\.sales-assistant-launch\s*\{[^}]*padding:\s*9px 11px/s);
  assert.match(styles, /\.sales-assistant-launch-icon\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px/s);
  assert.match(styles, /\.sales-assistant-modal/);
  assert.match(styles, /\.sales-history-table\s*\{[^}]*font-size:\s*13px;/s);
  assert.match(styles, /\.sales-history-table td:nth-child\(2\)[\s\S]*font-weight:\s*850;/);
  assert.match(styles, /\.sales-history-table th:last-child,[\s\S]*position:\s*sticky;[\s\S]*right:\s*0;/);

  assert.match(rowEditStyles, /\.sales-assistant-heading\s*\{[^}]*padding:\s*18px 26px;[^}]*margin-bottom:\s*0;/s);
  assert.match(rowEditStyles, /\.sales-history-workspace\s*\{[^}]*padding:\s*16px 22px 22px;/s);
  assert.match(rowEditStyles, /\.sales-history-heading > div\s*\{[^}]*justify-content:\s*space-between;/s);
  assert.match(rowEditStyles, /\.sales-history-table\s*\{[^}]*min-width:\s*940px;[^}]*table-layout:\s*fixed;/s);
  assert.match(rowEditStyles, /\.sales-history-table th:nth-child\(1\),[\s\S]*width:\s*14%;/);
  assert.match(rowEditStyles, /\.sales-history-table th:nth-child\(2\),[\s\S]*width:\s*18%;/);
  assert.match(rowEditStyles, /\.sales-history-table th:nth-child\(3\),[\s\S]*width:\s*18%;/);
  assert.match(rowEditStyles, /\.sales-history-table th:nth-child\(4\),[\s\S]*width:\s*24%;/);
  assert.match(rowEditStyles, /\.sales-history-table th:nth-child\(5\),[\s\S]*width:\s*13%;/);
  assert.match(rowEditStyles, /\.sales-history-table th:nth-child\(6\),[\s\S]*width:\s*13%;/);
  assert.match(rowEditStyles, /@media \(min-width:\s*701px\)[\s\S]*\.sales-assistant-tabs\s*\{[\s\S]*padding-top:\s*4px;[\s\S]*padding-bottom:\s*4px;/);
  assert.match(rowEditStyles, /@media \(min-width:\s*701px\)[\s\S]*\.sales-assistant-tabs button\s*\{[\s\S]*min-height:\s*34px;/);
  assert.doesNotMatch(rowEditStyles, /@media \(min-width:\s*701px\)[\s\S]*\.sales-assistant-tabs\s*\{[^}]*width:\s*fit-content;/);
  assert.match(rowEditStyles, /@media \(max-width:\s*700px\)[\s\S]*\.sales-assistant-tabs\s*\{[\s\S]*width:\s*auto;[\s\S]*margin:\s*0;/);
  assert.match(saleEnglishUi, /\.sales-history-month-group\s*\{\s*display:\s*none !important;/s);
  assert.match(saleEnglishUi, /\.sales-history-day-group > td\s*\{[\s\S]*font-size:\s*14px !important;/);
  assert.match(saleEnglishUi, /@media \(max-width:\s*700px\)[\s\S]*font-size:\s*8px !important;/);
});

test("Sale Assistant owns locale-aware UI instead of relying on a Vietnamese-source patch", async () => {
  const script = await readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8");

  assert.match(script, /function assistantHtml\(\)/);
  assert.match(script, /translateText\(formatVietnamViewingTime\(value\)\)/);
  assert.match(script, /t\("saleAssistant\.loadingHistory"\)/);
  assert.match(script, /t\("cleanup\.sale\.requiredFields"\)/);
  assert.doesNotMatch(script, />Hẹn khách</);
  assert.doesNotMatch(script, />Tóm tắt phòng</);
  assert.doesNotMatch(script, />Lịch sử</);
  assert.doesNotMatch(script, /textContent = "Đang tải lịch sử…"/);
});

test("assistant keeps Upcoming Viewings and Manage 2026 intact", async () => {
  const [dashboard, script] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /Upcoming viewings/i);
  assert.match(dashboard, /Manage 2026/);
  assert.match(script, /salesSummary\.after\(launch\)/);
  assert.match(script, /manageButton\.before\(actions\)/);
});
