import "../sw-locale.js";
import core from "./en-core.js";
import hardening from "./en-hardening.js";
import cleanup from "./en-cleanup.js";

export default Object.freeze({
  ...core,
  ...hardening,
  ...cleanup,
  "p1008.water": "Household water",
  "p1008.parking": "Parking fee",
});
