import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const weatherSource = fs.readFileSync(
  new URL("../src/features/weather/weather-rain.js", import.meta.url),
  "utf8",
);
const enLocale = fs.readFileSync(
  new URL("../src/i18n/locales/en.js", import.meta.url),
  "utf8",
);
const viLocale = fs.readFileSync(
  new URL("../src/i18n/locales/vi.js", import.meta.url),
  "utf8",
);

test("weekly weather popup uses a Today hero and six secondary forecast cards", () => {
  assert.match(weatherSource, /data-weather-role="today-hero"/);
  assert.match(weatherSource, /data-weather-role="secondary-day"/);
  assert.match(weatherSource, /secondaryDays\.length !== 6/);
  assert.match(weatherSource, /joy-weather-secondary-grid/);
  assert.match(weatherSource, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("weekly weather popup uses richer SVG weather art and Today detail data", () => {
  assert.match(weatherSource, /function weatherArt\(/);
  assert.match(weatherSource, /radialGradient id=/);
  assert.match(weatherSource, /current=apparent_temperature,relative_humidity_2m/);
  assert.match(weatherSource, /weekState\.current\.apparentTemperature/);
  assert.match(weatherSource, /weekState\.current\.humidity/);
});

test("weekly weather popup animates open and close without changing its layout", () => {
  assert.match(weatherSource, /joy-weather-week-backdrop\.is-open/);
  assert.match(weatherSource, /transform:translateY\(24px\) scale\(\.96\)/);
  assert.match(weatherSource, /transition-duration:240ms,300ms/);
  assert.match(weatherSource, /cubic-bezier\(\.16,1,\.3,1\)/);
  assert.match(weatherSource, /void modal\.offsetWidth/);
  assert.match(weatherSource, /modal\.classList\.add\("is-open"\)/);
  assert.match(weatherSource, /modal\.classList\.remove\("is-open"\)/);
  assert.match(weatherSource, /root\.setTimeout\(finishClose, 220\)/);
  assert.match(weatherSource, /prefers-reduced-motion:reduce/);
  assert.match(weatherSource, /reduceMotion/);
});

test("new weekly weather UI copy stays in the shared bilingual locale system", () => {
  for (const key of [
    "dynamic.weather.today",
    "dynamic.weather.yesterday",
    "dynamic.weather.now",
    "dynamic.weather.realFeel",
    "dynamic.weather.humidity",
    "dynamic.weather.rainAt",
    "dynamic.weather.highLowAria",
  ]) {
    assert.ok(enLocale.includes(`"${key}"`), `missing English key ${key}`);
    assert.ok(viLocale.includes(`"${key}"`), `missing Vietnamese key ${key}`);
  }
});
