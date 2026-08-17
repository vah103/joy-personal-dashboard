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

test("Sale frontend owners use canonical source imports and the build maps them to versioned public assets", async () => {
  const [assistant, history, manager, format, salesBuild, packageJson] = await Promise.all([
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/manager/sale-manager.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/shared/format.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-sales.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(assistant, /from "\.\.\/appointments\/appointment\.js"/);
  assert.match(assistant, /from "\.\.\/shared\/format\.js"/);
  assert.match(assistant, /import\("\.\.\/room-summary\/room-summary\.js/);
  assert.match(history, /from "\.\/appointment\.js"/);
  assert.match(history, /from "\.\.\/shared\/format\.js"/);
  assert.match(manager, /from "\.\.\/shared\/format\.js"/);
  assert.doesNotMatch(assistant, /\.\/sale-appointment\.js|\.\/sale-format\.js|\.\/room-summary\.js/);
  assert.doesNotMatch(history, /\.\/sale-appointment\.js|\.\/sale-format\.js/);
  assert.doesNotMatch(manager, /\.\/sale-format\.js/);

  assert.doesNotMatch(assistant, /renderViewingHistory|loadViewingHistory|sales-assistant-launch|sales-history-refresh/);
  assert.doesNotMatch(history, /MutationObserver|mergeReminderColumns|syncDealStates|sales-history-refresh|sales-history-cancel-button/);
  assert.doesNotMatch(history, /function formatVnd\(/);
  assert.doesNotMatch(manager, /function formatVnd\(/);
  assert.match(format, /export function formatVnd/);
  assert.match(format, /export function vietnamMonthKey/);

  assert.match(salesBuild, /async function writePublicModule/);
  assert.match(salesBuild, /sale-appointment\.js\?v=\$\{buildVersion\}/);
  assert.match(salesBuild, /sale-format\.js\?v=\$\{buildVersion\}/);
  assert.match(salesBuild, /room-summary\.js\?v=\$\{buildVersion\}/);
  assert.match(salesBuild, /function versionAssetReference/);
  assert.match(salesBuild, /sale-history-row-edit\.js/);
  assert.match(salesBuild, /sale-manager\.js/);
  assert.match(packageJson, /scripts\/build-sales\.mjs/);
});
