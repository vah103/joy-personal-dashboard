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
  "dynamic.sale.joyRoomEmptyHelp": "Prepare Joy Room Text in ChatGPT, then paste the full result here.",
  "dynamic.sale.joyRoomFormatErrorTitle": "Joy Room Text format is invalid",
  "dynamic.sale.joyRoomFormatErrorHelp": "Go back to ChatGPT, fix the draft to Joy Room Text v1, then paste the full result again.",
});
