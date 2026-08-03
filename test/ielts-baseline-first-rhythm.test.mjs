import test from "node:test";
import assert from "node:assert/strict";

import { currentIeltsContext } from "../worker/ielts-assistant.js";

const baselineTasks = [
  {
    id: "baseline-listening",
    kind: "test",
    skill: "listening",
    title: "Listening baseline",
    minutes: 90,
    objective: "Measure Listening.",
    steps: [],
    output: "Listening evidence.",
    doneWhen: ["Completed."],
  },
  {
    id: "baseline-reading",
    kind: "test",
    skill: "reading",
    title: "Reading baseline",
    minutes: 130,
    objective: "Measure Reading.",
    steps: [],
    output: "Reading evidence.",
    doneWhen: ["Completed."],
  },
];

const repairTasks = [
  {
    id: "aug-w1-r1-listening",
    kind: "guided",
    skill: "listening",
    title: "Repair Listening",
    minutes: 120,
    objective: "Repair baseline errors.",
    steps: [],
    output: "Corrected drill.",
    doneWhen: ["Reviewed."],
  },
];

const program = {
  prelaunch: [],
  baseline: {
    objective: "Measure the starting point.",
    tasks: baselineTasks,
  },
  august: {
    weeks: [
      {
        id: "aug-w1",
        number: 1,
        title: "Foundation & Error Awareness",
        rhythms: [
          {
            id: "aug-w1-r1",
            label: "Rhythm 1",
            days: "Mon–Tue",
            dateRange: "3–4 Aug",
            objective: "Repair the weakest baseline patterns.",
            tasks: repairTasks,
          },
        ],
      },
    ],
  },
  phases: [],
};

function state(completedIds = []) {
  return {
    taskStates: Object.fromEntries(completedIds.map((id) => [id, { status: "completed" }])),
    customTasks: [],
  };
}

test("Rhythm 1 shows baseline tasks first while any baseline task is unfinished", () => {
  const context = currentIeltsContext(state(["baseline-listening"]), "2026-08-03", program);

  assert.equal(context.type, "rhythm");
  assert.equal(context.id, "aug-w1-r1");
  assert.match(context.objective, /baseline/i);
  assert.deepEqual(context.tasks.map((task) => task.id), baselineTasks.map((task) => task.id));
  assert.equal(context.targetMinutes, 220);
});

test("Rhythm 1 switches to repair work after every baseline task is completed", () => {
  const context = currentIeltsContext(
    state(baselineTasks.map((task) => task.id)),
    "2026-08-03",
    program,
  );

  assert.equal(context.type, "rhythm");
  assert.equal(context.id, "aug-w1-r1");
  assert.equal(context.objective, "Repair the weakest baseline patterns.");
  assert.deepEqual(context.tasks.map((task) => task.id), repairTasks.map((task) => task.id));
  assert.equal(context.targetMinutes, 360);
});
