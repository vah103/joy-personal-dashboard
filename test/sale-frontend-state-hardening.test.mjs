import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale Assistant safely resets repeated appointments and keeps nested Escape local", async () => {
  const source = await readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /window\.location\.reload/);
  assert.match(source, /APPOINTMENT_RESET_DELAY_MS\s*=\s*1200/);
  assert.match(source, /appointmentInputVersion/);
  assert.match(source, /scheduleAppointmentReset\(\)/);
  assert.match(source, /if \(save\) save\.disabled = false;/);
  assert.match(source, /#room-summary-capture/);
  assert.match(source, /document\.querySelector\("\.sales-history-edit-row"\)/);
  assert.match(source, /\{\s*capture:\s*true\s*\}/);
});

test("visible History rerenders saving state without API polling or destroying an active edit", async () => {
  const source = await readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8");

  assert.match(source, /HISTORY_STATE_REFRESH_MS\s*=\s*15\s*\*\s*1000/);
  assert.match(source, /function refreshVisibleHistoryState/);
  assert.match(source, /if \(document\.querySelector\("\.sales-history-edit-row"\)\) return;/);
  assert.match(source, /requestHistoryLoad\(\)/);
  assert.match(source, /setInterval\(refreshVisibleHistoryState,\s*HISTORY_STATE_REFRESH_MS\)/);
});

test("History protects dirty edits, stale responses, async modal state, and review recovery", async () => {
  const source = await readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8");

  assert.match(source, /let editingDirty = false/);
  assert.match(source, /confirmDiscardEditing/);
  assert.match(source, /Discard unsaved appointment changes\?/);
  assert.match(source, /let historyLoadSeq = 0/);
  assert.match(source, /requestSeq !== historyLoadSeq/);
  assert.match(source, /let closeDealSaving = false/);
  assert.match(source, /closeDealOperationSeq/);
  assert.match(source, /CLOSE_DEAL_REVIEW_ENDPOINT/);
  assert.match(source, /review-deal-saved/);
  assert.match(source, /review-deal-retry/);
  assert.match(source, /disabled: Boolean\(viewing\.dealSaved \|\| \(viewing\.dealSaving && !savingReview\)\)/);
  assert.match(source, /function editErrorMessage/);
  assert.match(source, /function deleteErrorMessage/);
  assert.match(source, /function closeDealErrorMessage/);
});

test("Sale Manager and Dashboard ignore stale Sale requests", async () => {
  const [manager, integrations, assistant] = await Promise.all([
    readFile(new URL("../src/features/sales/manager/sale-manager.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/app-integrations.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
  ]);

  assert.match(manager, /loadSeq:\s*0/);
  assert.match(manager, /formSaving:\s*false/);
  assert.match(manager, /formOperationSeq:\s*0/);
  assert.match(manager, /requestSeq !== state\.loadSeq/);
  assert.match(manager, /if \(state\.formSaving && !force\) return false/);
  assert.match(integrations, /let salesFetchSeq = 0/);
  assert.match(integrations, /requestSeq !== salesFetchSeq/);
  assert.match(assistant, /dashboardCommissionLoadSeq/);
  assert.match(assistant, /requestSeq !== dashboardCommissionLoadSeq/);
});

test("deal review recovery is explicit and never blindly retries an uncertain write", async () => {
  const worker = await readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8");

  assert.match(worker, /CLOSE_DEAL_REVIEW_PATH\s*=\s*"\/api\/sales\/viewings\/close-deal\/review"/);
  assert.match(worker, /handleSaleViewingCloseDealReview/);
  assert.match(worker, /\["saved", "retry"\]\.includes\(resolution\)/);
  assert.match(worker, /Date\.now\(\) - Number\(lock\.locked_at \|\| 0\) < DEAL_LOCK_REVIEW_MS/);
  assert.match(worker, /resolution === "saved"/);
  assert.match(worker, /retryAllowed: true/);
  assert.doesNotMatch(worker, /SALE_WRITE_FAILED[\s\S]{0,200}releaseCloseDealLock/);
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
