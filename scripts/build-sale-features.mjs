import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sales = resolve(root, "src", "features", "sales");
const dist = resolve(root, "dist");

const copies = [
  // Public compatibility assets keep their existing URLs while source ownership lives by feature.
  ["entries/sales-assistant.js", "sales-assistant.js"],
  ["entries/history-row-edit.js", "sale-history-row-edit.js"],
  ["entries/sale-ui.js", "sale-english-ui.js"],
  ["entries/appointment.js", "sale-appointment.js"],
  ["assistant/assistant.css", "sales-assistant.css"],
  ["history/history.css", "sale-history-row-edit.css"],
  ["manager/manager.js", "sale-manager.js"],
  ["manager/manager.css", "sale-manager.css"],
  ["room-summary/legacy-room-summary.js", "room-summary.js"],
  ["room-summary/room-summary.css", "room-summary.css"],

  // Canonical modules referenced by the public entries.
  ["shared/i18n.js", "shared/i18n.js"],
  ["shared/dates.js", "shared/dates.js"],
  ["room-summary/formatter.js", "room-summary/formatter.js"],
  ["room-summary/renderer.js", "room-summary/renderer.js"],
  ["room-summary/room-summary.js", "room-summary/room-summary.js"],
  ["assistant/assistant.js", "assistant/assistant.js"],
  ["assistant/assistant-view.js", "assistant/assistant-view.js"],
  ["appointments/parser.js", "appointments/parser.js"],
  ["appointments/appointment-form.js", "appointments/appointment-form.js"],
  ["history/history.js", "history/history.js"],
  ["history/history-edit.js", "history/history-edit.js"],
  ["history/close-deal.js", "history/close-deal.js"],
];

for (const directory of ["shared", "room-summary", "assistant", "appointments", "history"]) {
  await mkdir(resolve(dist, directory), { recursive: true });
}
await Promise.all(copies.map(([source, destination]) => cp(resolve(sales, source), resolve(dist, destination))));

console.log("Built canonical Sale feature modules and public compatibility assets.");
