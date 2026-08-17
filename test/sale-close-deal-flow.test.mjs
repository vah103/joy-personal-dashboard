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
});

test("closing a viewing creates a real Sale Manager deal and persists the saved marker", async () => {
  const [ui, worker] = await Promise.all([
    readFile(new URL("../src/features/sales/sale-history-row-edit.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8"),
  ]);

  assert.match(ui, /const DEALS_ENDPOINT = "\/api\/sales\/deals"/);
  assert.match(ui, /method: "POST"/);
  assert.match(ui, /body: JSON\.stringify\(\{ id, dealSaved: true \}\)/);
  assert.match(ui, /id = "sales-commission"/);
  assert.match(ui, /textContent = "Sale Manager"/);
  assert.match(worker, /sale_viewing_commissions/);
  assert.match(worker, /input\?\.dealSaved === true/);
  assert.match(worker, /dealSaved: \["pending", "received"\]/);
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
