import {
  closeAssistant,
  createAssistantLaunchers,
  createAssistantModal,
  openAssistant,
  switchAssistantMode,
} from "./assistant-view.js";
import { installAppointmentForm } from "../appointments/appointment-form.js";
import {
  cancelViewingHistoryEdit,
  handleViewingHistoryAction,
  loadViewingHistory,
  markViewingHistoryStale,
  refreshViewingHistory,
} from "../history/history.js";

async function initializeSalesAssistant() {
  if (!createAssistantLaunchers()) return;
  const managerButton = document.querySelector('#sales .panel-heading [data-action="open-sale-manager"]:last-child');
  if (managerButton) managerButton.textContent = "Sale Manager ↗";
  createAssistantModal();

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action], [data-assistant-mode]");
    if (!control) return;
    if (control.dataset.action === "open-sales-assistant") openAssistant();
    if (control.dataset.action === "close-sales-assistant") closeAssistant();
    handleViewingHistoryAction(control);
    if (control.dataset.assistantMode) {
      switchAssistantMode(control.dataset.assistantMode, () => loadViewingHistory());
    }
  });

  document.querySelector("#sales-assistant-modal")?.addEventListener("mousedown", (event) => {
    if (event.target.id === "sales-assistant-modal") closeAssistant();
  });

  installAppointmentForm({ onSaved: markViewingHistoryStale });

  document.querySelector("#sales-history-refresh")?.addEventListener("click", () => {
    refreshViewingHistory();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && cancelViewingHistoryEdit()) return;
    if (event.key === "Escape" && !document.querySelector("#sales-assistant-modal")?.hidden) closeAssistant();
  });

  await import("/room-summary.js?v=joy-room-summary-v1");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSalesAssistant, { once: true });
} else {
  initializeSalesAssistant();
}
