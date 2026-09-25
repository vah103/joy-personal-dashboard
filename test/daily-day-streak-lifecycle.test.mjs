import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Daily Day streaks have editable lifecycle runs and immutable finished history", async () => {
  const [streak, worker, sync] = await Promise.all([
    source("scripts/build-daily-day-streak.mjs"),
    source("worker/daily-day-sync.js"),
    source("scripts/build-daily-day-sync.mjs"),
  ]);

  assert.match(streak, /schemaVersion: 2/);
  assert.match(streak, /data-dd-streak-new/);
  assert.match(streak, /data-dd-streak-edit/);
  assert.match(streak, /data-dd-streak-end/);
  assert.match(streak, /data-dd-streak-history/);
  assert.match(streak, /data-dd-streak-suggestion-start/);
  assert.match(streak, /data-dd-streak-suggestion-edit/);
  assert.match(streak, /data-dd-streak-suggestion-dismiss/);
  assert.match(streak, /pendingGap/);

  assert.match(worker, /type === "streak-create"/);
  assert.match(worker, /type === "streak-update"/);
  assert.match(worker, /type === "streak-check"/);
  assert.match(worker, /type === "streak-end"/);
  assert.match(worker, /type === "streak-suggestion-accept"/);
  assert.match(worker, /run\.status !== "active"/);
  assert.match(worker, /finishStreakRun\(streak, run, date, "completed"\)/);

  assert.match(sync, /type: "streak-v2-migrate"/);
  assert.doesNotMatch(sync, /type: "streak", date, streakId/);
});
