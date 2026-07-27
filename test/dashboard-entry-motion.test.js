import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const motionJs = await readFile(new URL("../src/features/motion/dashboard-entry.js", import.meta.url), "utf8");
const motionCss = await readFile(new URL("../src/features/motion/dashboard-entry.css", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("dashboard greeting motion is independent from Finance", () => {
  assert.match(motionJs, /function animateGreetingCharacters/);
  assert.match(motionJs, /joy-motion-character/);
  assert.doesNotMatch(motionJs, /financeData|financeSummary|financeFetch/);
});

test("dashboard entry transitions cover greeting and main cards", () => {
  assert.match(motionCss, /#today-label/);
  assert.match(motionCss, /\.brand/);
  assert.match(motionCss, /\.joy-motion-character/);
  assert.match(motionCss, /\.projects-panel/);
  assert.match(motionCss, /\.finance-panel/);
  assert.match(motionCss, /\.email-panel/);
});

test("Cloudflare build copies and loads the entry motion module", () => {
  assert.match(buildSource, /dashboard-entry\.css\?v=joy-entry-motion-v1/);
  assert.match(buildSource, /dashboard-entry\.js\?v=joy-entry-motion-v1/);
  assert.match(buildSource, /resolve\(features, "motion", "dashboard-entry\.js"\)/);
  assert.match(buildSource, /resolve\(features, "motion", "dashboard-entry\.css"\)/);
});
