import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateJoyActions,
  handleJoyActionsRequest,
} from "../worker/joy-actions.js";
import {
  JOY_IELTS_ACTIONS_OPENAPI,
  JOY_TURTLEBOT4_ACTIONS_OPENAPI,
} from "../worker/joy-actions-openapi-extended.js";
import { handleJoyDevRequest } from "../worker/joy-dev-http.js";

const ENV = {
  JOY_OWNER_EMAIL: "owner@example.com",
  JOY_GPT_ACTION_KEY: "legacy-secret",
  JOY_IELTS_GPT_ACTION_KEY: "ielts-secret",
  JOY_TURTLEBOT4_GPT_ACTION_KEY: "turtlebot-secret",
};

function request(path, key, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${key}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return new Request(`https://app.hey-joy.workers.dev${path}`, { ...init, headers });
}

const IELTS_CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: ["repository:read", "repository:write"],
  actorType: "assistant",
  actorId: "gpt-ielts",
  profileId: "ielts",
  allowedProjectIds: ["ielts"],
  repositoryWriteProfile: "ielts",
};

test("specialized bearer keys map to distinct actors, projects, and default scopes", async () => {
  const ielts = await authenticateJoyActions(request("/api/joy/v1/projects/ielts", "ielts-secret"), ENV);
  assert.equal(ielts.actorId, "gpt-ielts");
  assert.equal(ielts.profileId, "ielts");
  assert.deepEqual(ielts.allowedProjectIds, ["ielts"]);
  assert.equal(ielts.scopes.includes("ielts:*"), true);
  assert.equal(ielts.scopes.includes("repository:write"), true);

  const turtlebot = await authenticateJoyActions(
    request("/api/joy/v1/projects/turtlebot4", "turtlebot-secret"),
    ENV,
  );
  assert.equal(turtlebot.actorId, "gpt-turtlebot4");
  assert.equal(turtlebot.profileId, "turtlebot4");
  assert.deepEqual(turtlebot.allowedProjectIds, ["turtlebot4"]);
  assert.equal(turtlebot.scopes.includes("ielts:*"), false);
});

test("the legacy key remains backward compatible and unrestricted by project", async () => {
  const context = await authenticateJoyActions(
    request("/api/joy/v1/overview", "legacy-secret"),
    { ...ENV, JOY_GPT_ACTION_SCOPES: "project:read,task:read" },
  );
  assert.equal(context.profileId, "legacy");
  assert.equal(context.actorId, "chatgpt-custom-gpt");
  assert.equal(context.allowedProjectIds, null);
  assert.deepEqual(context.scopes, ["project:read", "task:read"]);
});

test("reusing one bearer key for two GPT profiles fails closed", async () => {
  await assert.rejects(
    authenticateJoyActions(
      request("/api/joy/v1/projects/ielts", "same-secret"),
      {
        JOY_OWNER_EMAIL: "owner@example.com",
        JOY_IELTS_GPT_ACTION_KEY: "same-secret",
        JOY_TURTLEBOT4_GPT_ACTION_KEY: "same-secret",
      },
    ),
    (error) => error.code === "JOY_ACTIONS_AUTH_AMBIGUOUS" && error.status === 503,
  );
});

test("each GPT receives a focused OpenAPI schema", async () => {
  assert.equal(JOY_IELTS_ACTIONS_OPENAPI.info.version, "1.5.0");
  assert.equal(JOY_TURTLEBOT4_ACTIONS_OPENAPI.info.version, "1.5.0");
  assert.ok(JOY_IELTS_ACTIONS_OPENAPI.paths["/api/joy/v1/ielts/today"]);
  assert.equal(JOY_TURTLEBOT4_ACTIONS_OPENAPI.paths["/api/joy/v1/ielts/today"], undefined);
  assert.ok(JOY_IELTS_ACTIONS_OPENAPI.paths["/api/joy/v1/dev/changes"]);
  assert.ok(JOY_TURTLEBOT4_ACTIONS_OPENAPI.paths["/api/joy/v1/dev/changes"]);
  assert.ok(JOY_IELTS_ACTIONS_OPENAPI.paths["/api/joy/v1/workspaces/{projectId}"]);
  assert.ok(JOY_TURTLEBOT4_ACTIONS_OPENAPI.paths["/api/joy/v1/workspaces/{projectId}"]);
  assert.equal(JOY_IELTS_ACTIONS_OPENAPI.paths["/api/joy/v1/overview"], undefined);
  assert.equal(JOY_TURTLEBOT4_ACTIONS_OPENAPI.paths["/api/joy/v1/projects"], undefined);

  const ieltsResponse = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/openapi/ielts.json"),
    {},
  );
  const turtleResponse = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/openapi/turtlebot4.json"),
    {},
  );
  assert.equal((await ieltsResponse.json()).info.title, "Joy IELTS Coach and Developer Actions");
  assert.equal((await turtleResponse.json()).info.title, "Joy TurtleBot4 Engineer and Developer Actions");
});

test("specialized credentials cannot read or update the other Joy project", async () => {
  let serviceCalled = false;
  const service = {
    async getProject() {
      serviceCalled = true;
      return { project: { id: "turtlebot4" }, tasks: [], milestones: [] };
    },
  };
  const response = await handleJoyActionsRequest(
    request("/api/joy/v1/projects/turtlebot4", "ielts-secret"),
    ENV,
    { service },
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "JOY_PROJECT_SCOPE_FORBIDDEN");
  assert.equal(serviceCalled, false);
});

test("TurtleBot4 credentials cannot invoke IELTS teaching routes", async () => {
  let called = false;
  const response = await handleJoyActionsRequest(
    request("/api/joy/v1/ielts/today", "turtlebot-secret"),
    ENV,
    {
      ieltsService: {
        async getTeachingContext() {
          called = true;
          return {};
        },
      },
    },
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "JOY_PROJECT_SCOPE_FORBIDDEN");
  assert.equal(called, false);
});

test("specialized overview responses contain only the assigned project", async () => {
  const response = await handleJoyActionsRequest(
    request("/api/joy/v1/overview", "ielts-secret"),
    ENV,
    {
      service: {
        async getOverview() {
          return {
            projects: [{ id: "ielts" }, { id: "turtlebot4" }],
            openTasks: [
              { id: "i", projectId: "ielts" },
              { id: "t", projectId: "turtlebot4" },
            ],
            inboxTasks: [{ id: "private-inbox" }],
            recentLogs: [
              { id: "i-log", projectId: "ielts" },
              { id: "t-log", projectId: "turtlebot4" },
            ],
            generatedAt: 1,
          };
        },
      },
    },
  );
  const body = await response.json();
  assert.deepEqual(body.projects.map((item) => item.id), ["ielts"]);
  assert.deepEqual(body.openTasks.map((item) => item.id), ["i"]);
  assert.deepEqual(body.recentLogs.map((item) => item.id), ["i-log"]);
  assert.deepEqual(body.inboxTasks, []);
});

test("an IELTS GPT cannot update a task outside its assigned project", async () => {
  let updated = false;
  const response = await handleJoyActionsRequest(
    request("/api/joy/v1/tasks/turtle-task", "ielts-secret", {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    }),
    ENV,
    {
      service: {
        async getProject() {
          return {
            project: { id: "ielts" },
            tasks: [{ id: "ielts-task", projectId: "ielts" }],
            milestones: [],
          };
        },
        async updateTask() {
          updated = true;
          return {};
        },
      },
    },
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "JOY_PROJECT_SCOPE_FORBIDDEN");
  assert.equal(updated, false);
});

test("Dev Bridge permits shared files but blocks project-specific cross-writes", async () => {
  let received = null;
  const service = {
    async applyRepositoryChanges(_env, _context, input) {
      received = input;
      return { projectId: input.projectId, branch: input.branch, changes: input.changes };
    },
  };

  await assert.rejects(
    handleJoyDevRequest(
      new Request("https://app.hey-joy.workers.dev/api/joy/v1/dev/changes", {
        method: "POST",
        body: JSON.stringify({
          projectId: "ielts",
          branch: "joy/ielts/layout-session",
          changes: [{ path: "project-data/turtlebot4/current-state.json", content: "{}" }],
        }),
      }),
      {},
      IELTS_CONTEXT,
      { service },
    ),
    (error) => error.code === "JOY_DEV_PROJECT_PATH_FORBIDDEN",
  );
  assert.equal(received, null);

  const result = await handleJoyDevRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/dev/changes", {
      method: "POST",
      body: JSON.stringify({
        projectId: "ielts",
        branch: "joy/ielts/layout-session",
        changes: [{ path: "src/shared/project-card.js", content: "export {};" }],
      }),
    }),
    {},
    IELTS_CONTEXT,
    { service },
  );
  assert.equal(result.status, 201);
  assert.equal(received.changes[0].path, "src/shared/project-card.js");
});

test("repository context exposes only pull requests for the GPT project", async () => {
  const result = await handleJoyDevRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/dev/repository"),
    {},
    IELTS_CONTEXT,
    {
      service: {
        async getRepositoryContext() {
          return {
            mainHeadSha: "main",
            openPullRequests: [
              { number: 1, headBranch: "joy/ielts/writing-ui-a" },
              { number: 2, headBranch: "joy/turtlebot4/nav-b" },
              { number: 3, headBranch: "agent/manual" },
            ],
            policy: {},
          };
        },
      },
    },
  );
  assert.deepEqual(result.value.openPullRequests.map((item) => item.number), [1]);
  assert.deepEqual(result.value.policy.allowedProjectIds, ["ielts"]);
});
