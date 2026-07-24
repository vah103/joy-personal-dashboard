import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

await import("../weather-rain.js");

const { summarizeRainForecast } = globalThis.JoyWeather;

test("reports a one-hour strong rain window", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T19:00",
      "2026-07-23T20:00",
      "2026-07-23T21:00",
    ],
    precipitation_probability: [40, 82, 45],
    precipitation: [0.1, 1.2, 0.1],
    weather_code: [51, 63, 51],
  }, new Date("2026-07-23T17:00:00+07:00"));

  assert.equal(result.state, "rain");
  assert.equal(result.text, "Strong rain signal: 19:00–20:00");
});

test("keeps the full variable-length strong window", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T19:00",
      "2026-07-23T20:00",
      "2026-07-23T21:00",
      "2026-07-23T22:00",
      "2026-07-23T23:00",
    ],
    precipitation_probability: [75, 82, 78, 74, 35],
    precipitation: [0.5, 1.4, 1.1, 0.4, 0.1],
    weather_code: [61, 63, 63, 61, 51],
  }, new Date("2026-07-23T17:00:00+07:00"));

  assert.equal(
    result.text,
    "Strong rain signal: 18:00–22:00",
  );
});

test("does not notify for weak rain signals", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T19:00",
      "2026-07-23T20:00",
      "2026-07-23T21:00",
    ],
    precipitation_probability: [45, 55, 65],
    precipitation: [0.1, 0.2, 0.2],
    weather_code: [51, 51, 61],
  }, new Date("2026-07-23T17:00:00+07:00"));

  assert.equal(result.state, "quiet");
  assert.equal(result.text, "");
});

test("a weak hour separates two strong windows", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T19:00",
      "2026-07-23T20:00",
      "2026-07-23T21:00",
      "2026-07-23T22:00",
    ],
    precipitation_probability: [80, 45, 85, 82],
    precipitation: [1.2, 0.1, 1.4, 0.8],
    weather_code: [63, 51, 63, 63],
  }, new Date("2026-07-23T17:00:00+07:00"));

  assert.equal(
    result.text,
    "Strong rain signal: 18:00–19:00 and 20:00–22:00",
  );
});

test("ignores strong rain intervals that have already ended", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T08:00",
      "2026-07-23T19:00",
      "2026-07-23T20:00",
    ],
    precipitation_probability: [90, 75, 80],
    precipitation: [2, 0.5, 1],
    weather_code: [63, 61, 63],
  }, new Date("2026-07-23T12:00:00+07:00"));

  assert.equal(
    result.text,
    "Strong rain signal: 18:00–20:00",
  );
});

test("uses the API timestamp as the end of the hourly interval", () => {
  const result = summarizeRainForecast({
    time: ["2026-07-23T18:00"],
    precipitation_probability: [85],
    precipitation: [1.2],
    weather_code: [63],
  }, new Date("2026-07-23T17:05:00+07:00"));

  assert.equal(
    result.text,
    "Strong rain signal: 17:00–18:00",
  );
});

test("weather assets and quiet-state hiding are wired correctly", () => {
  const html = fs.readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  );

  const app = fs.readFileSync(
    new URL("../app.js", import.meta.url),
    "utf8",
  );

  const build = fs.readFileSync(
    new URL("../scripts/build.mjs", import.meta.url),
    "utf8",
  );

  assert.ok(html.includes('id="weather-rain-notice"'));
  assert.ok(html.indexOf("weather-rain.js") < html.indexOf("app.js"));
  assert.ok(app.includes("weatherRainNotice.hidden"));
  assert.ok(build.includes('resolve(root, "weather-rain.js")'));
});
