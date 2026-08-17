import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const featureRoot = new URL("../src/features/sales/", import.meta.url);
const files = async (dir) => (await readdir(new URL(`${dir}/`, featureRoot))).sort();

test("Sale frontend is organized by focused feature owners", async () => {
  assert.deepEqual(await files("assistant"), [
    "appointment-form.js", "assistant-view.js", "dashboard-sale.js", "sales-assistant.css", "sales-assistant.js",
  ]);
  assert.deepEqual(await files("appointments"), ["appointment.js", "close-deal.js", "history.css", "history.js"]);
  assert.deepEqual(await files("room-summary"), ["parser.js", "renderer.js", "room-summary.css", "room-summary.js"]);
  assert.deepEqual(await files("manager"), ["sale-manager.css", "sale-manager.js"]);
  assert.deepEqual(await files("shared"), ["api.js", "format.js", "i18n.js", "text.js"]);
});

test("controllers use the shared Sale API and canonical source imports", async () => {
  const [assistant, appointmentForm, dashboardSale, history, closeDeal, manager, roomEntry] = await Promise.all([
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/appointment-form.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/dashboard-sale.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/close-deal.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/manager/sale-manager.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/room-summary/room-summary.js", import.meta.url), "utf8"),
  ]);
  assert.match(assistant, /appointment-form\.js/);
  assert.match(assistant, /assistant-view\.js/);
  assert.match(assistant, /dashboard-sale\.js/);
  for (const source of [appointmentForm, dashboardSale, history, closeDeal, manager]) assert.match(source, /shared\/api\.js/);
  assert.match(roomEntry, /parser\.js/);
  assert.match(roomEntry, /renderer\.js/);
  assert.doesNotMatch(appointmentForm, /await fetch\(/);
  assert.doesNotMatch(dashboardSale, /await fetch\(/);
  assert.doesNotMatch(history, /await fetch\(/);
  assert.doesNotMatch(closeDeal, /await fetch\(/);
  assert.doesNotMatch(manager, /async function apiRequest|await fetch\(/);
});

test("Appointment and Room Summary share text normalization helpers", async () => {
  const [appointment, parser, sharedText] = await Promise.all([
    readFile(new URL("../src/features/sales/appointments/appointment.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/room-summary/parser.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/shared/text.js", import.meta.url), "utf8"),
  ]);
  assert.match(appointment, /shared\/text\.js/);
  assert.match(parser, /shared\/text\.js/);
  assert.doesNotMatch(appointment, /function normalizeSearch|function normalizeText/);
  assert.doesNotMatch(parser, /function normalizeSearch|function normalizeWhitespace|function capitalizeFirst|function lowerFirst/);
  assert.match(sharedText, /export function normalizeText/);
  assert.match(sharedText, /export function normalizeWhitespace/);
  assert.match(sharedText, /export function normalizeSearch/);
  assert.match(sharedText, /export function capitalizeFirst/);
  assert.match(sharedText, /export function lowerFirst/);
});

test("Sale build copies the canonical module tree and keeps public compatibility entries", async () => {
  const build = await readFile(new URL("../scripts/build-sales.mjs", import.meta.url), "utf8");
  assert.match(build, /rm\(publicSales, \{ recursive: true, force: true \}\)/);
  assert.match(build, /cp\(salesSource, publicSales, \{ recursive: true, force: true \}\)/);
  assert.match(build, /versionRelativeModuleImports/);
  for (const entry of ["sales-assistant.js", "sale-history-row-edit.js", "sale-manager.js", "room-summary.js", "sale-english-ui.js"]) {
    assert.match(build, new RegExp(`"${entry.replaceAll(".", "\\.")}"`));
  }
  assert.match(build, /export \* from/);
});
