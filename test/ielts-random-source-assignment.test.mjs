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

function state(taskStates = {}) {
  return { taskStates };
}

test("source catalog contains checked Listening and Reading material from both providers", () => {
  const library = getIeltsSourceLibrary();
  const coverage = new Set(library.tests.map((item) => `${item.providerId}:${item.skill}`));

  assert.ok(coverage.has("study4:listening"));
  assert.ok(coverage.has("study4:reading"));
  assert.ok(coverage.has("youpass:listening"));
  assert.ok(coverage.has("youpass:reading"));
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

test("completed tests are not repeated while unused eligible tests remain", () => {
  const first = selectIeltsSourceAssignment(readingPractice, state(), {
    random: () => 0,
    now: 1,
  });
  const next = selectIeltsSourceAssignment(readingPractice, state({
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
    providerId: "study4",
    providerName: "STUDY4",
    testId: "study4-bc-listening-4",
    testTitle: "BC IELTS Listening Test 4",
    testUrl: "https://study4.com/tests/1240/bc-ielts-listening-test-4/",
    scope: "full",
    questionCount: 40,
    assignedAt: 9,
  };
  const assignment = selectIeltsSourceAssignment(listeningBaseline, state({
    "baseline-listening": { sourceAssignment: existing },
  }), {
    random: () => 0.999,
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
