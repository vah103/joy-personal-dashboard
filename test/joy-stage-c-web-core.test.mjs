import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  handleJoyCoreWebRequest,
  isJoyCoreWebRoute,
} from "../worker/joy-core-web.js";

const SESSION = { user_email: "owner@example.com" };

function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return new Request(`https://app.hey-joy.workers.dev${path}`, {
    ...init,
    headers,
  });
}

const authenticated = {
  getSession: async () => SESSION,
};

test("recognizes only signed-in Joy Core web routes", () => {
  assert.equal(isJoyCoreWebRoute("/api/joy-core/v1/projects"), true);
  assert.equal(isJoyCoreWebRoute("/api/joy-core/v1/projects/turtlebot4"), true);
  assert.equal(isJoyCoreWebRoute("/api/joy/v1/projects"), false);
});

test("requires a Joy session for dashboard Joy Core reads", async () => {
  const response = await handleJoyCoreWebRequest(
    request("/api/joy-core/v1/projects/turtlebot4"),
    {},
    { getSession: async () => null },
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "AUTH_REQUIRED");
});

test("rejects cross-origin Joy Core writes", async () => {
  const response = await handleJoyCoreWebRequest(
    request("/api/joy-core/v1/projects/turtlebot4", {
      method: "PATCH",
      headers: { Origin: "https://example.com" },
      body: JSON.stringify({ progress: 40 }),
    }),
    {},
    authenticated,
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "INVALID_ORIGIN");
});

test("maps the signed-in dashboard account to the Joy Core owner role", async () => {
  let received = null;
  const service = {
    async getProject(_env, context, projectId) {
      received = { context, projectId };
      return {
        project: { id: projectId, title: "TurtleBot4", status: "active", progress: 32, version: 1 },
        tasks: [],
        milestones: [],
        progressLogs: [],
        evidence: [],
      };
    },
  };
  const response = await handleJoyCoreWebRequest(
    request("/api/joy-core/v1/projects/turtlebot4"),
    {},
    { ...authenticated, service },
  );
  assert.equal(response.status, 200);
  assert.equal(received.projectId, "turtlebot4");
  assert.equal(received.context.userEmail, "owner@example.com");
  assert.equal(received.context.role, "owner");
  assert.equal(received.context.actorType, "user");
});

test("creates a shared project task through the web API", async () => {
  let received = null;
  const service = {
    async createTask(_env, context, projectId, body) {
      received = { context, projectId, body };
      return {
        task: {
          id: "task-simulation",
          projectId,
          title: body.title,
          status: "todo",
          priority: "high",
          version: 1,
        },
        deduplicated: false,
      };
    },
  };
  const response = await handleJoyCoreWebRequest(
    request("/api/joy-core/v1/projects/turtlebot4/tasks", {
      method: "POST",
      headers: { Origin: "https://app.hey-joy.workers.dev" },
      body: JSON.stringify({
        title: "Verify simulated sensors",
        priority: "high",
        clientRequestId: "web-simulation",
      }),
    }),
    {},
    { ...authenticated, service },
  );
  assert.equal(response.status, 201);
  assert.equal(received.context.role, "owner");
  assert.equal(received.projectId, "turtlebot4");
  assert.equal(received.body.clientRequestId, "web-simulation");
  assert.equal((await response.json()).task.id, "task-simulation");
});

test("Joy Core web API exposes no destructive method", async () => {
  const response = await handleJoyCoreWebRequest(
    request("/api/joy-core/v1/projects/turtlebot4", {
      method: "DELETE",
      headers: { Origin: "https://app.hey-joy.workers.dev" },
    }),
    {},
    authenticated,
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, PATCH");
});

test("TurtleBot Project Hub reads and writes the same Joy Core records as the Custom GPT", async () => {
  const [router, extensionApi, syncSource] = await Promise.all([
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/project-hub/project-hub-extension-api.js", import.meta.url), "utf8"),
    readFile(new URL("../project-data/turtlebot4/joy-core-web-sync.js", import.meta.url), "utf8"),
  ]);

  assert.match(router, /isJoyCoreWebRoute/);
  assert.match(router, /handleJoyCoreWebRequest/);
  assert.match(extensionApi, /joy-core-web-sync\.js\?v=joy-stage-c-v1/);
  assert.match(extensionApi, /getContext: extensionContext/);
  assert.match(syncSource, /\/api\/joy-core\/v1/);
  assert.match(syncSource, /data-joy-core-task/);
  assert.match(syncSource, /shared with Custom GPT/);
  assert.doesNotMatch(syncSource, /fetch\("\/api\/tasks"/);
  assert.doesNotThrow(() => new Function(syncSource));
});
