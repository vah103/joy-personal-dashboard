import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("ended streaks remain visible on historical dates and gray out on the end date", async () => {
  const streak = await source("scripts/build-daily-day-streak.mjs");

  assert.match(streak, /const runVisibleOnDate =/);
  assert.match(streak, /if \(run\?\.status === "active"\) return true/);
  assert.match(streak, /return Boolean\(lastDate && dateKey <= lastDate\)/);
  assert.match(streak, /const visibleRuns = Object\.values\(data\.runs \|\| \{\}\)/);
  assert.match(streak, /run\.status === "ended" && String\(run\.endDate \|\| ""\) === dateKey/);
  assert.match(streak, /dd-streak-run\.end-day/);
  assert.match(streak, /background:#eef0ee/);
  assert.match(streak, /dd-streak-ended-note/);
  assert.match(streak, /const archived = run\.status !== "active"/);
  assert.match(streak, /const canCheck = !archived/);
  assert.doesNotMatch(streak, /finishedToday/);
});
