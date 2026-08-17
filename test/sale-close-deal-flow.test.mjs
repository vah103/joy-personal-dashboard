import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale Manager is the only tool rendered on the standalone sale page", async () => {
  const page = await readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(page, /room-summary\.js|room-summary\.css|class="sale-room-tool"/);
  assert.match(page, /id="sale-table-body"/);
  assert.match(page, /id="sale-modal"/);
  assert.match(page, /<script type="module" src="sale-manager\.js/);
});

test("Close Deal is a focused frontend controller over the persisted save lock", async () => {
  const [closeDeal, dashboardSale, endpoint, worker, migration] = await Promise.all([
    readFile(new URL("../src/features/sales/appointments/close-deal.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/dashboard-sale.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8"),
    readFile(new URL("../migrations/20260817_sale_viewing_deal_locks.sql", import.meta.url), "utf8"),
  ]);
  assert.match(closeDeal, /const CLOSE_DEAL_ENDPOINT = "\/api\/sales\/viewings\/close-deal"/);
  assert.match(closeDeal, /viewingId/);
  assert.match(closeDeal, /saleApi\(CLOSE_DEAL_ENDPOINT/);
  assert.doesNotMatch(closeDeal, /markViewingDealSaved|dealSaved:\s*true/);
  assert.match(closeDeal, /SALE_DEAL_SAVE_REVIEW_REQUIRED/);
  assert.match(closeDeal, /refreshHistory\(\)/);
  assert.match(closeDeal, /emitSalesChanged\("deal-saved"\)/);

  assert.match(endpoint, /INSERT INTO sale_viewing_deal_locks/);
  assert.match(endpoint, /ON CONFLICT\(viewing_id\) DO NOTHING/);
  assert.match(endpoint, /async function markViewingClosed/);
  assert.match(endpoint, /INSERT INTO sale_viewing_commissions/);
  assert.match(endpoint, /SALE_WRITE_FAILED/);
  assert.match(endpoint, /releaseCloseDealLock/);
  assert.match(dashboardSale, /joy:sale-deal-saved/);
  assert.match(dashboardSale, /joy:sales-changed/);
  assert.match(dashboardSale, /refreshDashboardViewings/);
  assert.match(worker, /dealSaved/);
  assert.match(worker, /dealSaving/);
  assert.match(worker, /sale_viewing_deal_locks/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sale_viewing_deal_locks/);
});

test("new Sale flow copy is registered in both locales", async () => {
  const [en, vi, enFlow, viFlow] = await Promise.all([
    readFile(new URL("../src/i18n/locales/en.js", import.meta.url), "utf8"),
    readFile(new URL("../src/i18n/locales/vi.js", import.meta.url), "utf8"),
    readFile(new URL("../src/i18n/locales/en-sale-flow.js", import.meta.url), "utf8"),
    readFile(new URL("../src/i18n/locales/vi-sale-flow.js", import.meta.url), "utf8"),
  ]);
  assert.match(en, /en-sale-flow\.js/);
  assert.match(vi, /vi-sale-flow\.js/);
  assert.match(enFlow, /"saleAssistant\.dealSaved": "Deal saved"/);
  assert.match(viFlow, /"saleAssistant\.dealSaved": "Đã lưu deal"/);
});
