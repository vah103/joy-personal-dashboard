import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history owns rendering/editing while Close Deal is a separate controller", async () => {
  const [dashboard, interactions, closeDeal, styles] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/close-deal.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /sale-history-row-edit\.css\?v=joy-sale-history-row-edit-v1/);
  assert.match(dashboard, /sale-history-row-edit\.js\?v=joy-sale-history-row-edit-v1/);
  assert.match(interactions, /function renderHistoryDisplayRow/);
  assert.match(interactions, /function renderHistoryEditRow/);
  assert.match(interactions, /createCloseDealController/);
  assert.match(interactions, /addEventListener\("dblclick"/);
  assert.match(interactions, /\(pointer: coarse\)/);
  assert.doesNotMatch(interactions, /MutationObserver|mergeReminderColumns|ensureCloseDealModal/);
  assert.match(closeDeal, /createCloseDealController/);
  assert.match(closeDeal, /sale-close-deal-modal/);
  assert.match(styles, /\.sales-history-table\s*\{[^}]*min-width:\s*1080px;/s);
  assert.match(styles, /\.sales-history-actions-cell/);
});
