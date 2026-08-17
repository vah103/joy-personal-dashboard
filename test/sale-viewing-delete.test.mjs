import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history keeps compact edit/delete controls and the real close-deal flow", async () => {
  const [interaction, styles, endpoint, router] = await Promise.all([
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
  ]);

  assert.match(interaction, /textContent = "Delete"/);
  assert.match(interaction, /"Close deal"/);
  assert.match(interaction, /"Deal saved"/);
  assert.match(interaction, /const DEALS_ENDPOINT = "\/api\/sales\/deals"/);
  assert.match(interaction, /const VIEWINGS_ENDPOINT = "\/api\/sales\/viewings"/);
  assert.match(interaction, /method: "DELETE"/);
  assert.match(interaction, /method: "POST"/);
  assert.match(interaction, /method: "PATCH"/);
  assert.match(interaction, /openCloseDealForm\(row\)/);
  assert.match(interaction, /body: JSON\.stringify\(\{ id, dealSaved: true \}\)/);
  assert.match(interaction, /dealSavedIds\.add\(viewingId\)/);
  assert.match(interaction, /document\.addEventListener\("click"/);
  assert.match(interaction, /cancelEditing\(content\)/);
  assert.match(
    interaction,
    /event\.target\.closest\?\.\(EDIT_CONTROL_SELECTOR\)\) return;/,
    "the synthetic hidden Edit click must not be mistaken for an outside click",
  );
  assert.match(interaction, /headers\[5\]\.textContent = "Reminder"/);
  assert.match(interaction, /headers\[6\]\.remove\(\)/);
  assert.match(interaction, /return "Reminder pending"/);
  assert.match(interaction, /return "Reminder sent"/);
  assert.match(interaction, /return "Follow-up pending"/);
  assert.match(interaction, /return "Follow-up sent"/);
  assert.match(interaction, /function refreshHistory\(\)/);
  assert.match(interaction, /data-assistant-mode=\"history\"/);
  assert.match(interaction, /syncDealStates\(\)/);

  assert.match(styles, /\.sales-history-cancel-button\s*\{\s*display:\s*none !important;/s);
  assert.match(styles, /#sales-history-refresh\s*\{[\s\S]*?display:\s*none !important;/);
  assert.match(styles, /\.sales-history-heading\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
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
