import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history locks closed viewings and keeps close-deal state consistent", async () => {
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

  assert.match(interaction, /if \(editable\) \{\s*actionCell\.append\(makeActionButton\("Edit"/s);
  assert.match(interaction, /viewing\.dealSaved \? "Deal saved" : "Close deal"/);
  assert.match(editRowOwner, /makeActionButton\("Delete", "delete"/);
  assert.match(editRowOwner, /makeActionButton\("Save", "save"/);
  assert.doesNotMatch(editRowOwner, /"close-deal"/);
  assert.match(interaction, /if \(!viewing \|\| viewing\.dealSaved\) return;/);
  assert.match(interaction, /if \(!id \|\| !viewing \|\| viewing\.dealSaved\) return;/);
  assert.match(interaction, /row\.dataset\.historyEditable !== "true"/);
  assert.match(interaction, /method: "DELETE"/);
  assert.match(interaction, /method: "PATCH"/);
  assert.match(interaction, /fetch\(CLOSE_DEAL_ENDPOINT/);
  assert.doesNotMatch(interaction, /body: JSON\.stringify\(\{ id, dealSaved: true \}\)/);
  assert.match(interaction, /emitSalesChanged\("viewing-updated"\)/);
  assert.match(interaction, /emitSalesChanged\("viewing-deleted"\)/);
  assert.match(interaction, /return "Reminder pending"/);
  assert.match(interaction, /return "Reminder sent"/);
  assert.match(interaction, /return "Follow-up pending"/);
  assert.match(interaction, /return "Follow-up sent"/);
  assert.doesNotMatch(interaction, /syncDealStates|mergeReminderColumns|sales-history-refresh|sales-history-cancel-button/);

  assert.doesNotMatch(styles, /sales-history-refresh|sales-history-cancel-button/);
  assert.match(styles, /data-deal-saved=\"true\"/);
  assert.match(styles, /\.sale-close-deal-modal/);
  assert.match(styles, /min-width:\s*1080px/);

  assert.match(endpoint, /VIEWING_ALREADY_CLOSED/);
  assert.match(endpoint, /DELETE FROM sale_viewings/);
  assert.doesNotMatch(endpoint, /DELETE FROM sale_viewing_commissions\s*\n\s*WHERE viewing_id/);
  assert.match(worker, /VIEWING_ALREADY_CLOSED/);
  assert.match(worker, /isViewingClosed/);
  assert.match(worker, /NOT EXISTS \([\s\S]*sale_viewing_commissions/s);

  assert.match(router, /isSaleViewingDeleteRoute/);
  assert.match(router, /handleSaleViewingDeleteRequest/);
});
