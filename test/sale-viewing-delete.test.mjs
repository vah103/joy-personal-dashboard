import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history keeps direct edit/delete controls and the real close-deal flow", async () => {
  const [interaction, styles, endpoint, router] = await Promise.all([
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
  ]);

  assert.match(interaction, /makeActionButton\("Delete", "delete"/);
  assert.match(interaction, /viewing\.dealSaved \? "Deal saved" : "Close deal"/);
  assert.match(interaction, /const DEALS_ENDPOINT = "\/api\/sales\/deals"/);
  assert.match(interaction, /const VIEWINGS_ENDPOINT = "\/api\/sales\/viewings"/);
  assert.match(interaction, /method: "DELETE"/);
  assert.match(interaction, /method: "POST"/);
  assert.match(interaction, /method: "PATCH"/);
  assert.match(interaction, /openCloseDealForm\(id, row\)/);
  assert.match(interaction, /body: JSON\.stringify\(\{ id, dealSaved: true \}\)/);
  assert.match(interaction, /if \(viewing\) viewing\.dealSaved = true/);
  assert.match(interaction, /return "Reminder pending"/);
  assert.match(interaction, /return "Reminder sent"/);
  assert.match(interaction, /return "Follow-up pending"/);
  assert.match(interaction, /return "Follow-up sent"/);
  assert.doesNotMatch(interaction, /syncDealStates|mergeReminderColumns|sales-history-refresh|sales-history-cancel-button/);

  assert.doesNotMatch(styles, /sales-history-refresh|sales-history-cancel-button/);
  assert.match(styles, /data-deal-saved=\"true\"/);
  assert.match(styles, /\.sale-close-deal-modal/);
  assert.match(styles, /\.sale-close-deal-grid/);
  assert.match(styles, /min-width:\s*1080px/);
  assert.match(styles, /th:nth-child\(4\)[\s\S]*?width:\s*28%/);
  assert.match(styles, /th:nth-child\(5\)[\s\S]*?width:\s*12%[\s\S]*?text-align:\s*center/);
  assert.match(styles, /th:nth-child\(6\)[\s\S]*?width:\s*14%[\s\S]*?min-width:\s*132px[\s\S]*?text-align:\s*center/);

  assert.match(endpoint, /DELETE FROM sale_viewings/);
  assert.match(endpoint, /DELETE FROM sale_viewing_commissions/);
  assert.match(endpoint, /WHERE id = \? AND user_email = \?/);

  assert.match(router, /isSaleViewingDeleteRoute/);
  assert.match(router, /handleSaleViewingDeleteRequest/);
});
