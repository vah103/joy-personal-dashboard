import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("IELTS August curriculum covers every day with valid missions", async () => {
  const plan = await readJson("project-data/ielts/august-2026.json");
  const ranges = ["01-09", "10-16", "17-23", "24-31"];
  const groups = await Promise.all(ranges.map((range) => (
    readJson(`project-data/ielts/august-days-${range}.json`)
  )));
  const days = groups.flat();

  assert.equal(plan.planId, "ielts-august-2026");
  assert.equal(plan.targetBand, 7);
  assert.equal(days.length, 31);
  assert.equal(new Set(days.map((day) => day.date)).size, 31);
  assert.equal(days[0].date, "2026-08-01");
  assert.equal(days.at(-1).date, "2026-08-31");
  assert.ok(days.every((day) => Array.isArray(day.tasks) && day.tasks.length >= 3));
  assert.ok(days.every((day) => day.tasks.every((task) => task.length === 7)));
  assert.ok(days.every((day) => day.tasks.some((task) => task[1] === "speaking")));
});

test("IELTS August allocation and strict rules match the agreed plan", async () => {
  const plan = await readJson("project-data/ielts/august-2026.json");

  assert.deepEqual(plan.allocation, {
    writing: 55,
    speaking: 25,
    reading: 10,
    listening: 10,
  });
  assert.equal(plan.strictMode.enabledByDefault, true);
  assert.equal(plan.strictMode.speakingMinimumDaysPerWeek, 5);
  assert.equal(plan.strictMode.readingSessionsPerWeek, 2);
  assert.equal(plan.strictMode.listeningSessionsPerWeek, 2);
  assert.equal(plan.strictMode.requiresEvidence, true);
});
