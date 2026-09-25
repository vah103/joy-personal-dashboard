import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("completed streaks are pinned to the Daily Day calendar", async () => {
  const streak = await source("scripts/build-daily-day-streak.mjs");
  assert.match(streak, /dd-calendar-achievement/);
  assert.match(streak, /run\.status !== "completed"/);
  assert.match(streak, /completedByDate\[run\.completedDate\]/);
  assert.match(streak, /badge\.textContent = runs\.length > 1 \? "🏆" \+ runs\.length : "🏆"/);
  assert.match(streak, /run\.completedDate = status === "completed" \? dateKey : null/);
});
