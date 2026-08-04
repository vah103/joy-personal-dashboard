import test from "node:test";
import assert from "node:assert/strict";

import {
  getIeltsSourceGuidance,
  getIeltsSourceLibrary,
  selectIeltsSourceAssignment,
} from "../worker/ielts-source-library.js";

const listeningBaseline = {
  id: "baseline-listening",
  kind: "test",
  skill: "listening",
  title: "Full Listening baseline",
  materialUrl: "https://example.com/old-official-link",
};

const readingPractice = {
  id: "aug-w1-r1-reading",
  kind: "guided",
  skill: "reading",
  title: "Repair Reading",
};

const task1ProcessPractice = {
  id: "aug-w1-r2-apply",
  kind: "guided",
  skill: "writing",
  title: "Write a Task 1 Process response",
};

const task2DiscussionPractice = {
  id: "aug-w1-r3-writing",
  kind: "guided",
  skill: "writing",
  title: "Build one complete Task 2 discussion body paragraph",
};

const fullWritingPractice = {
  id: "aug-w4-r3-writing",
  kind: "test",
  skill: "writing",
  title: "Final full Writing check",
  steps: ["Write Task 1 in 20 minutes and Task 2 in 40 minutes."],
};

function state(taskStates = {}) {
  return { taskStates };
}

test("source catalogs contain Listening, Reading and Writing coverage from both providers", () => {
  const library = getIeltsSourceLibrary();
  const coverage = new Set(library.tests.map((item) => `${item.providerId}:${item.skill}`));

  assert.ok(coverage.has("study4:listening"));
  assert.ok(coverage.has("study4:reading"));
  assert.ok(coverage.has("study4:writing"));
  assert.ok(coverage.has("youpass:listening"));
  assert.ok(coverage.has("youpass:reading"));
  assert.ok(coverage.has("youpass:writing"));
});

test("baseline assignment selects only a verified 40-question full test", () => {
  const assignment = selectIeltsSourceAssignment(listeningBaseline, state(), {
    random: () => 0,
    now: 123,
  });

  assert.equal(assignment.scope, "full");
  assert.equal(assignment.questionCount, 40);
  assert.equal(assignment.providerId, "study4");
  assert.equal(assignment.assignedAt, 123);
});

test("focused practice can be assigned a checked YouPass section", () => {
  const assignment = selectIeltsSourceAssignment(readingPractice, state(), {
    random: () => 0.999,
    now: 456,
  });

  assert.equal(assignment.providerId, "youpass");
  assert.equal(assignment.scope, "section");
  assert.match(assignment.testUrl, /^https:\/\/youpass\.vn\//);
});

test("Writing Task 1 receives a matched process prompt from the selected provider", () => {
  const study4 = selectIeltsSourceAssignment(task1ProcessPractice, state(), {
    random: () => 0,
    now: 501,
  });
  assert.equal(study4.providerId, "study4");
  assert.equal(study4.scope, "prompt");
  assert.equal(study4.taskPart, "task1");
  assert.equal(study4.writingType, "process");
  assert.equal(study4.promptCount, 1);
  assert.equal(study4.assignedAt, 501);

  const youpass = selectIeltsSourceAssignment(task1ProcessPractice, state(), {
    random: () => 0.999,
    now: 502,
  });
  assert.equal(youpass.providerId, "youpass");
  assert.equal(youpass.taskPart, "task1");
  assert.equal(youpass.writingType, "process");
  assert.match(youpass.testUrl, /^https:\/\/youpass\.vn\/practice\/writing-task-1\//);
});

test("Writing Task 2 receives only a matching discussion prompt", () => {
  const assignment = selectIeltsSourceAssignment(task2DiscussionPractice, state(), {
    random: () => 0.999,
    now: 503,
  });
  assert.equal(assignment.providerId, "youpass");
  assert.equal(assignment.taskPart, "task2");
  assert.equal(assignment.writingType, "discussion");
  assert.equal(assignment.promptCount, 1);
});

test("full Writing practice receives a paired STUDY4 source", () => {
  const assignment = selectIeltsSourceAssignment(fullWritingPractice, state(), {
    random: () => 0.5,
    now: 504,
  });
  assert.equal(assignment.providerId, "study4");
  assert.equal(assignment.scope, "full");
  assert.equal(assignment.taskPart, "both");
  assert.equal(assignment.promptCount, 2);
});

test("official Writing baseline remains fixed and is not randomly reassigned", () => {
  const task = {
    id: "baseline-writing",
    kind: "test",
    skill: "writing",
    title: "Full Writing baseline",
    materialUrl: "https://ielts.org/writing",
  };
  assert.equal(selectIeltsSourceAssignment(task, state(), { random: () => 0, now: 1 }), null);
  assert.equal(getIeltsSourceGuidance(task).mode, "fixed-task-material");
});

test("completed sources are not repeated while unused eligible sources remain", () => {
  const first = selectIeltsSourceAssignment(task1ProcessPractice, state(), {
    random: () => 0,
    now: 1,
  });
  const next = selectIeltsSourceAssignment(task1ProcessPractice, state({
    finished: {
      status: "completed",
      sourceAssignment: first,
    },
  }), {
    random: () => 0,
    now: 2,
  });

  assert.notEqual(next.testId, first.testId);
});

test("an existing task assignment stays stable", () => {
  const existing = {
    providerId: "youpass",
    providerName: "YouPass",
    testId: "youpass-writing-task1-coal-process",
    testTitle: "Producing Electricity from Coal",
    testUrl: "https://youpass.vn/practice/writing-task-1/9996",
    scope: "prompt",
    questionCount: 0,
    promptCount: 1,
    taskPart: "task1",
    writingType: "process",
    sectionLabel: "Task 1 · Process",
    assignedAt: 9,
  };
  const assignment = selectIeltsSourceAssignment(task1ProcessPractice, state({
    [task1ProcessPractice.id]: { sourceAssignment: existing },
  }), {
    random: () => 0,
    now: 10,
  });

  assert.deepEqual(assignment, existing);
});

test("Listening and Reading guidance ignores old fixed material and uses random catalog policy", () => {
  const unassigned = getIeltsSourceGuidance(listeningBaseline);
  assert.equal(unassigned.mode, "random-checked-practice");
  assert.equal(unassigned.fixedMaterial, null);
  assert.ok(unassigned.approvedTests.every((item) => item.scope === "full"));

  const assigned = selectIeltsSourceAssignment(listeningBaseline, state(), {
    random: () => 0,
    now: 11,
  });
  const assignedGuidance = getIeltsSourceGuidance({
    ...listeningBaseline,
    state: { sourceAssignment: assigned },
  });
  assert.equal(assignedGuidance.mode, "assigned-checked-practice");
  assert.equal(assignedGuidance.fixedMaterial.url, assigned.testUrl);
});

test("assigned Writing guidance preserves the prompt and evidence requirements", () => {
  const assigned = selectIeltsSourceAssignment(task1ProcessPractice, state(), {
    random: () => 0.999,
    now: 12,
  });
  const guidance = getIeltsSourceGuidance({
    ...task1ProcessPractice,
    state: { sourceAssignment: assigned },
  });
  assert.equal(guidance.mode, "assigned-writing-prompt");
  assert.equal(guidance.fixedMaterial.url, assigned.testUrl);
  assert.match(guidance.rules.join("\n"), /original response/i);
  assert.match(guidance.rules.join("\n"), /model answer/i);
  assert.match(guidance.evidenceTemplate.join("\n"), /TA\/TR, CC, LR, GRA/);
});
