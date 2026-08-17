import { installAppointmentForm, isAppointmentSaving } from "./appointment-form.js";
import { installAssistantView } from "./assistant-view.js";
import { installDashboardSale } from "./dashboard-sale.js";

async function initializeSalesAssistant() {
  if (!installDashboardSale()) return;
  installAssistantView({ isAppointmentSaving });
  installAppointmentForm();
  await import("../room-summary/room-summary.js");
  window.dispatchEvent(new CustomEvent("joy:sale-assistant-ready"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSalesAssistant, { once: true });
} else {
  void initializeSalesAssistant();
}
