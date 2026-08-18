import "../sw-locale.js";
import "../dynamic-runtime.js";
import core from "./en-core.js";
import hardening from "./en-hardening.js";
import cleanup from "./en-cleanup.js";
import dynamicUi from "./en-dynamic-ui.js";

export default Object.freeze({
  ...core,
  ...hardening,
  ...cleanup,
  ...dynamicUi,
  "p1008.water": "Household water",
  "p1008.parking": "Parking fee",
  "sales.reminder30": "At viewing time",
  "saleAssistant.savedReminder": "Appointment saved. Joy will remind you at the viewing time and follow up afterward.",
  "saleAssistant.savedTooClose": "Appointment saved. Joy will remind you at the viewing time and follow up afterward.",
});
