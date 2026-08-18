import {
  createPassThroughSummary,
  openPassThroughCapture,
} from "./renderer.js";

export function installRoomSummaryPassThrough(doc = globalThis.document) {
  if (!doc?.documentElement || doc.documentElement.dataset.roomSummaryPassThrough === "true") return;
  doc.documentElement.dataset.roomSummaryPassThrough = "true";

  doc.addEventListener("click", (event) => {
    if (event.target.closest?.("#room-summary-generate")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      createPassThroughSummary(doc);
      return;
    }
    if (event.target.closest?.("#room-summary-capture-button")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openPassThroughCapture(doc);
    }
  }, true);

  doc.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
    if (!event.target?.matches?.("#room-summary-input")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    createPassThroughSummary(doc);
  }, true);
}
