import assert from "node:assert/strict";
import test from "node:test";

import IELTS_SOURCE_LIBRARY from "../project-data/ielts/sources.json" with { type: "json" };
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

test("the IELTS source catalog keeps STUDY4 and YouPass teacher-recommended but non-official", () => {
  assert.equal(IELTS_SOURCE_LIBRARY.schemaVersion, 1);
  const providers = Object.fromEntries(
    IELTS_SOURCE_LIBRARY.providers.map((provider) => [provider.id, provider]),
  );

  for (const id of ["study4", "youpass"]) {
    assert.ok(providers[id]);
    assert.equal(providers[id].teacherRecommended, true);
    assert.equal(providers[id].official, false);
    assert.ok(providers[id].checkedSkills.includes("listening"));
    assert.ok(providers[id].checkedSkills.includes("reading"));
    assert.match(providers[id].homepageUrl, /^https:\/\//);
  }

  assert.ok(IELTS_SOURCE_LIBRARY.selectionPolicy.storeOnly.includes("rawResult"));
  assert.ok(IELTS_SOURCE_LIBRARY.selectionPolicy.storeOnly.includes("wrongItems"));
  assert.ok(IELTS_SOURCE_LIBRARY.selectionPolicy.neverStore.includes("fullThirdPartyAnswerKey"));
});

test("a task with fixed material never gets replaced by a general practice provider", () => {
  const guidance = getIeltsSourceGuidance({
    id: "baseline-reading",
    rhythmId: "baseline",
    skill: "reading",
    material: "Official IELTS Academic Reading sample",
    materialUrl: "https://ielts.org/example",
  });

  assert.equal(guidance.mode, "fixed-task-material");
  assert.equal(guidance.fixedMaterial.url, "https://ielts.org/example");
  assert.deepEqual(guidance.approvedProviders, []);
});

test("ordinary Listening and Reading practice offers both checked providers", () => {
  for (const skill of ["listening", "reading"]) {
    const guidance = getIeltsSourceGuidance({
      id: `daily-${skill}`,
      rhythmId: "august-foundation",
      kind: "guided",
      skill,
    });
    assert.equal(guidance.mode, "approved-checked-practice");
    assert.deepEqual(
      guidance.approvedProviders.map((provider) => provider.id),
      ["study4", "youpass"],
    );
    assert.match(guidance.evidenceTemplate.join("\n"), /Wrong items/);
    assert.match(guidance.evidenceTemplate.join("\n"), /Platform checked/);
  }
});

test("Writing and Speaking are not presented as answer-key checked practice", () => {
  for (const skill of ["writing", "speaking"]) {
    const guidance = getIeltsSourceGuidance({ id: `daily-${skill}`, skill });
    assert.equal(guidance.mode, "task-or-owner-material");
    assert.deepEqual(guidance.approvedProviders, []);
    assert.match(guidance.rules.join("\n"), /estimate/i);
  }
});

test("IELTS Actions teaching context exposes the source library and task guidance", async () => {
  const result = await STABLE_IELTS_ASSISTANT_SERVICE.getTeachingContext(
    {},
    CONTEXT,
    { date: "2026-08-01" },
    stateHarness(),
  );

  assert.equal(result.sourceLibrary.schemaVersion, 1);
  assert.deepEqual(
    result.sourceLibrary.providers.map((provider) => provider.id),
    ["study4", "youpass"],
  );
  assert.equal(result.current.tasks.length, 4);
  assert.equal(result.current.tasks[0].sourceGuidance.mode, "fixed-task-material");
  assert.equal(result.nextTask.sourceGuidance.mode, "fixed-task-material");
});

test("the runtime Joy IELTS contract requires approved-source evidence discipline", () => {
  const rules = SPECIALIZED_GPT_CONTRACTS.ielts.teachingContract.rules.join("\n");
  assert.match(rules, /STUDY4 or YouPass/);
  assert.match(rules, /practice evidence/i);
  assert.match(rules, /never copy or store a full third-party test or answer key/i);
  assert.deepEqual(getIeltsSourceLibrary(), IELTS_SOURCE_LIBRARY);
});
