import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history owns rendering, editing and direct deal actions without DOM patching", async () => {
  const [dashboard, build, interactions, styles] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /sale-history-row-edit\.css\?v=joy-sale-history-row-edit-v1/);
  assert.match(dashboard, /sale-history-row-edit\.js\?v=joy-sale-history-row-edit-v1/);
  assert.match(build, /resolve\(saleAppointmentsFeature, "history\.js"\)/);
  assert.match(build, /resolve\(saleAppointmentsFeature, "history\.css"\)/);
  assert.match(interactions, /function renderHistoryDisplayRow/);
  assert.match(interactions, /function renderHistoryEditRow/);
  assert.match(interactions, /\["Thời gian", "Khách", "SĐT", "Địa chỉ", "Trạng thái", "Reminder", ""\]/);
  assert.match(interactions, /data\.historyAction = action|dataset\.historyAction = action/);
  assert.match(interactions, /addEventListener\("dblclick"/);
  assert.match(interactions, /\(pointer: coarse\)/);
  assert.match(interactions, /Double-click or press Enter to edit this appointment/);
  assert.doesNotMatch(interactions, /MutationObserver|mergeReminderColumns|decorateRows/);
  assert.match(styles, /\.sales-history-table\s*\{[^}]*min-width:\s*1080px;/s);
  assert.match(styles, /\.sales-history-actions-cell/);
});
