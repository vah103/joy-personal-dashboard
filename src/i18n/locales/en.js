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
  "cleanup.sale.roomArea": "Area",
  "cleanup.sale.roomFloor": "Floor",
  "cleanup.sale.includes": "includes",
  "cleanup.sale.roomsCount": "{count} rooms",
  "cleanup.sale.roomsCountAvailability": "{count} rooms · {availability}",
  "cleanup.sale.fromDate": "From {date}",
  "cleanup.sale.availableNow": "Available now",
  "cleanup.sale.available": "Available",
  "cleanup.sale.unknownAvailability": "Availability unclear",
  "cleanup.sale.yes": "Yes",
  "cleanup.sale.no": "No",
  "cleanup.sale.serviceElectricity": "Electricity",
  "cleanup.sale.serviceWater": "Water",
  "cleanup.sale.serviceInternet": "Internet",
  "cleanup.sale.serviceCommon": "Common services",
  "cleanup.sale.serviceParking": "Parking",
  "cleanup.sale.serviceFridge": "Fridge",
  "cleanup.sale.serviceLaundry": "Laundry",
  "cleanup.sale.serviceOther": "Other",
  "cleanup.sale.aiAnalyzing": "AI is analyzing…",
  "cleanup.sale.aiAnalysisComplete": "AI analysis complete",
  "cleanup.sale.parserFallback": "Parser fallback",
  "cleanup.sale.summaryFailed": "Could not create summary",
  "cleanup.sale.summaryFailedDetail": "Try again. If this keeps happening, refresh Joy and retry.",
});
