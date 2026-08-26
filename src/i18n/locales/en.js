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
  "dynamic.weather.yesterday": "Yesterday",
  "dynamic.weather.today": "Today",
  "dynamic.weather.now": "Now",
  "dynamic.weather.realFeel": "Real feel",
  "dynamic.weather.humidity": "Humidity",
  "dynamic.weather.noRain": "No rain is expected.",
  "dynamic.weather.sunnyDay": "It’s a sunny day.",
  "dynamic.weather.rainAt": "Rain at {windows}.",
  "dynamic.weather.highLowAria": "High {high}, low {low}",
  "dynamic.weather.tryAgain": "Try again",
  "dynamic.weather.open": "Open the seven-day Hanoi weather overview",
});
