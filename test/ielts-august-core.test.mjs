import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function program() {
  return JSON.parse(await readFile(new URL("project-data/ielts/program-2026.json", root), "utf8"));
}

test("IELTS program keeps August inside the Band 7 journey to December", async () => {
  const plan = await program();

  assert.equal(plan.programId, "ielts-band-7-december-2026");
  assert.deepEqual(plan.target, {
    overall: 7,
    minimumSkill: 6.5,
    date: "2026-12-31",
  });
  assert.deepEqual(
    plan.phases.map((phase) => phase.month),
    ["August", "September", "October", "November", "December"],
  );
  assert.equal(plan.phases[0].title, "Foundation");
  assert.equal(plan.phases.at(-1).title, "Peak & Test");
});

test("August contains four weeks, twelve six-hour rhythms and the external course", async () => {
  const plan = await program();
  const weeks = plan.august.weeks;
  const rhythms = weeks.flatMap((week) => week.rhythms);

  assert.equal(weeks.length, 4);
  assert.equal(rhythms.length, 12);
  assert.equal(plan.august.weeklyHours, 18);
  assert.equal(plan.august.rhythmHours, 6);
  rhythms.forEach((rhythm) => {
    assert.equal(
      rhythm.tasks.reduce((sum, task) => sum + task.minutes, 0),
      360,
      `${rhythm.id} should contain six hours`,
    );
  });
  assert.deepEqual(
    plan.course.schedule.map((item) => item.focus),
    ["Writing Task 1", "Writing Task 2"],
  );
  assert.ok(rhythms.flatMap((rhythm) => rhythm.tasks).some((task) => task.kind === "course"));
});

test("every self-study task is actionable and every baseline skill is covered", async () => {
  const plan = await program();
  const tasks = [
    ...plan.prelaunch,
    ...plan.baseline.tasks,
    ...plan.august.weeks.flatMap((week) => week.rhythms.flatMap((rhythm) => rhythm.tasks)),
  ];
  const baselineSkills = new Set(plan.baseline.tasks.map((task) => task.skill));

  assert.deepEqual(
    [...baselineSkills].sort(),
    ["listening", "reading", "speaking", "writing"],
  );
  tasks.forEach((task) => {
    assert.ok(task.id);
    assert.ok(task.title);
    assert.ok(task.objective);
    assert.ok(task.minutes > 0);
    assert.ok(Array.isArray(task.steps) && task.steps.length > 0);
    assert.ok(task.output);
    assert.ok(Array.isArray(task.doneWhen) && task.doneWhen.length > 0);
  });
});
