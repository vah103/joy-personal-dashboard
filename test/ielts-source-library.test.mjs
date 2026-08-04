import assert from "node:assert/strict";
import test from "node:test";

import IELTS_SOURCE_LIBRARY from "../project-data/ielts/sources.json" with { type: "json" };
import IELTS_WRITING_SOURCE_LIBRARY from "../project-data/ielts/writing-sources.json" with { type: "json" };
import { STABLE_IELTS_ASSISTANT_SERVICE } from "../worker/ielts-assistant-service.js";
import { blankIeltsState } from "../worker/ielts-core.js";
import {
  getIeltsSourceGuidance,
  getIeltsSourceLibrary,
} from "../worker/ielts-source-library.js";
import { SPECIALIZED_GPT_CONTRACTS } from "../worker/specialized-gpt-contracts.js";

const CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: null,
  actorType: "assistant",
  actorId: "gpt-ielts",
  profileId: "ielts",
  allowedProjectIds: ["ielts"],
};

function stateHarness(initial = blankIeltsState()) {
  const data = JSON.parse(JSON.stringify(initial));
  return {
    readState: async () => ({
      planId: "ielts-band-7-december-2026",
      data: JSON.parse(JSON.stringify(data)),
      version: 0,
      updatedAt: 0,
    }),
  };
}

test("the IELTS source catalogs keep STUDY4 and YouPass teacher-recommended but non-official", () => {
  assert.equal(IELTS_SOURCE_LIBRARY.schemaVersion, 2);
  assert.equal(IELTS_WRITING_SOURCE_LIBRARY.schemaVersion, 1);

  for (const catalog of [IELTS_SOURCE_LIBRARY, IELTS_WRITING_SOURCE_LIBRARY]) {
    const providers = Object.fromEntries(
      catalog.providers.map((provider) => [provider.id, provider]),
    );
    for (const id of ["study4", "youpass"]) {
      assert.ok(providers[id]);
      assert.equal(providers[id].teacherRecommended, true);
      assert.equal(providers[id].official, false);
      assert.match(providers[id].homepageUrl, /^https:\/\//);
    }
  }

  const receptiveProviders = Object.fromEntries(
    IELTS_SOURCE_LIBRARY.providers.map((provider) => [provider.id, provider]),
  );
  assert.ok(receptiveProviders.study4.checkedSkills.includes("listening"));
  assert.ok(receptiveProviders.youpass.checkedSkills.includes("reading"));

  assert.ok(IELTS_WRITING_SOURCE_LIBRARY.tests.length >= 20);
  assert.ok(IELTS_WRITING_SOURCE_LIBRARY.tests.some((item) => item.taskPart === "task1"));
  assert.ok(IELTS_WRITING_SOURCE_LIBRARY.tests.some((item) => item.taskPart === "task2"));
  assert.ok(IELTS_WRITING_SOURCE_LIBRARY.tests.some((item) => item.taskPart === "both"));
  assert.ok(IELTS_WRITING_SOURCE_LIBRARY.selectionPolicy.storeOnly.includes("originalResponse"));
  assert.ok(IELTS_WRITING_SOURCE_LIBRARY.selectionPolicy.storeOnly.includes("criterionFeedback"));
  assert.ok(IELTS_WRITING_SOURCE_LIBRARY.selectionPolicy.neverStore.includes("copiedModelAnswer"));
});

test("Listening and Reading replace old fixed links with the random checked-source policy", () => {
  const guidance = getIeltsSourceGuidance({
    id: "baseline-reading",
    rhythmId: "baseline",
    kind: "test",
    skill: "reading",
    title: "Full Academic Reading baseline",
    material: "Old fixed Reading sample",
    materialUrl: "https://ielts.org/example",
  });

  assert.equal(guidance.mode, "random-checked-practice");
  assert.equal(guidance.fixedMaterial, null);
  assert.deepEqual(
    guidance.approvedProviders.map((provider) => provider.id),
    ["study4", "youpass"],
  );
  assert.ok(guidance.approvedTests.length > 0);
  assert.ok(guidance.approvedTests.every((item) => item.scope === "full"));
  assert.ok(guidance.approvedTests.every((item) => item.questionCount === 40));
});

test("official Writing baseline and Speaking fixed material remain fixed", () => {
  for (const skill of ["writing", "speaking"]) {
    const guidance = getIeltsSourceGuidance({
      id: `baseline-${skill}`,
      rhythmId: "baseline",
      kind: "test",
      skill,
      title: skill === "writing" ? "Full Writing baseline" : "Full Speaking baseline",
      material: `${skill} sample`,
      materialUrl: `https://ielts.org/${skill}`,
    });

    assert.equal(guidance.mode, "fixed-task-material");
    assert.equal(guidance.fixedMaterial.url, `https://ielts.org/${skill}`);
    assert.deepEqual(guidance.approvedProviders, []);
  }
});

test("ordinary Listening and Reading practice offers both providers and concrete tests", () => {
  for (const skill of ["listening", "reading"]) {
    const guidance = getIeltsSourceGuidance({
      id: `daily-${skill}`,
      rhythmId: "august-foundation",
      kind: "guided",
      skill,
    });
    assert.equal(guidance.mode, "random-checked-practice");
    assert.deepEqual(
      guidance.approvedProviders.map((provider) => provider.id),
      ["study4", "youpass"],
    );
    assert.ok(guidance.approvedTests.some((item) => item.providerId === "study4"));
    assert.ok(guidance.approvedTests.some((item) => item.providerId === "youpass"));
    assert.match(guidance.evidenceTemplate.join("\n"), /Wrong items/);
    assert.match(guidance.evidenceTemplate.join("\n"), /Platform checked/);
  }
});

test("Writing practice receives a matched random prompt while course-processing tasks do not", () => {
  const task1 = getIeltsSourceGuidance({
    id: "aug-w1-r2-apply",
    rhythmId: "aug-w1-r2",
    kind: "guided",
    skill: "writing",
    title: "Apply the Task 1 lesson",
    objective: "Write a Task 1 overview and body paragraph.",
  });
  assert.equal(task1.mode, "random-writing-prompt");
  assert.deepEqual(task1.approvedProviders.map((provider) => provider.id), ["study4", "youpass"]);
  assert.ok(task1.approvedTests.length > 0);
  assert.ok(task1.approvedTests.every((item) => item.taskPart === "task1"));
  assert.match(task1.evidenceTemplate.join("\n"), /Original response/);
  assert.match(task1.evidenceTemplate.join("\n"), /Criterion feedback/);

  const review = getIeltsSourceGuidance({
    id: "aug-w1-r2-process",
    rhythmId: "aug-w1-r2",
    kind: "review",
    skill: "writing",
    title: "Process both Task 1 lesson recordings",
  });
  assert.equal(review.mode, "task-or-owner-material");
  assert.deepEqual(review.approvedProviders, []);
});

test("Writing prompt filtering follows task part and named family", () => {
  const process = getIeltsSourceGuidance({
    id: "task1-process-practice",
    kind: "guided",
    skill: "writing",
    title: "Write a Task 1 Process response",
  });
  assert.equal(process.mode, "random-writing-prompt");
  assert.ok(process.approvedTests.length > 0);
  assert.ok(process.approvedTests.every((item) => item.taskPart === "task1"));
  assert.ok(process.approvedTests.every((item) => item.writingType === "process"));

  const discussion = getIeltsSourceGuidance({
    id: "task2-discussion-practice",
    kind: "guided",
    skill: "writing",
    title: "Write a Task 2 discussion essay",
  });
  assert.ok(discussion.approvedTests.length > 0);
  assert.ok(discussion.approvedTests.every((item) => item.taskPart === "task2"));
  assert.ok(discussion.approvedTests.every((item) => item.writingType === "discussion"));

  const full = getIeltsSourceGuidance({
    id: "final-full-writing",
    kind: "test",
    skill: "writing",
    title: "Final full Writing check",
    steps: ["Write Task 1 in 20 minutes and Task 2 in 40 minutes."],
  });
  assert.ok(full.approvedTests.length > 0);
  assert.ok(full.approvedTests.every((item) => item.scope === "full"));
  assert.ok(full.approvedTests.every((item) => item.taskPart === "both"));
});

test("Speaking without fixed material is not presented as answer-key checked practice", () => {
  const guidance = getIeltsSourceGuidance({ id: "daily-speaking", skill: "speaking" });
  assert.equal(guidance.mode, "task-or-owner-material");
  assert.deepEqual(guidance.approvedProviders, []);
  assert.match(guidance.rules.join("\n"), /estimate/i);
});

test("IELTS Actions teaching context exposes the merged source library and baseline guidance", async () => {
  const result = await STABLE_IELTS_ASSISTANT_SERVICE.getTeachingContext(
    {},
    CONTEXT,
    { date: "2026-08-01" },
    stateHarness(),
  );

  assert.equal(result.sourceLibrary.schemaVersion, 2);
  assert.equal(result.sourceLibrary.writingCatalogVersion, 1);
  assert.deepEqual(
    result.sourceLibrary.providers.map((provider) => provider.id),
    ["study4", "youpass"],
  );
  assert.ok(result.sourceLibrary.tests.some((item) => item.skill === "writing"));
  assert.equal(result.current.tasks.length, 4);

  const listening = result.current.tasks.find((task) => task.skill === "listening");
  const reading = result.current.tasks.find((task) => task.skill === "reading");
  const writing = result.current.tasks.find((task) => task.skill === "writing");
  const speaking = result.current.tasks.find((task) => task.skill === "speaking");

  assert.equal(listening.sourceGuidance.mode, "random-checked-practice");
  assert.equal(reading.sourceGuidance.mode, "random-checked-practice");
  assert.equal(writing.sourceGuidance.mode, "fixed-task-material");
  assert.equal(speaking.sourceGuidance.mode, "fixed-task-material");
  assert.equal(result.nextTask.sourceGuidance.mode, "random-checked-practice");
});

test("the runtime Joy IELTS contract requires approved-source evidence discipline", () => {
  const rules = SPECIALIZED_GPT_CONTRACTS.ielts.teachingContract.rules.join("\n");
  assert.match(rules, /STUDY4 or YouPass/);
  assert.match(rules, /practice evidence/i);
  assert.match(rules, /never copy or store a full third-party test or answer key/i);
  const merged = getIeltsSourceLibrary();
  assert.ok(merged.tests.length > IELTS_SOURCE_LIBRARY.tests.length);
  assert.ok(merged.tests.some((item) => item.skill === "writing"));
});
