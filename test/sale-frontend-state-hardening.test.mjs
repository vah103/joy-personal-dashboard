import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale Assistant keeps nested History Escape local and never reloads after saving an appointment", async () => {
  const source = await readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /window\.location\.reload/);
  assert.match(source, /window\.setTimeout\(resetAppointment,\s*1200\)/);
  assert.match(source, /document\.querySelector\("\.sales-history-edit-row"\)/);
  assert.match(source, /\{\s*capture:\s*true\s*\}/);
});

test("visible History rerenders deal-saving state without polling the API", async () => {
  const source = await readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8");

  assert.match(source, /HISTORY_STATE_REFRESH_MS\s*=\s*15\s*\*\s*1000/);
  assert.match(source, /function refreshVisibleHistoryState/);
  assert.match(source, /requestHistoryLoad\(\)/);
  assert.match(source, /setInterval\(refreshVisibleHistoryState,\s*HISTORY_STATE_REFRESH_MS\)/);
});

test("deal saved and deal saving use distinct visual states", async () => {
  const styles = await readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8");

  assert.match(styles, /tr\[data-deal-saved="true"\][\s\S]*\.sales-history-close-button:disabled/);
  assert.match(styles, /tr\[data-deal-saving="true"\][\s\S]*\.sales-history-close-button:disabled/);
  assert.doesNotMatch(styles, /\.sales-history-close-button:disabled\s*\{\s*border-color:\s*rgba\(54,\s*132,\s*72/);
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
    "saleAssistant.reviewSaveHelp",
    "saleAssistant.dealSaveProgressHelp",
    "saleAssistant.closeDealHelp",
  ].forEach((key) => {
    assert.match(en, new RegExp(`"${key}"`));
    assert.match(vi, new RegExp(`"${key}"`));
  });
});
