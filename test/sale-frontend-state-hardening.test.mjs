import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { saleDealRevision } from "../worker/finance-sales.js";

test("Sale Assistant keeps appointment save state inside the appointment controller", async () => {
  const [form, view] = await Promise.all([
    readFile(new URL("../src/features/sales/assistant/appointment-form.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/assistant-view.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(form, /window\.location\.reload/);
  assert.match(form, /APPOINTMENT_RESET_DELAY_MS\s*=\s*1200/);
  assert.match(form, /const state = \{[\s\S]*saving: false[\s\S]*requestId: ""[\s\S]*operationSeq: 0/);
  assert.match(form, /payload\.id = state\.requestId/);
  assert.match(form, /querySelectorAll\("textarea, button"\)/);
  assert.match(form, /querySelectorAll\("input, button"\)/);
  assert.match(form, /operationId !== state\.operationSeq/);
  assert.match(form, /scheduleReset\(\)/);
  assert.match(view, /isAppointmentSaving/);
  assert.match(view, /joy:sale-history-leave-request/);
  assert.match(view, /currentMode === "appointment" && isAppointmentSaving\(\)/);
  assert.match(view, /#room-summary-capture/);
  assert.match(view, /HISTORY_STATE_REFRESH_MS\s*=\s*15 \* 1000/);
});

test("History groups load/edit state and keeps Close Deal in a separate controller", async () => {
  const [history, closeDeal] = await Promise.all([
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/close-deal.js", import.meta.url), "utf8"),
  ]);
  assert.match(history, /const state = \{[\s\S]*history: \{ items: \[\], loaded: false, installed: false, loadSeq: 0 \}[\s\S]*edit: \{ viewingId: "", dirty: false, saving: false, operationSeq: 0 \}/);
  assert.match(history, /confirmDiscardEditing/);
  assert.match(history, /setHistoryEditBusy/);
  assert.match(history, /requestSeq !== state\.history\.loadSeq/);
  assert.match(history, /state\.history\.loaded = false/);
  assert.match(history, /createCloseDealController/);
  assert.doesNotMatch(history, /function ensureCloseDealModal|function saveClosedDeal|CLOSE_DEAL_ENDPOINT/);
  assert.match(closeDeal, /const state = \{[\s\S]*saving: false[\s\S]*dirty: false[\s\S]*reviewSaving: false/);
  assert.match(closeDeal, /Discard unsaved deal changes\?/);
  assert.match(closeDeal, /SALE_DEAL_SAVE_REVIEW_REQUIRED/);
  assert.match(closeDeal, /applyReviewResolution/);
});

test("Sale Manager keeps safe writes while using the shared Sale API", async () => {
  const manager = await readFile(new URL("../src/features/sales/manager/sale-manager.js", import.meta.url), "utf8");
  assert.match(manager, /SAFE_ADD_ENDPOINT\s*=\s*"\/api\/sales\/deals\/idempotent"/);
  assert.match(manager, /SAFE_UPDATE_ENDPOINT\s*=\s*"\/api\/sales\/deals\/safe-update"/);
  assert.match(manager, /ADD_REVIEW_ENDPOINT\s*=\s*"\/api\/sales\/deals\/idempotent\/review"/);
  assert.match(manager, /payload\.expectedRevision = String\(editingDeal\.revision/);
  assert.match(manager, /payload\.requestId = state\.formRequestId/);
  assert.match(manager, /saleApi\(endpoint/);
  assert.match(manager, /loadSeq:\s*0/);
  assert.match(manager, /formSaving:\s*false/);
  assert.match(manager, /formDirty:\s*false/);
  assert.match(manager, /requestSeq !== state\.loadSeq/);
  assert.match(manager, /confirmDiscardForm/);
});

test("shared Sale API normalizes JSON requests and structured errors", async () => {
  const api = await readFile(new URL("../src/features/sales/shared/api.js", import.meta.url), "utf8");
  assert.match(api, /export async function saleApi/);
  assert.match(api, /credentials: "same-origin"/);
  assert.match(api, /Content-Type/);
  assert.match(api, /status: response\.status/);
  assert.match(api, /payload/);
});

test("sale deal revisions are stable and change with deal identity", () => {
  const base = {
    month: "2026-08",
    address: "180 Phú Mỹ",
    customer: "Lan",
    host: "A",
    rent: 4200000,
    phone: "0987654321",
    rate: 0.5,
  };
  assert.equal(saleDealRevision(base), saleDealRevision({ ...base }));
  assert.notEqual(saleDealRevision(base), saleDealRevision({ ...base, customer: "Mai" }));
});

test("guarded sale writes prevent stale updates and duplicate add retries", async () => {
  const guard = await readFile(new URL("../worker/sale-deal-guard.js", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/20260817_sale_deal_write_requests.sql", import.meta.url), "utf8");
  assert.match(guard, /SAFE_ADD_PATH\s*=\s*"\/api\/sales\/deals\/idempotent"/);
  assert.match(guard, /SAFE_UPDATE_PATH\s*=\s*"\/api\/sales\/deals\/safe-update"/);
  assert.match(guard, /expectedRevision/);
  assert.match(guard, /SALE_DEAL_STALE/);
  assert.match(guard, /SALE_DEAL_AMBIGUOUS/);
  assert.match(guard, /claimWriteRequest/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sale_deal_write_requests/);
});

test("new Sale deal insertion remains one atomic Sheets batch", async () => {
  const worker = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  const add = worker.match(/async function addSaleDeal[\s\S]*?\n}\n\nasync function updateSaleDeal/)?.[0] || "";
  assert.match(add, /requests = \[/);
  assert.match(add, /await sheetsBatchUpdate\(accessToken, spreadsheetId, requests\)/);
  assert.doesNotMatch(add, /await insertRows\(/);
  assert.doesNotMatch(add, /await writeSaleDeal\(/);
});
