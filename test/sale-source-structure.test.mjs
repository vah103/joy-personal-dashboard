import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

async function names(url) {
  return (await readdir(url)).sort();
}

test("Sale source ownership stays feature-first and the page stays layout-only", async () => {
  const root = new URL("../src/features/sales/", import.meta.url);
  const rootEntries = await readdir(root, { withFileTypes: true });

  assert.deepEqual(
    rootEntries.map((entry) => entry.name).sort(),
    ["appointments", "assistant", "manager", "room-summary", "shared"],
  );
  assert.ok(rootEntries.every((entry) => entry.isDirectory()));

  assert.deepEqual(await names(new URL("assistant/", root)), ["sales-assistant.css", "sales-assistant.js"]);
  assert.deepEqual(await names(new URL("appointments/", root)), ["appointment.js", "history.css", "history.js"]);
  assert.deepEqual(await names(new URL("room-summary/", root)), ["room-summary.css", "room-summary.js"]);
  assert.deepEqual(await names(new URL("manager/", root)), ["sale-manager.css", "sale-manager.js"]);
  assert.deepEqual(await names(new URL("shared/", root)), ["format.js", "i18n.js"]);

  assert.deepEqual(
    await names(new URL("../src/pages/sale/", import.meta.url)),
    ["index.html"],
  );
});

test("Sale frontend owners do not reintroduce legacy patch layers", async () => {
  const [assistant, history, manager, format] = await Promise.all([
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/manager/sale-manager.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/shared/format.js", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(assistant, /renderViewingHistory|loadViewingHistory|sales-assistant-launch|sales-history-refresh/);
  assert.doesNotMatch(history, /MutationObserver|mergeReminderColumns|syncDealStates|sales-history-refresh|sales-history-cancel-button/);
  assert.doesNotMatch(history, /function formatVnd\(/);
  assert.doesNotMatch(manager, /function formatVnd\(/);
  assert.match(format, /export function formatVnd/);
  assert.match(format, /export function vietnamMonthKey/);
});
