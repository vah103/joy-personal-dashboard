import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  JOY_IELTS_ACTIONS_OPENAPI,
  JOY_TURTLEBOT4_ACTIONS_OPENAPI,
} from "../worker/joy-actions-openapi-extended.js";
import { handleProjectMemoryRequest } from "../worker/project-memory-http.js";
import {
  getSpecializedGptContract,
  SPECIALIZED_GPT_CONTRACTS,
} from "../worker/specialized-gpt-contracts.js";

const IELTS_CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: ["workspace:read"],
  actorType: "assistant",
  actorId: "gpt-ielts",
  profileId: "ielts",
  allowedProjectIds: ["ielts"],
};

const LEGACY_CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: ["workspace:read"],
  actorType: "assistant",
  actorId: "chatgpt-custom-gpt",
  profileId: "legacy",
  allowedProjectIds: null,
};

const WORKSPACE = {
  project: { project: { id: "ielts", currentFocus: "Baseline" } },
  memory: {
    snapshot: null,
    activeSession: null,
    activeEvents: [],
    recentSessions: [],
    recentEvents: [],
    decisions: [],
    openBlockers: [],
    evidence: [],
    repoRefs: [],
  },
  continuation: {
    status: "ready_for_new_session",
    currentGoal: "Baseline",
    nextActions: [],
    blockers: [],
    latestSummary: "",
  },
  generatedAt: 1,
};

function operationCount(schema) {
  return Object.values(schema.paths).reduce(
    (count, path) => count + Object.keys(path).filter((key) => ["get", "post", "put", "patch", "delete"].includes(key)).length,
    0,
  );
}

test("Joy IELTS runtime contract fixes the identity, project, four skills, and developer branch", () => {
  const profile = getSpecializedGptContract(IELTS_CONTEXT, "ielts");
  assert.equal(profile, SPECIALIZED_GPT_CONTRACTS.ielts);
  assert.equal(profile.identity, "Joy IELTS");
  assert.equal(profile.fixedProjectId, "ielts");
  assert.deepEqual(profile.teachingContract.skills, ["listening", "reading", "writing", "speaking"]);
  assert.equal(profile.developmentContract.branchPrefix, "joy/ielts/");
  assert.equal(profile.developmentContract.preferredCheckSuite, "ielts");
  assert.match(profile.teachingContract.rules.join("\n"), /official answer key/i);
  assert.match(profile.sessionContract.finishRules.join("\n"), /verified outcomes/i);
  assert.equal(getSpecializedGptContract(IELTS_CONTEXT, "turtlebot4"), null);
  assert.equal(getSpecializedGptContract(LEGACY_CONTEXT, "ielts"), null);
});

test("IELTS workspace bootstrap returns the operating contract without changing the shared service", async () => {
  let receivedProjectId = null;
  const service = {
    async bootstrapWorkspace(_env, _context, projectId) {
      receivedProjectId = projectId;
      return structuredClone(WORKSPACE);
    },
  };
  const result = await handleProjectMemoryRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/workspaces/ielts"),
    {},
    IELTS_CONTEXT,
    { service },
  );
  assert.equal(result.status, 200);
  assert.equal(receivedProjectId, "ielts");
  assert.equal(result.value.assistantProfile.profileId, "ielts");
  assert.equal(result.value.assistantProfile.fixedProjectId, "ielts");
  assert.equal(result.value.continuation.status, "ready_for_new_session");
});

test("legacy workspace bootstrap is backward compatible and receives no specialized contract", async () => {
  const result = await handleProjectMemoryRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/workspaces/ielts"),
    {},
    LEGACY_CONTEXT,
    { service: { async bootstrapWorkspace() { return structuredClone(WORKSPACE); } } },
  );
  assert.equal(result.status, 200);
  assert.equal(Object.hasOwn(result.value, "assistantProfile"), false);
});

test("Joy IELTS OpenAPI describes the runtime profile and remains within Builder limits", () => {
  const schemas = JOY_IELTS_ACTIONS_OPENAPI.components.schemas;
  const workspace = schemas.WorkspaceBootstrapResult;
  assert.ok(schemas.JoySpecializedAssistantProfile);
  assert.deepEqual(
    workspace.properties.assistantProfile,
    { $ref: "#/components/schemas/JoySpecializedAssistantProfile" },
  );
  assert.ok(workspace.required.includes("assistantProfile"));
  assert.ok(operationCount(JOY_IELTS_ACTIONS_OPENAPI) <= 30);

  const turtleSchemas = JOY_TURTLEBOT4_ACTIONS_OPENAPI.components.schemas;
  assert.equal(turtleSchemas.JoySpecializedAssistantProfile, undefined);
  assert.equal(turtleSchemas.WorkspaceBootstrapResult.required.includes("assistantProfile"), false);
});

test("the Builder profile documents the required teaching, memory, Listening, and development workflows", async () => {
  const document = await readFile(
    new URL("../docs/gpt-profiles/JOY_IELTS_BUILDER.md", import.meta.url),
    "utf8",
  );
  for (const requiredText of [
    "bootstrapJoyWorkspace",
    "getIeltsToday",
    "getIeltsTeachingTask",
    "prepareIeltsListeningSubmission",
    "saveIeltsListeningReview",
    "getJoyRepositoryContext",
    "applyJoyRepositoryChanges",
    "runJoyRepositoryChecks",
    "openJoyPullRequest",
    "finishJoyWorkSession",
    "joy/ielts/",
  ]) {
    assert.match(document, new RegExp(requiredText));
  }
  assert.match(document, /Listening, Reading, Writing, and Speaking/);
  assert.match(document, /Never write directly to main/);
  assert.match(document, /do not produce a band score/i);
});
