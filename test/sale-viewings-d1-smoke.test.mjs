import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// PR-only smoke coverage also exercises the full current main tree in CI.
test("Sale viewings no longer depend on Google Sheets at runtime", async () => {
  const [router, worker, assistant] = await Promise.all([
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
  ]);

  assert.match(router, /isSaleViewingRoute/);
  assert.match(router, /runSaleViewingSchedule/);
  assert.match(worker, /FROM sale_viewings/);
  assert.match(worker, /INSERT INTO sale_viewings/);
  assert.doesNotMatch(worker, /Google Sheets|sheets\.googleapis|SALE_SPREADSHEET_ID|Appointments!/);
  assert.match(assistant, /data-assistant-mode="history"/);
  assert.match(assistant, /joy:sale-history-open/);
});

test("Sale history supports account-scoped inline edits from its own module", async () => {
  const [worker, history, styles] = await Promise.all([
    readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8"),
  ]);

  assert.match(worker, /request\.method === "PATCH"/);
  assert.match(worker, /WHERE id = \? AND user_email = \?/);
  assert.match(worker, /UPDATE sale_viewings/);
  assert.match(worker, /allowPast: true/);
  assert.match(worker, /ORDER BY viewing_at DESC/);
  assert.match(history, /dataset\.historyAction = action/);
  assert.match(history, /method: "PATCH"/);
  assert.match(history, /dataset\.historyField = field/);
  assert.match(styles, /sales-history-edit-input/);
  assert.match(styles, /sales-history-save-button/);
});
