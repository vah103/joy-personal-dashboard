import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history locks closed and in-progress viewings consistently", async () => {
  const [history, closeDeal, styles, endpoint, worker, router] = await Promise.all([
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/close-deal.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
  ]);
  const editRowOwner = history.slice(history.indexOf("function renderHistoryEditRow"), history.indexOf("function renderViewingHistory"));
  assert.match(history, /const editable = !viewing\.dealSaved && !viewing\.dealSaving/);
  assert.match(editRowOwner, /"delete"/);
  assert.match(editRowOwner, /"save"/);
  assert.doesNotMatch(editRowOwner, /"close-deal"/);
  assert.match(history, /viewing\.dealSaved \|\| viewing\.dealSaving/);
  assert.match(history, /row\.dataset\.historyEditable !== "true"/);
  assert.match(history, /method: "DELETE"/);
  assert.match(history, /method: "PATCH"/);
  assert.match(closeDeal, /saleApi\(CLOSE_DEAL_ENDPOINT/);
  assert.match(history, /emitSalesChanged\("viewing-updated"\)/);
  assert.match(history, /emitSalesChanged\("viewing-deleted"\)/);
  assert.doesNotMatch(history, /syncDealStates|mergeReminderColumns|sales-history-refresh|sales-history-cancel-button/);
  assert.doesNotMatch(styles, /sales-history-refresh|sales-history-cancel-button/);
  assert.match(styles, /data-deal-saved="true"/);
  assert.match(styles, /\.sale-close-deal-modal/);
  assert.match(endpoint, /VIEWING_ALREADY_CLOSED/);
  assert.match(endpoint, /INSERT INTO sale_viewing_deal_locks/);
  assert.match(worker, /SALE_DEAL_SAVE_IN_PROGRESS/);
  assert.match(worker, /SALE_DEAL_SAVE_REVIEW_REQUIRED/);
  assert.match(router, /isSaleViewingDeleteRoute/);
});
