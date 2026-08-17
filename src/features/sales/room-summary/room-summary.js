import { summarizeRoomListing } from "./parser.js";
import { refreshRoomSummaryLocale, renderRoomSummary } from "./renderer.js";

export { summarizeRoomListing } from "./parser.js";
export { refreshRoomSummaryLocale, renderRoomSummary } from "./renderer.js";

export function initializeRoomSummary() {
  const input = document.querySelector("#room-summary-input");
  const output = document.querySelector("#room-summary-card");
  const generate = document.querySelector("#room-summary-generate");
  const clear = document.querySelector("#room-summary-clear");
  const capture = document.querySelector("#room-summary-capture-button");
  const captureLayer = document.querySelector("#room-summary-capture");
  const captureCard = document.querySelector("#room-summary-capture-card");
  if (!input || !output || !generate || !clear || !capture || !captureLayer || !captureCard) return;
  if (output.dataset.roomSummaryInstalled === "true") return;
  output.dataset.roomSummaryInstalled = "true";

  let current = summarizeRoomListing("");
  renderRoomSummary(output, current);

  const refreshCapture = () => {
    if (captureLayer.hidden || current.isEmpty) return;
    const clone = output.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
    captureCard.replaceChildren(clone);
  };

  const createSummary = () => {
    current = summarizeRoomListing(input.value);
    renderRoomSummary(output, current);
    capture.disabled = current.isEmpty;
    output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const refreshLocale = () => {
    refreshRoomSummaryLocale(output);
    refreshCapture();
  };

  generate.addEventListener("click", createSummary);
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") createSummary();
  });
  output.addEventListener("input", (event) => {
    event.target.closest?.("[data-room-availability-text]")?.removeAttribute("data-room-availability-text");
  });
  clear.addEventListener("click", () => {
    input.value = "";
    current = summarizeRoomListing("");
    renderRoomSummary(output, current);
    capture.disabled = true;
    input.focus();
  });
  capture.addEventListener("click", () => {
    if (current.isEmpty) return;
    const clone = output.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
    captureCard.replaceChildren(clone);
    captureLayer.hidden = false;
    document.body.classList.add("sale-room-capture-open");
  });
  captureLayer.addEventListener("click", () => {
    captureLayer.hidden = true;
    document.body.classList.remove("sale-room-capture-open");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !captureLayer.hidden) {
      captureLayer.hidden = true;
      document.body.classList.remove("sale-room-capture-open");
    }
  });
  window.addEventListener("joy:i18n-ready", refreshLocale);
  window.addEventListener("joy:locale-changed", refreshLocale);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeRoomSummary, { once: true });
  else initializeRoomSummary();
}
