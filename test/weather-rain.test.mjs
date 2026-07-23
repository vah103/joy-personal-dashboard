import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

await import("../weather-rain.js");

const { summarizeRainForecast } = globalThis.JoyWeather;

test("groups consecutive rainy hours into one compact window", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T17:00",
      "2026-07-23T18:00",
      "2026-07-23T19:00",
      "2026-07-23T20:00",
      "2026-07-23T21:00",
    ],
    precipitation_probability: [10, 55, 82, 65, 20],
    precipitation: [0, 0.2, 1.5, 0.4, 0],
    weather_code: [2, 61, 63, 61, 2],
  }, new Date("2026-07-23T16:30:00+07:00"));

  assert.equal(result.state, "rain");
  assert.equal(result.text, "Rain possible: 18:00–21:00");
});

test("shows a quiet notice when no meaningful rain remains today", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T14:00",
      "2026-07-23T15:00",
      "2026-07-23T16:00",
    ],
    precipitation_probability: [10, 20, 25],
    precipitation: [0, 0, 0],
    weather_code: [1, 2, 2],
  }, new Date("2026-07-23T13:00:00+07:00"));

  assert.equal(result.state, "clear");
  assert.equal(result.text, "No significant rain expected today");
});

test("ignores rain windows that have already passed", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T06:00",
      "2026-07-23T07:00",
      "2026-07-23T18:00",
      "2026-07-23T19:00",
    ],
    precipitation_probability: [80, 70, 45, 60],
    precipitation: [2, 1, 0.2, 0.6],
    weather_code: [63, 61, 61, 61],
  }, new Date("2026-07-23T12:00:00+07:00"));

  assert.equal(result.text, "Rain possible: 18:00–20:00");
});

test("weather helper is loaded before app and copied into dist", () => {
  const html = fs.readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  );

  const build = fs.readFileSync(
    new URL("../scripts/build.mjs", import.meta.url),
    "utf8",
  );

  assert.ok(html.includes('id="weather-rain-notice"'));
  assert.ok(
    html.indexOf("weather-rain.js") < html.indexOf("app.js"),
  );
  assert.ok(build.includes('resolve(root, "weather-rain.js")'));
});
