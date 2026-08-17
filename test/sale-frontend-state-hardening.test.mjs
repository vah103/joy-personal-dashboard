import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { saleDealRevision } from "../worker/finance-sales.js";

test("Sale Assistant serializes and idempotently retries appointment saves", async () => {
  const source = await readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /window\.location\.reload/);
  assert.match(source, /APPOINTMENT_RESET_DELAY_MS\s*=\s*1200/);
  assert.match(source, /appointmentInputVersion/);
  assert.match(source, /let appointmentSaving = false/);
  assert.match(source, /let appointmentRequestId = ""/);
  assert.match(source, /let appointmentOperationSeq = 0/);
  assert.match(source, /function setAppointmentBusy/);
  assert.match(source, /function newAppointmentRequestId/);
  assert.match(source, /payload\.id = appointmentRequestId/);
  assert.match(source, /querySelectorAll\("textarea, button"\)/);
  assert.match(source, /querySelectorAll\("input, button"\)/);
  assert.match(source, /if \(appointmentSaving\) return/);
  assert.match(source, /if \(appointmentSaving\) return false/);
  assert.match(source, /currentMode === "appointment" && appointmentSaving/);
  assert.match(source, /operationId !== appointmentOperationSeq/);
  assert.match(source, /scheduleAppointmentReset\(\)/);
  assert.match(source, /#room-summary-capture/);
  assert.match(source, /historyEditInProgress/);
  assert.match(source, /function requestHistoryLeave/);
  assert.match(source, /joy:sale-history-leave-request/);
  assert.doesNotMatch(source, /deferUntilHistoryEditResolved/);
  assert.match(source, /if \(currentMode === "history" && !requestHistoryLeave\(\)\) return false/);
  assert.match(source, /stopImmediatePropagation\(\)/);
  assert.match(source, /#sales-assistant-modal"\)\?\.addEventListener\("click"/);
  assert.match(source, /\{\s*capture:\s*true\s*\}/);
});

test("viewing creation accepts a client idempotency id", async () => {
  const worker = await readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8");

  assert.match(worker, /cleanViewingRequestId/);
  assert.match(worker, /ON CONFLICT\(id\) DO NOTHING/);
  assert.match(worker, /sameViewing\(existing, viewing\)/);
  assert.match(worker, /idempotent: true/);
  assert.match(worker, /VIEWING_ID_CONFLICT/);
});

test("visible History rerenders saving state without API polling or destroying an active edit", async () => {
  const source = await readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8");

  assert.match(source, /HISTORY_STATE_REFRESH_MS\s*=\s*15\s*\*\s*1000/);
  assert.match(source, /function refreshVisibleHistoryState/);
  assert.match(source, /if \(historyEditInProgress\(\)\) return;/);
  assert.match(source, /requestHistoryLoad\(\)/);
  assert.match(source, /setInterval\(refreshVisibleHistoryState,\s*HISTORY_STATE_REFRESH_MS\)/);
});

test("History protects dirty edits, invalidates failed cache, and recovers review locally", async () => {
  const source = await readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8");

  assert.match(source, /let editingDirty = false/);
  assert.match(source, /confirmDiscardEditing/);
  assert.match(source, /Discard unsaved appointment changes\?/);
  assert.match(source, /let editOperationSaving = false/);
  assert.match(source, /let editOperationSeq = 0/);
  assert.match(source, /function setHistoryEditBusy/);
  assert.match(source, /row\.querySelectorAll\("input, button"\)/);
  assert.match(source, /if \(editOperationSaving && !force\) return false/);
  assert.match(source, /operationId !== editOperationSeq/);
  assert.match(source, /joy:sale-history-leave-request/);
  assert.match(source, /editOperationSaving \|\| !cancelEditing\(\)/);
  assert.match(source, /let historyLoadSeq = 0/);
  assert.match(source, /requestSeq !== historyLoadSeq/);
  assert.match(source, /catch \{[\s\S]*?historyLoaded = false;/);
  assert.match(source, /let closeDealSaving = false/);
  assert.match(source, /let closeDealDirty = false/);
  assert.match(source, /Discard unsaved deal changes\?/);
  assert.match(source, /closeDealOperationSeq/);
  assert.match(source, /CLOSE_DEAL_REVIEW_ENDPOINT/);
  assert.match(source, /function applyReviewResolutionLocally/);
  assert.match(source, /viewing\.dealSaving = false/);
  assert.match(source, /void loadViewingHistory\(\{ force: true \}\)/);
  assert.match(source, /review-deal-saved/);
  assert.match(source, /review-deal-retry/);
  assert.match(source, /disabled: Boolean\(viewing\.dealSaved \|\| \(viewing\.dealSaving && !savingReview\)\)/);
  assert.match(source, /function editErrorMessage/);
  assert.match(source, /function deleteErrorMessage/);
  assert.match(source, /function closeDealErrorMessage/);
});

test("Sale Manager uses safe add/update endpoints and explicit uncertain-write review", async () => {
  const manager = await readFile(new URL("../src/features/sales/manager/sale-manager.js", import.meta.url), "utf8");

  assert.match(manager, /SAFE_ADD_ENDPOINT\s*=\s*"\/api\/sales\/deals\/idempotent"/);
  assert.match(manager, /SAFE_UPDATE_ENDPOINT\s*=\s*"\/api\/sales\/deals\/safe-update"/);
  assert.match(manager, /ADD_REVIEW_ENDPOINT\s*=\s*"\/api\/sales\/deals\/idempotent\/review"/);
  assert.match(manager, /formRequestId:\s*""/);
  assert.match(manager, /formReviewPending:\s*false/);
  assert.match(manager, /payload\.expectedRevision = String\(editingDeal\.revision/);
  assert.match(manager, /payload\.requestId = state\.formRequestId/);
  assert.match(manager, /function resolveAddReview/);
  assert.match(manager, /SALE_DEAL_STALE/);
  assert.match(manager, /SALE_DEAL_AMBIGUOUS/);
  assert.match(manager, /SALE_DEAL_SAVE_REVIEW_REQUIRED/);
  assert.match(manager, /dataset\.i18n = "sales\.checkSaved"/);
  assert.match(manager, /dataset\.i18n = "sales\.checkAllowRetry"/);
});

test("Sale Manager protects dirty forms and Dashboard ignores stale Sale requests", async () => {
  const [manager, integrations, assistant] = await Promise.all([
    readFile(new URL("../src/features/sales/manager/sale-manager.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/app-integrations.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
  ]);

  assert.match(manager, /loadSeq:\s*0/);
  assert.match(manager, /formSaving:\s*false/);
  assert.match(manager, /formDirty:\s*false/);
  assert.match(manager, /formOperationSeq:\s*0/);
  assert.match(manager, /requestSeq !== state\.loadSeq/);
  assert.match(manager, /function confirmDiscardForm/);
  assert.match(manager, /Discard unsaved deal changes\?/);
  assert.match(manager, /if \(!force && !confirmDiscardForm\(\)\) return false/);
  assert.match(manager, /state\.formDirty = false/);
  assert.match(manager, /elements\.form\.addEventListener\("input"/);
  assert.match(manager, /elements\.form\.addEventListener\("change"/);
  assert.match(manager, /if \(state\.formSaving && !force\) return false/);
  assert.match(integrations, /let salesFetchSeq = 0/);
  assert.match(integrations, /requestSeq !== salesFetchSeq/);
  assert.match(assistant, /dashboardCommissionLoadSeq/);
  assert.match(assistant, /requestSeq !== dashboardCommissionLoadSeq/);
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

test("guarded sale writes resolve moved rows by revision and prevent duplicate add retries", async () => {
  const guard = await readFile(new URL("../worker/sale-deal-guard.js", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/20260817_sale_deal_write_requests.sql", import.meta.url), "utf8");

  assert.match(guard, /SAFE_ADD_PATH\s*=\s*"\/api\/sales\/deals\/idempotent"/);
  assert.match(guard, /SAFE_UPDATE_PATH\s*=\s*"\/api\/sales\/deals\/safe-update"/);
  assert.match(guard, /expectedRevision/);
  assert.match(guard, /current\.deals\.filter\(\(deal\) => String\(deal\.revision \|\| ""\) === expectedRevision\)/);
  assert.match(guard, /sourceRow: Number\(existing\.sourceRow \|\| 0\)/);
  assert.match(guard, /SALE_DEAL_STALE/);
  assert.match(guard, /SALE_DEAL_AMBIGUOUS/);
  assert.match(guard, /claimWriteRequest/);
  assert.match(guard, /state === "committed"/);
  assert.match(guard, /SALE_DEAL_SAVE_REVIEW_REQUIRED/);
  assert.match(guard, /SALE_DEAL_REVIEW_DEAL_PRESENT/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sale_deal_write_requests/);
  assert.match(migration, /PRIMARY KEY \(user_email, request_id\)/);
});

test("new Sale deal insertion is one atomic Sheets batch", async () => {
  const worker = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  const add = worker.match(/async function addSaleDeal[\s\S]*?\n}\n\nasync function updateSaleDeal/)?.[0] || "";

  assert.match(add, /requests = \[/);
  assert.match(add, /insertRowsRequest/);
  assert.match(add, /saleDealCellRequests/);
  assert.match(add, /updateCellsRequest/);
  assert.match(add, /await sheetsBatchUpdate\(accessToken, spreadsheetId, requests\)/);
  assert.doesNotMatch(add, /await insertRows\(/);
  assert.doesNotMatch(add, /await writeSaleDeal\(/);
  assert.doesNotMatch(add, /await writeMonthTotalFormula\(/);
});

test("deal review recovery is explicit and never blindly retries an uncertain write", async () => {
  const worker = await readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8");

  assert.match(worker, /CLOSE_DEAL_REVIEW_PATH\s*=\s*"\/api\/sales\/viewings\/close-deal\/review"/);
  assert.match(worker, /handleSaleViewingCloseDealReview/);
  assert.match(worker, /\["saved", "retry"\]\.includes\(resolution\)/);
  assert.match(worker, /Date\.now\(\) - Number\(lock\.locked_at \|\| 0\) < DEAL_LOCK_REVIEW_MS/);
  assert.match(worker, /resolution === "saved"/);
  assert.match(worker, /retryAllowed: true/);

  const uncertainWriteBranch = worker.match(
    /if \(payload\.error === "SALE_WRITE_FAILED"\) \{([\s\S]*?)\n\s*\}/,
  )?.[1] || "";
  assert.match(uncertainWriteBranch, /SALE_DEAL_SAVE_IN_PROGRESS/);
  assert.doesNotMatch(uncertainWriteBranch, /releaseCloseDealLock/);
});

test("deal saved and deal saving use distinct visual states", async () => {
  const styles = await readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8");

  assert.match(styles, /tr\[data-deal-saved="true"\][\s\S]*\.sales-history-close-button:disabled/);
  assert.match(styles, /tr\[data-deal-saving="true"\][\s\S]*\.sales-history-close-button:disabled/);

  const genericDisabled = styles.match(
    /\.sales-history-edit-button:disabled,[\s\S]*?\.sales-history-close-button:disabled\s*\{([\s\S]*?)\}/,
  )?.[1] || "";
  assert.doesNotMatch(genericDisabled, /background|border-color|color/);
});

test("deal saving and review copy is localized in both Sale flow dictionaries", async () => {
  const [en, vi] = await Promise.all([
    readFile(new URL("../src/i18n/locales/en-sale-flow.js", import.meta.url), "utf8"),
    readFile(new URL("../src/i18n/locales/vi-sale-flow.js", import.meta.url), "utf8"),
  ]);

  [
    "sales.checkSaved",
    "sales.checkAllowRetry",
    "saleAssistant.savingDealState",
    "saleAssistant.reviewDealSave",
    "saleAssistant.reviewSave",
    "saleAssistant.closedDealAria",
    "saleAssistant.dealSaveProgressAria",
    "saleAssistant.dealSaveReviewAria",
    "saleAssistant.reviewSaveHelp",
    "saleAssistant.reviewResolveHelp",
    "saleAssistant.dealSaveProgressHelp",
    "saleAssistant.reviewExplanation",
    "saleAssistant.openManager",
    "saleAssistant.retryMissingDeal",
    "saleAssistant.markExistingDeal",
  ].forEach((key) => {
    assert.match(en, new RegExp(`"${key}"`));
    assert.match(vi, new RegExp(`"${key}"`));
  });
});
