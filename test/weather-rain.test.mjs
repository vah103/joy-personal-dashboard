import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

await import("../src/features/weather/weather-rain.js");

const { summarizeRainForecast } = globalThis.JoyWeather;

test("reports rain only when probability reaches 90 percent", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T19:00",
      "2026-07-23T20:00",
      "2026-07-23T21:00",
    ],
    precipitation_probability: [40, 92, 45],
    precipitation: [0.1, 0.1, 0.1],
    weather_code: [0, 0, 0],
  }, new Date("2026-07-23T17:00:00+07:00"));

  assert.equal(result.state, "rain");
  assert.equal(result.text, "Rain is expected in Hanoi at 19:00–20:00.");
});

test("keeps the full consecutive 90 percent window", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T19:00",
      "2026-07-23T20:00",
      "2026-07-23T21:00",
      "2026-07-23T22:00",
      "2026-07-23T23:00",
    ],
    precipitation_probability: [90, 92, 98, 94, 35],
  }, new Date("2026-07-23T17:00:00+07:00"));

  assert.equal(
    result.text,
    "Rain is expected in Hanoi at 18:00–22:00.",
  );
});

test("returns no rain expected below 90 percent even with a large amount", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T19:00",
      "2026-07-23T20:00",
      "2026-07-23T21:00",
    ],
    precipitation_probability: [45, 89, 65],
    precipitation: [5, 5, 5],
    weather_code: [95, 95, 95],
  }, new Date("2026-07-23T17:00:00+07:00"));

  assert.equal(result.state, "quiet");
  assert.equal(result.text, "No rain is expected.");
});

test("an 89 percent hour separates two rain windows", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T19:00",
      "2026-07-23T20:00",
      "2026-07-23T21:00",
      "2026-07-23T22:00",
    ],
    precipitation_probability: [90, 89, 95, 92],
  }, new Date("2026-07-23T17:00:00+07:00"));

  assert.equal(
    result.text,
    "Rain is expected in Hanoi at 18:00–19:00 and 20:00–22:00.",
  );
});

test("ignores 90 percent rain intervals that have already ended", () => {
  const result = summarizeRainForecast({
    time: [
      "2026-07-23T08:00",
      "2026-07-23T19:00",
      "2026-07-23T20:00",
    ],
    precipitation_probability: [95, 89, 90],
  }, new Date("2026-07-23T12:00:00+07:00"));

  assert.equal(
    result.text,
    "Rain is expected in Hanoi at 19:00–20:00.",
  );
});

test("uses the API timestamp as the end of the hourly interval", () => {
  const result = summarizeRainForecast({
    time: ["2026-07-23T18:00"],
    precipitation_probability: [95],
  }, new Date("2026-07-23T17:05:00+07:00"));

  assert.equal(
    result.text,
    "Rain is expected in Hanoi at 17:00–18:00.",
  );
});

test("weather keeps sunny and no-rain states while rain requires 90 percent", () => {
  const html = fs.readFileSync(
    new URL("../src/pages/dashboard/index.html", import.meta.url),
    "utf8",
  );
  const app = fs.readFileSync(
    new URL("../src/pages/dashboard/app.js", import.meta.url),
    "utf8",
  );
  const build = fs.readFileSync(
    new URL("../scripts/build.mjs", import.meta.url),
    "utf8",
  );
  const statusUi = fs.readFileSync(
    new URL("../src/features/notifications/weather-status-ui.js", import.meta.url),
    "utf8",
  );
  const push = fs.readFileSync(
    new URL("../worker/push.js", import.meta.url),
    "utf8",
  );

  assert.ok(html.includes('id="weather-rain-notice"'));
  assert.ok(html.indexOf("weather-rain.js") < html.indexOf("app.js"));
  assert.ok(app.includes("weatherRainNotice.hidden"));
  assert.ok(build.includes('resolve(features, "weather", "weather-rain.js")'));
  assert.ok(build.includes("rain-threshold-90-v1"));
  assert.ok(build.includes("joy-rain-notice-v5"));
  assert.match(statusUi, /RAIN_PROBABILITY_THRESHOLD = 90/);
  assert.match(statusUi, /sunnyHours/);
  assert.match(statusUi, /It’s a sunny day\./);
  assert.match(statusUi, /No rain is expected\./);
  assert.ok(statusUi.includes('.replace(/\\s*\\(\\d+%\\+\\)\\.?/gi, "")'));
  assert.doesNotMatch(statusUi, /\(90%\+\)\./);
  assert.match(push, /RAIN_PROBABILITY_THRESHOLD = 90/);
  assert.match(push, /\$\{RAIN_PROBABILITY_THRESHOLD\}%\+/);
  assert.match(push, /dailyKind: isSunny \? "sunny" : "chill"/);
  assert.match(push, /It's a sunny day\./);
  assert.doesNotMatch(push, /HIGH_PROBABILITY|STRONG_AMOUNT_MM/);
});
