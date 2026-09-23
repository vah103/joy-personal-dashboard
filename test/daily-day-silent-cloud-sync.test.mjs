import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Daily Day cloud polling no longer simulates an active-date click", async () => {
  const [dailyDay, sync, streak] = await Promise.all([
    source("src/features/daily-day/daily-day.js"),
    source("scripts/build-daily-day-sync.mjs"),
    source("scripts/build-daily-day-streak.mjs"),
  ]);

  assert.match(sync, /const stableJson = \(value\) => JSON\.stringify\(stableValue\(value\)\)/);
  assert.match(sync, /checksChanged:/);
  assert.match(sync, /overridesChanged:/);
  assert.match(sync, /coreWorkoutsChanged:/);
  assert.match(sync, /templateVersionsChanged:/);
  assert.match(sync, /workoutValuesChanged/);
  assert.match(sync, /streakChanged/);
  assert.match(sync, /CustomEvent\("joy:daily-day-cloud-applied", \{ detail \}\)/);
  assert.doesNotMatch(sync, /activeDate\.click\(\)/);
  assert.doesNotMatch(sync, /const refreshVisibleUi\s*=/);

  assert.match(dailyDay, /window\.addEventListener\("joy:daily-day-cloud-applied"/);
  assert.match(dailyDay, /refreshCheckProgress\(null\)/);
  assert.match(dailyDay, /checkbox\.checked = checked\(view\.date, checkbox\.dataset\.ddCheck\)/);
  assert.match(dailyDay, /const structuralChange = Boolean/);

  assert.match(streak, /event\.detail\?\.streakChanged/);
});
