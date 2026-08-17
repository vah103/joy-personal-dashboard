import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale Manager is the only tool rendered on the standalone sale page", async () => {
  const page = await readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(page, /room-summary\.js/);
  assert.doesNotMatch(page, /room-summary\.css/);
  assert.doesNotMatch(page, /class="sale-room-tool"/);
  assert.match(page, /id="sale-table-body"/);
  assert.match(page, /id="sale-modal"/);
  assert.match(page, /<script type="module" src="sale-manager\.js/);
});

test("closing a viewing separates the save lock from the persisted deal marker", async () => {
  const [history, assistant, endpoint, worker, migration] = await Promise.all([
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8"),
    readFile(new URL("../migrations/20260817_sale_viewing_deal_locks.sql", import.meta.url), "utf8"),
  ]);

  assert.match(history, /const CLOSE_DEAL_ENDPOINT = "\/api\/sales\/viewings\/close-deal"/);
  assert.match(history, /viewingId,/);
  assert.match(history, /fetch\(CLOSE_DEAL_ENDPOINT/);
  assert.doesNotMatch(history, /markViewingDealSaved|dealSaved:\s*true/);
  assert.match(history, /dealSaving/);
  assert.match(history, /SALE_DEAL_SAVE_REVIEW_REQUIRED/);
  assert.match(history, /loadViewingHistory\(\{ force: true \}\)/);
  assert.match(history, /emitSalesChanged\("deal-saved"\)/);

  assert.match(endpoint, /const CLOSE_DEAL_PATH = "\/api\/sales\/viewings\/close-deal"/);
  assert.match(endpoint, /INSERT INTO sale_viewing_deal_locks/);
  assert.match(endpoint, /ON CONFLICT\(viewing_id\) DO NOTHING/);
  assert.match(endpoint, /new URL\("\/api\/sales\/deals", request\.url\)/);
  assert.match(endpoint, /async function markViewingClosed/);
  assert.match(endpoint, /INSERT INTO sale_viewing_commissions/);
  assert.match(endpoint, /SALE_WRITE_FAILED/);
  assert.match(endpoint, /SALE_DEAL_SAVE_REVIEW_REQUIRED/);
  assert.match(endpoint, /releaseCloseDealLock/);

  const writeIndex = endpoint.indexOf("const dealResponse = await app.fetch");
  const markerIndex = endpoint.indexOf("const marked = await markViewingClosed");
  assert.ok(writeIndex >= 0 && markerIndex > writeIndex, "deal marker must only be persisted after the Sale write succeeds");

  assert.match(assistant, /joy:sale-deal-saved/);
  assert.match(assistant, /joy:sales-changed/);
  assert.match(assistant, /refreshDashboardViewings/);
  assert.match(worker, /dealSaved/);
  assert.match(worker, /dealSaving/);
  assert.match(worker, /sale_viewing_deal_locks/);
  assert.match(worker, /viewing\.status === "upcoming" && !viewing\.dealSaved && !viewing\.dealSaving/);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS sale_viewing_deal_locks/);
  assert.match(migration, /viewing_id TEXT PRIMARY KEY/);
  assert.match(migration, /FOREIGN KEY \(viewing_id\) REFERENCES sale_viewings\(id\) ON DELETE CASCADE/);
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
