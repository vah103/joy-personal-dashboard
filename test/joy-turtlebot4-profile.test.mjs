import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { JOY_TURTLEBOT4_ACTIONS_OPENAPI } from "../worker/joy-actions-openapi-extended.js";
import { handleProjectMemoryRequest } from "../worker/project-memory-http.js";
import {
  getSpecializedGptContract,
  SPECIALIZED_GPT_CONTRACTS,
} from "../worker/specialized-gpt-contracts.js";

const TURTLEBOT4_CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: ["workspace:read"],
  actorType: "assistant",
  actorId: "gpt-turtlebot4",
  profileId: "turtlebot4",
  allowedProjectIds: ["turtlebot4"],
};

const WORKSPACE = {
  project: { project: { id: "turtlebot4", currentFocus: "Stage 4" } },
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
    currentGoal: "Stage 4",
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

test("Joy TurtleBot4 runtime contract fixes identity, engineering scope, and developer branch", () => {
  const profile = getSpecializedGptContract(TURTLEBOT4_CONTEXT, "turtlebot4");
  assert.equal(profile, SPECIALIZED_GPT_CONTRACTS.turtlebot4);
  assert.equal(profile.identity, "Joy TurtleBot4");
  assert.equal(profile.fixedProjectId, "turtlebot4");
  assert.equal(profile.developmentContract.branchPrefix, "joy/turtlebot4/");
  assert.equal(profile.developmentContract.preferredCheckSuite, "turtlebot4");
  assert.ok(profile.engineeringContract.domains.includes("ROS 2"));
  assert.ok(profile.engineeringContract.domains.includes("frontier exploration"));
  assert.match(profile.engineeringContract.rules.join("\n"), /home.*lab|lab.*home/i);
  assert.match(profile.engineeringContract.rules.join("\n"), /Never claim/i);
  assert.match(profile.sessionContract.finishRules.join("\n"), /home and lab/i);
  assert.equal(getSpecializedGptContract(TURTLEBOT4_CONTEXT, "ielts"), null);
});

test("TurtleBot4 workspace bootstrap returns its engineering operating contract", async () => {
  const result = await handleProjectMemoryRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/workspaces/turtlebot4"),
    {},
    TURTLEBOT4_CONTEXT,
    { service: { async bootstrapWorkspace() { return structuredClone(WORKSPACE); } } },
  );
  assert.equal(result.status, 200);
  assert.equal(result.value.assistantProfile.profileId, "turtlebot4");
  assert.equal(result.value.assistantProfile.actorId, "gpt-turtlebot4");
  assert.equal(result.value.assistantProfile.fixedProjectId, "turtlebot4");
  assert.equal(result.value.assistantProfile.developmentContract.preferredCheckSuite, "turtlebot4");
});

test("Joy TurtleBot4 OpenAPI describes its runtime profile within Builder limits", () => {
  const schemas = JOY_TURTLEBOT4_ACTIONS_OPENAPI.components.schemas;
  const profile = schemas.JoySpecializedAssistantProfile;
  assert.equal(profile.properties.profileId.enum[0], "turtlebot4");
  assert.equal(profile.properties.actorId.enum[0], "gpt-turtlebot4");
  assert.ok(profile.properties.engineeringContract);
  assert.ok(schemas.WorkspaceBootstrapResult.required.includes("assistantProfile"));
  assert.ok(operationCount(JOY_TURTLEBOT4_ACTIONS_OPENAPI) <= 30);
  assert.equal(JOY_TURTLEBOT4_ACTIONS_OPENAPI.paths["/api/joy/v1/ielts/today"], undefined);
});

test("the TurtleBot4 Builder profile documents engineering, evidence, memory, and development workflows", async () => {
  const document = await readFile(
    new URL("../docs/gpt-profiles/JOY_TURTLEBOT4_BUILDER.md", import.meta.url),
    "utf8",
  );
  for (const requiredText of [
    "bootstrapJoyWorkspace",
    "startJoyWorkSession",
    "appendJoyWorkSessionEvent",
    "getJoyRepositoryContext",
    "searchJoyRepository",
    "readJoyRepositoryFile",
    "createJoyWorkBranch",
    "applyJoyRepositoryChanges",
    "runJoyRepositoryChecks",
    "getJoyRepositoryCheck",
    "openJoyPullRequest",
    "finishJoyWorkSession",
    "joy/turtlebot4/",
  ]) {
    assert.match(document, new RegExp(requiredText));
  }
  assert.match(document, /ROS 2/);
  assert.match(document, /home work and lab work|home and lab work/i);
  assert.match(document, /real-robot/);
  assert.match(document, /Never write directly to main/);
  assert.match(document, /Never claim that SSH connected/);
});
