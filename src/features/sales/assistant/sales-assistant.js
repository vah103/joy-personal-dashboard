import { installAppointmentForm, isAppointmentSaving } from "./appointment-form.js";
import { installAssistantView } from "./assistant-view.js";
import { installDashboardSale } from "./dashboard-sale.js";

function focusActiveAssistantMode() {
  const modal = document.querySelector("#sales-assistant-modal");
  if (modal?.hidden !== false) return;
  const mode = modal.querySelector("[data-assistant-mode].active")?.dataset.assistantMode || "appointment";
  const target = mode === "summary"
    ? modal.querySelector("#room-summary-input")
    : mode === "history"
      ? modal.querySelector('.sales-history-table tbody tr[tabindex="0"], [data-history-action], [data-assistant-mode="history"]')
      : modal.querySelector("#sale-appointment-input");
  target?.focus();
}

function installAssistantFocus() {
  if (document.body.dataset.saleAssistantFocusInstalled === "true") return;
  document.body.dataset.saleAssistantFocusInstalled = "true";
  document.addEventListener("click", (event) => {
    const control = event.target.closest?.('[data-action="open-sales-assistant"], [data-assistant-mode]');
    if (!control) return;
    window.setTimeout(focusActiveAssistantMode, 0);
  });
  window.addEventListener("joy:sale-history-open", () => window.setTimeout(focusActiveAssistantMode, 0));
}

async function initializeSalesAssistant() {
  if (!installDashboardSale()) return;
  installAssistantView({ isAppointmentSaving });
  installAssistantFocus();
  installAppointmentForm();
  await import("../room-summary/room-summary.js");
  window.dispatchEvent(new CustomEvent("joy:sale-assistant-ready"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSalesAssistant, { once: true });
} else {
  void initializeSalesAssistant();
}
