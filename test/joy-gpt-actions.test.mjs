import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateJoyActions,
  handleJoyActionsRequest,
  isJoyActionsRoute,
} from "../worker/joy-actions.js";
import { JOY_ACTIONS_OPENAPI } from "../worker/joy-actions-openapi.js";

const ENV = {
  JOY_GPT_ACTION_KEY: "test-secret-key",
  JOY_OWNER_EMAIL: "owner@example.com",
};

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

function authorizedRequest(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${ENV.JOY_GPT_ACTION_KEY}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Request(`https://app.hey-joy.workers.dev${path}`, {
    ...init,
    headers,
  });
}

async function responseJson(response) {
  return response.json();
}

test("recognizes only Joy Actions API routes", () => {
  assert.equal(isJoyActionsRoute("/api/joy/v1/overview"), true);
  assert.equal(isJoyActionsRoute("/api/joy/v1/openapi.json"), true);
  assert.equal(isJoyActionsRoute("/api/projects"), false);
});

test("publishes a GPT Actions schema without destructive operations", async () => {
  const response = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/openapi.json"),
    {},
  );
  assert.equal(response.status, 200);
  const schema = await responseJson(response);
  assert.equal(schema.openapi, "3.1.0");
  assert.equal(schema.paths["/api/joy/v1/overview"].get.operationId, "getJoyOverview");
  assert.equal(typeof schema.components.schemas, "object");
  assert.equal(Array.isArray(schema.components.schemas), false);
  assert.ok(Object.keys(schema.components.schemas).length > 0);

  const methods = [];
  for (const [path, pathItem] of Object.entries(schema.paths)) {
    assert.equal(Object.hasOwn(pathItem, "parameters"), false, `${path} must not use path-level parameters`);
    for (const [method, operation] of Object.entries(pathItem)) {
      assert.equal(HTTP_METHODS.has(method), true, `${path} has unsupported path-item key ${method}`);
      methods.push(method);
      if (path.includes("{")) {
        assert.ok(Array.isArray(operation.parameters), `${path} ${method} needs operation parameters`);
        assert.ok(operation.parameters.some((parameter) => parameter.in === "path"));
      }
    }
  }

  assert.equal(methods.includes("delete"), false);
  assert.deepEqual(schema, JOY_ACTIONS_OPENAPI);
});

test("requires a valid bearer key for private actions", async () => {
  const missing = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/overview"),
    ENV,
  );
  assert.equal(missing.status, 401);
  assert.equal((await responseJson(missing)).error, "JOY_ACTIONS_AUTH_REQUIRED");

  const invalid = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/overview", {
      headers: { Authorization: "Bearer wrong-key" },
    }),
    ENV,
  );
  assert.equal(invalid.status, 403);
  assert.equal((await responseJson(invalid)).error, "JOY_ACTIONS_AUTH_INVALID");
});

test("maps the private key to a restricted assistant context", async () => {
  const context = await authenticateJoyActions(
    authorizedRequest("/api/joy/v1/overview"),
    {
      ...ENV,
      JOY_GPT_ACTION_SCOPES: "project:read,task:read",
    },
  );
  assert.equal(context.userEmail, "owner@example.com");
  assert.equal(context.role, "assistant");
  assert.deepEqual(context.scopes, ["project:read", "task:read"]);
  assert.equal(context.actorId, "chatgpt-custom-gpt");
});

test("routes overview reads to the shared Joy Core service", async () => {
  let receivedContext = null;
  const service = {
    async getOverview(_env, context) {
      receivedContext = context;
      return {
        projects: [{ id: "turtlebot4" }],
        openTasks: [],
        inboxTasks: [],
        recentLogs: [],
        generatedAt: 123,
      };
    },
  };
  const response = await handleJoyActionsRequest(
    authorizedRequest("/api/joy/v1/overview"),
    ENV,
    { service },
  );
  assert.equal(response.status, 200);
  assert.equal(receivedContext.role, "assistant");
  assert.equal((await responseJson(response)).projects[0].id, "turtlebot4");
});

test("routes task creation and returns 201 for a new idempotent write", async () => {
  let call = null;
  const service = {
    async createTask(_env, context, projectId, body) {
      call = { context, projectId, body };
      return {
        task: {
          id: "task-stage-4-sim",
          projectId,
          title: body.title,
          status: "todo",
          priority: "normal",
          version: 1,
        },
        deduplicated: false,
      };
    },
  };
  const response = await handleJoyActionsRequest(
    authorizedRequest("/api/joy/v1/projects/turtlebot4/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: "Launch one simulated world",
        clientRequestId: "stage-4-sim",
      }),
    }),
    ENV,
    { service },
  );
  assert.equal(response.status, 201);
  assert.equal(call.projectId, "turtlebot4");
  assert.equal(call.body.clientRequestId, "stage-4-sim");
  assert.equal((await responseJson(response)).task.id, "task-stage-4-sim");
});

test("reports whether Cloudflare secrets are configured without exposing them", async () => {
  const response = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/health"),
    ENV,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await responseJson(response), {
    ok: true,
    configured: true,
    version: 1,
  });
});
