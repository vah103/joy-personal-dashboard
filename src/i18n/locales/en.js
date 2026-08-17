import "../sw-locale.js";
import "../dynamic-runtime.js";
import core from "./en-core.js";
import hardening from "./en-hardening.js";
import cleanup from "./en-cleanup.js";
import dynamicUi from "./en-dynamic-ui.js";
import saleFlow from "./en-sale-flow.js";

export default Object.freeze({
  ...core,
  ...hardening,
  ...cleanup,
  ...dynamicUi,
  ...saleFlow,
  "p1008.water": "Household water",
  "p1008.parking": "Parking fee",
});
