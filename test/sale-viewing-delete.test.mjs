import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history keeps compact edit controls and commission stages", async () => {
  const [interaction, styles, endpoint, router, migration] = await Promise.all([
    readFile(new URL("../src/features/sales/sale-history-row-edit.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-history-row-edit.css", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
    readFile(new URL("../migrations/20260812_sale_viewing_commission_state.sql", import.meta.url), "utf8"),
  ]);

  assert.match(interaction, /textContent = "Delete"/);
  assert.match(interaction, /textContent = "Close deal"/);
  assert.match(interaction, /method: "DELETE"/);
  assert.match(interaction, /method: "PATCH"/);
  assert.match(interaction, /COMMISSION_ENDPOINT/);
  assert.match(interaction, /commissionStates\.set\(id, state\)/);
  assert.match(interaction, /state === "pending"[\s\S]*?Closed · commission pending/);
  assert.match(interaction, /Commission received/);
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
  assert.match(interaction, /syncCommissionStates\(\)/);

  assert.match(styles, /\.sales-history-cancel-button\s*\{\s*display:\s*none !important;/s);
  assert.match(styles, /#sales-history-refresh\s*\{[\s\S]*?display:\s*none !important;/);
  assert.match(styles, /\.sales-history-heading\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(styles, /data-commission-state=\"pending\"[\s\S]*?#fff3cf/);
  assert.match(styles, /data-commission-state=\"received\"[\s\S]*?#d8efd9/);
  assert.match(styles, /grid-template-columns:\s*auto auto auto/);
  assert.match(styles, /min-width:\s*940px/);
  assert.match(styles, /table-layout:\s*fixed/);
  assert.match(styles, /th:nth-child\(4\)[\s\S]*?width:\s*24%/);
  assert.match(styles, /th:nth-child\(5\)[\s\S]*?width:\s*13%[\s\S]*?text-align:\s*center/);
  assert.match(styles, /th:nth-child\(6\)[\s\S]*?width:\s*13%[\s\S]*?min-width:\s*120px[\s\S]*?text-align:\s*center/);
  assert.match(styles, /tr\.sales-history-edit-row > \.sales-history-actions-cell\s*\{[\s\S]*?min-width:\s*196px;[\s\S]*?padding-left:\s*6px !important;[\s\S]*?padding-right:\s*6px !important;/);
  assert.match(styles, /\.sales-history-edit-row \.sales-history-edit-controls\s*\{[\s\S]*?gap:\s*5px;[\s\S]*?justify-content:\s*end;/);
  assert.match(styles, /\.sales-history-edit-row \.sales-history-edit-controls > button\s*\{[\s\S]*?padding-left:\s*8px;[\s\S]*?padding-right:\s*8px;/);
  assert.match(styles, /\.sales-history-edit-row \.sales-history-edit-input\[type="datetime-local"\]\s*\{[\s\S]*?min-width:\s*0;/);

  assert.match(endpoint, /DELETE FROM sale_viewings/);
  assert.match(endpoint, /DELETE FROM sale_viewing_commissions/);
  assert.match(endpoint, /pathname === COMMISSION_PATH/);
  assert.match(endpoint, /SELECT viewing_id, state, updated_at/);
  assert.match(endpoint, /currentState === "pending" \|\| currentState === "received"[\s\S]*?\? "received"[\s\S]*?: "pending"/);
  assert.match(endpoint, /INSERT INTO sale_viewing_commissions/);
  assert.match(endpoint, /ON CONFLICT\(viewing_id\) DO UPDATE SET/);
  assert.match(endpoint, /WHERE id = \? AND user_email = \?/);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS sale_viewing_commissions/);
  assert.match(migration, /state TEXT NOT NULL CHECK \(state IN \('pending', 'received'\)\)/);

  assert.match(router, /isSaleViewingDeleteRoute/);
  assert.match(router, /handleSaleViewingDeleteRequest/);
});
