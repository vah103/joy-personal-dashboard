import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// PR-only smoke coverage also exercises the full current main tree in CI.
test("Sale viewings no longer depend on Google Sheets at runtime", async () => {
  const [router, worker, assistant] = await Promise.all([
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
  ]);

  assert.match(router, /isSaleViewingRoute/);
  assert.match(router, /runSaleViewingSchedule/);
  assert.match(worker, /FROM sale_viewings/);
  assert.match(worker, /INSERT INTO sale_viewings/);
  assert.doesNotMatch(worker, /Google Sheets|sheets\.googleapis|SALE_SPREADSHEET_ID|Appointments!/);
  assert.match(assistant, /data-assistant-mode="history"/);
});
