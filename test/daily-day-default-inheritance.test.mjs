import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("new Daily Day dates inherit the morning Default day without rewriting history", async () => {
  const [dailyDay, build] = await Promise.all([
    source("src/features/daily-day/daily-day.js"),
    source("scripts/build-daily-day.mjs"),
  ]);

  assert.match(dailyDay, /const DEFAULT_TEMPLATE_ID = "morning"/);
  assert.match(dailyDay, /const DEFAULT_TEMPLATE_START = "2026-09-24"/);
  assert.match(dailyDay, /if \(TEMPLATE_IDS\.includes\(id\)\) return id; if \(dateKey >= DEFAULT_TEMPLATE_START\) return DEFAULT_TEMPLATE_ID; return "no_workout"/);
  assert.match(build, /morning: \[/);
  assert.match(build, /\["07:30", "đi tập", \[\.\.\.workoutItems\]\]/);
  assert.match(build, /const workoutChoice = \(dateKey\) =>/);
});
