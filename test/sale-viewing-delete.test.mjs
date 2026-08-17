import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history locks closed and in-progress viewings consistently", async () => {
  const [interaction, styles, endpoint, worker, router] = await Promise.all([
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
  ]);

  const editRowOwner = interaction.slice(
    interaction.indexOf("function renderHistoryEditRow"),
    interaction.indexOf("function renderViewingHistory"),
  );
  const deleteOwner = endpoint.slice(
    endpoint.indexOf("async function handleSaleViewingDelete(request, env)"),
    endpoint.indexOf("async function acquireCloseDealLock"),
  );

  assert.match(interaction, /const editable = !viewing\.dealSaved && !viewing\.dealSaving/);
  assert.match(interaction, /viewing\.dealSaved[\s\S]*?viewing\.dealSaving[\s\S]*?"Close deal"/);
  assert.match(editRowOwner, /makeActionButton\("Delete", "delete"/);
  assert.match(editRowOwner, /makeActionButton\("Save", "save"/);
  assert.doesNotMatch(editRowOwner, /"close-deal"/);
  assert.match(interaction, /viewing\.dealSaved \|\| viewing\.dealSaving/);
  assert.match(interaction, /row\.dataset\.historyEditable !== "true"/);
  assert.match(interaction, /SALE_DEAL_SAVE_IN_PROGRESS/);
  assert.match(interaction, /SALE_DEAL_SAVE_REVIEW_REQUIRED/);
  assert.match(interaction, /method: "DELETE"/);
  assert.match(interaction, /method: "PATCH"/);
  assert.match(interaction, /fetch\(CLOSE_DEAL_ENDPOINT/);
  assert.doesNotMatch(interaction, /body: JSON\.stringify\(\{ id, dealSaved: true \}\)/);
  assert.match(interaction, /emitSalesChanged\("viewing-updated"\)/);
  assert.match(interaction, /emitSalesChanged\("viewing-deleted"\)/);
  assert.match(interaction, /return "Reminder pending"/);
  assert.match(interaction, /return "Follow-up sent"/);
  assert.doesNotMatch(interaction, /syncDealStates|mergeReminderColumns|sales-history-refresh|sales-history-cancel-button/);

  assert.doesNotMatch(styles, /sales-history-refresh|sales-history-cancel-button/);
  assert.match(styles, /data-deal-saved=\"true\"/);
  assert.match(styles, /\.sale-close-deal-modal/);
  assert.match(styles, /min-width:\s*1080px/);

  assert.match(deleteOwner, /VIEWING_ALREADY_CLOSED/);
  assert.match(deleteOwner, /viewingDealLock/);
  assert.match(deleteOwner, /DELETE FROM sale_viewings/);
  assert.doesNotMatch(deleteOwner, /DELETE FROM sale_viewing_commissions/);
  assert.match(endpoint, /INSERT INTO sale_viewing_deal_locks/);
  assert.match(endpoint, /DELETE FROM sale_viewing_deal_locks/);
  assert.match(worker, /VIEWING_ALREADY_CLOSED/);
  assert.match(worker, /SALE_DEAL_SAVE_IN_PROGRESS/);
  assert.match(worker, /SALE_DEAL_SAVE_REVIEW_REQUIRED/);
  assert.match(worker, /sale_viewing_deal_locks/);
  assert.match(worker, /NOT EXISTS \([\s\S]*sale_viewing_commissions/s);

  assert.match(router, /isSaleViewingDeleteRoute/);
  assert.match(router, /handleSaleViewingDeleteRequest/);
});
