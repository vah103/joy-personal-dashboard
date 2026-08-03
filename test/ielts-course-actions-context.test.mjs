import assert from "node:assert/strict";
import test from "node:test";

import { STABLE_IELTS_ASSISTANT_SERVICE } from "../worker/ielts-assistant-service.js";
import { blankIeltsState } from "../worker/ielts-core.js";

const CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: null,
  actorType: "assistant",
  actorId: "gpt-ielts",
  profileId: "ielts",
  allowedProjectIds: ["ielts"],
};

const KNOWLEDGE = {
  schemaVersion: 1,
  source: {
    provider: "Google Docs",
    documentId: "18KxStmQagYYJUbySCnUzgvyWPI5IaQXVN7y7B3HPK_s",
    syncedAt: 1_786_000_000_000,
  },
  stats: { tabCount: 3, topicCount: 2 },
  topics: [
    {
      id: "course-topic-maps",
      skill: "writing",
      taskType: "Task 1 · Maps",
      title: "Maps",
      summary: "Use passive voice and location inversion where natural.",
      grammar: ["passive voice", "location inversion"],
      source: { tabId: "task-1", heading: "Maps" },
    },
  ],
};

function dependencies() {
  const state = blankIeltsState();
  return {
    readState: async () => ({
      planId: "ielts-band-7-december-2026",
      data: structuredClone(state),
      version: 0,
      updatedAt: 0,
    }),
    readCourseKnowledge: async () => structuredClone(KNOWLEDGE),
  };
}

test("IELTS Actions teaching context exposes the synchronized Google Docs course knowledge", async () => {
  const result = await STABLE_IELTS_ASSISTANT_SERVICE.getTeachingContext(
    {},
    CONTEXT,
    { date: "2026-08-01" },
    dependencies(),
  );

  assert.deepEqual(result.courseKnowledge, KNOWLEDGE);
  assert.equal(result.courseKnowledge.topics[0].taskType, "Task 1 · Maps");
  assert.ok(result.courseKnowledge.topics[0].grammar.includes("passive voice"));
});
