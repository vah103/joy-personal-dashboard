import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  JOY_MCP_TOOLS,
  handleJoyMcpRequest,
  isJoyMcpRoute,
} from "../worker/joy-mcp.js";

const CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: null,
  actorType: "assistant",
  actorId: "chatgpt-mcp",
};

function request(message, init = {}) {
  const headers = new Headers({
    Authorization: "Bearer test-key",
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(init.headers || {}),
  });
  return new Request("https://app.hey-joy.workers.dev/mcp", {
    method: "POST",
    ...init,
    headers,
    body: message === undefined ? init.body : JSON.stringify(message),
  });
}

const authenticated = {
  authenticate: async () => CONTEXT,
};

test("recognizes only the Joy MCP endpoint and health endpoint", () => {
  assert.equal(isJoyMcpRoute("/mcp"), true);
  assert.equal(isJoyMcpRoute("/mcp/health"), true);
  assert.equal(isJoyMcpRoute("/api/joy/v1/overview"), false);
  assert.equal(isJoyMcpRoute("/mcp/other"), false);
});

test("publishes a stateless MCP health response without exposing secrets", async () => {
  const response = await handleJoyMcpRequest(
    new Request("https://app.hey-joy.workers.dev/mcp/health"),
    { JOY_GPT_ACTION_KEY: "secret", JOY_OWNER_EMAIL: "owner@example.com" },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.configured, true);
  assert.equal(body.transport, "streamable-http");
  assert.equal(body.stateless, true);
  assert.equal(body.protocolVersion, "2025-11-25");
  assert.equal(body.toolCount, 10);
  assert.equal(JSON.stringify(body).includes("secret"), false);
});

test("requires bearer authentication before MCP initialization", async () => {
  const response = await handleJoyMcpRequest(
    new Request("https://app.hey-joy.workers.dev/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
      }),
    }),
    { JOY_GPT_ACTION_KEY: "secret", JOY_OWNER_EMAIL: "owner@example.com" },
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("WWW-Authenticate"), 'Bearer realm="Joy MCP"');
  assert.equal((await response.json()).error, "JOY_ACTIONS_AUTH_REQUIRED");
});

test("negotiates MCP initialization and advertises only tools capability", async () => {
  const response = await handleJoyMcpRequest(request({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "MCP Inspector", version: "1.0.0" },
    },
  }), {}, authenticated);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.protocolVersion, "2025-11-25");
  assert.deepEqual(body.result.capabilities, { tools: { listChanged: false } });
  assert.equal(body.result.serverInfo.name, "joy-personal-dashboard");
  assert.match(body.result.instructions, /No destructive tools/);
});

test("accepts initialized notifications without creating a session", async () => {
  const response = await handleJoyMcpRequest(request({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, {
    headers: { "MCP-Protocol-Version": "2025-11-25" },
  }), {}, authenticated);
  assert.equal(response.status, 202);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("Mcp-Session-Id"), null);
});

test("lists ten safe Joy Core tools with read and write annotations", async () => {
  const response = await handleJoyMcpRequest(request({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }, {
    headers: { "MCP-Protocol-Version": "2025-11-25" },
  }), {}, authenticated);
  const body = await response.json();
  const tools = body.result.tools;
  assert.equal(tools.length, 10);
  assert.deepEqual(tools.map((tool) => tool.name), JOY_MCP_TOOLS.map((tool) => tool.name));
  assert.equal(tools.find((tool) => tool.name === "get_overview").annotations.readOnlyHint, true);
  assert.equal(tools.find((tool) => tool.name === "create_task").annotations.readOnlyHint, false);
  assert.equal(tools.every((tool) => tool.annotations.destructiveHint === false), true);
  assert.equal(tools.some((tool) => /delete|archive|remove/i.test(tool.name)), false);
});

test("calls a read tool through the shared Joy Core service", async () => {
  let received = null;
  const service = {
    async getProject(_env, context, projectId) {
      received = { context, projectId };
      return {
        project: { id: projectId, title: "TurtleBot4", progress: 32, version: 3 },
        tasks: [],
        milestones: [],
        progressLogs: [],
        evidence: [],
      };
    },
  };
  const response = await handleJoyMcpRequest(request({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "get_project", arguments: { projectId: "turtlebot4" } },
  }), {}, { ...authenticated, service });
  const body = await response.json();
  assert.equal(received.context.actorId, "chatgpt-mcp");
  assert.equal(received.projectId, "turtlebot4");
  assert.equal(body.result.isError, false);
  assert.equal(body.result.structuredContent.project.progress, 32);
  assert.match(body.result.content[0].text, /TurtleBot4/);
});

test("calls a non-destructive write tool with its idempotency key", async () => {
  let received = null;
  const service = {
    async createTask(_env, context, projectId, input) {
      received = { context, projectId, input };
      return {
        task: {
          id: "task-stage-d-test",
          projectId,
          title: input.title,
          status: "todo",
          priority: "normal",
          version: 1,
        },
        deduplicated: false,
      };
    },
  };
  const response = await handleJoyMcpRequest(request({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "create_task",
      arguments: {
        projectId: "turtlebot4",
        title: "Test MCP synchronization",
        clientRequestId: "stage-d-mcp-test-001",
      },
    },
  }), {}, { ...authenticated, service });
  const body = await response.json();
  assert.equal(received.projectId, "turtlebot4");
  assert.equal(received.input.clientRequestId, "stage-d-mcp-test-001");
  assert.equal(Object.hasOwn(received.input, "projectId"), false);
  assert.equal(body.result.structuredContent.task.id, "task-stage-d-test");
  assert.equal(body.result.isError, false);
});

test("returns Joy service failures as MCP tool errors without breaking the connection", async () => {
  const service = {
    async updateProject() {
      const error = new Error("JOY_PROJECT_VERSION_CONFLICT");
      error.code = "JOY_PROJECT_VERSION_CONFLICT";
      error.details = { current: { id: "turtlebot4", version: 5 } };
      throw error;
    },
  };
  const response = await handleJoyMcpRequest(request({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "update_project",
      arguments: { projectId: "turtlebot4", baseVersion: 4, progress: 35 },
    },
  }), {}, { ...authenticated, service });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.isError, true);
  assert.equal(body.result.structuredContent.error, "JOY_PROJECT_VERSION_CONFLICT");
  assert.equal(body.result.structuredContent.details.current.version, 5);
});

test("rejects JSON-RPC batches and unsupported transport versions", async () => {
  const batchResponse = await handleJoyMcpRequest(request([{
    jsonrpc: "2.0",
    id: 1,
    method: "ping",
  }]), {}, authenticated);
  assert.equal(batchResponse.status, 400);
  assert.equal((await batchResponse.json()).error.code, -32600);

  const versionResponse = await handleJoyMcpRequest(request({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/list",
    params: {},
  }, {
    headers: { "MCP-Protocol-Version": "2099-01-01" },
  }), {}, authenticated);
  assert.equal(versionResponse.status, 400);
  assert.equal((await versionResponse.json()).error.message, "JOY_MCP_PROTOCOL_VERSION_UNSUPPORTED");
});

test("the Worker router owns the remote MCP endpoint before the app fallback", async () => {
  const router = await readFile(new URL("../worker/router.js", import.meta.url), "utf8");
  assert.match(router, /handleJoyMcpRequest/);
  assert.match(router, /isJoyMcpRoute/);
  assert.ok(router.indexOf("isJoyMcpRoute") < router.indexOf("isJoyActionsRoute"));
});
