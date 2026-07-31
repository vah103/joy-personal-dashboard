import { authenticateJoyActions } from "./joy-actions.js";
import {
  JoyCoreError,
  appendJoyProgressLog,
  attachJoyEvidence,
  createJoyMilestone,
  createJoyTask,
  getJoyOverview,
  getJoyProject,
  listJoyProjects,
  updateJoyMilestone,
  updateJoyProject,
  updateJoyTask,
} from "./joy-core/service.js";

const MCP_PATH = "/mcp";
const MCP_HEALTH_PATH = "/mcp/health";
const MCP_PROTOCOL_VERSION = "2025-11-25";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  MCP_PROTOCOL_VERSION,
  "2025-06-18",
  "2025-03-26",
]);
const MAX_BODY_BYTES = 64_000;

const defaultService = {
  getOverview: getJoyOverview,
  listProjects: listJoyProjects,
  getProject: getJoyProject,
  updateProject: updateJoyProject,
  createTask: createJoyTask,
  updateTask: updateJoyTask,
  createMilestone: createJoyMilestone,
  updateMilestone: updateJoyMilestone,
  appendProgressLog: appendJoyProgressLog,
  attachEvidence: attachJoyEvidence,
};

const noArgumentsSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const projectStatusSchema = {
  type: "string",
  enum: ["planned", "active", "paused", "blocked", "completed"],
};

const taskStatusSchema = {
  type: "string",
  enum: ["todo", "in_progress", "blocked", "done"],
};

const prioritySchema = {
  type: "string",
  enum: ["low", "normal", "high", "critical"],
};

const timestampSchema = {
  anyOf: [{ type: "integer" }, { type: "null" }],
  description: "Unix timestamp in milliseconds, or null.",
};

const versionSchema = {
  type: "integer",
  minimum: 0,
  description: "Entity version returned by the latest read. Used for optimistic concurrency.",
};

const clientRequestIdSchema = {
  type: "string",
  minLength: 1,
  maxLength: 60,
  description: "Stable idempotency key. Reuse the same value when retrying the same create request.",
};

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const JOY_MCP_TOOLS = Object.freeze([
  {
    name: "get_overview",
    title: "Get Joy overview",
    description: "Read active projects, open project tasks, inbox tasks, and recent progress logs from Joy Core.",
    inputSchema: {
      type: "object",
      properties: {
        taskLimit: { type: "integer", minimum: 1, maximum: 200 },
        inboxLimit: { type: "integer", minimum: 1, maximum: 200 },
        logLimit: { type: "integer", minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
    annotations: readAnnotations,
  },
  {
    name: "list_projects",
    title: "List Joy projects",
    description: "List projects visible to the private Joy assistant.",
    inputSchema: noArgumentsSchema,
    annotations: readAnnotations,
  },
  {
    name: "get_project",
    title: "Get Joy project",
    description: "Read one project together with its tasks, milestones, progress logs, and evidence.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", minLength: 1, maxLength: 80 },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
    annotations: readAnnotations,
  },
  {
    name: "update_project",
    title: "Update Joy project",
    description: "Update safe project status fields. Archiving and deletion are not available.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", minLength: 1, maxLength: 80 },
        baseVersion: versionSchema,
        title: { type: "string", minLength: 1, maxLength: 200 },
        summary: { type: "string", maxLength: 4000 },
        status: projectStatusSchema,
        progress: { type: "number", minimum: 0, maximum: 100 },
        currentStageId: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
        currentFocus: { type: "string", maxLength: 2000 },
        nextAction: { type: "string", maxLength: 2000 },
        blockers: { type: "array", items: { type: "string", maxLength: 1000 }, maxItems: 50 },
        metadata: { type: "object", additionalProperties: true },
      },
      required: ["projectId", "baseVersion"],
      additionalProperties: false,
    },
    annotations: writeAnnotations,
  },
  {
    name: "create_task",
    title: "Create Joy project task",
    description: "Create a task inside a Joy Core project. Supply clientRequestId for retry-safe creation.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", minLength: 1, maxLength: 80 },
        milestoneId: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
        title: { type: "string", minLength: 1, maxLength: 300 },
        description: { type: "string", maxLength: 8000 },
        status: taskStatusSchema,
        priority: prioritySchema,
        dueAt: timestampSchema,
        scheduledFor: timestampSchema,
        position: { type: "integer", minimum: 0 },
        metadata: { type: "object", additionalProperties: true },
        clientRequestId: clientRequestIdSchema,
      },
      required: ["projectId", "title", "clientRequestId"],
      additionalProperties: false,
    },
    annotations: writeAnnotations,
  },
  {
    name: "update_task",
    title: "Update Joy project task",
    description: "Update a Joy Core task using the latest baseVersion. Deletion is not available.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", minLength: 1, maxLength: 80 },
        baseVersion: versionSchema,
        milestoneId: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
        title: { type: "string", minLength: 1, maxLength: 300 },
        description: { type: "string", maxLength: 8000 },
        status: taskStatusSchema,
        priority: prioritySchema,
        dueAt: timestampSchema,
        scheduledFor: timestampSchema,
        position: { type: "integer", minimum: 0 },
        metadata: { type: "object", additionalProperties: true },
      },
      required: ["taskId", "baseVersion"],
      additionalProperties: false,
    },
    annotations: writeAnnotations,
  },
  {
    name: "create_milestone",
    title: "Create Joy milestone",
    description: "Create a milestone in a Joy Core project with a stable clientRequestId.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", minLength: 1, maxLength: 80 },
        title: { type: "string", minLength: 1, maxLength: 300 },
        description: { type: "string", maxLength: 8000 },
        status: { type: "string", enum: ["planned", "in_progress", "blocked", "completed"] },
        targetAt: timestampSchema,
        position: { type: "integer", minimum: 0 },
        metadata: { type: "object", additionalProperties: true },
        clientRequestId: clientRequestIdSchema,
      },
      required: ["projectId", "title", "clientRequestId"],
      additionalProperties: false,
    },
    annotations: writeAnnotations,
  },
  {
    name: "update_milestone",
    title: "Update Joy milestone",
    description: "Update a Joy Core milestone using the latest baseVersion. Deletion is not available.",
    inputSchema: {
      type: "object",
      properties: {
        milestoneId: { type: "string", minLength: 1, maxLength: 80 },
        baseVersion: versionSchema,
        title: { type: "string", minLength: 1, maxLength: 300 },
        description: { type: "string", maxLength: 8000 },
        status: { type: "string", enum: ["planned", "in_progress", "blocked", "completed"] },
        targetAt: timestampSchema,
        position: { type: "integer", minimum: 0 },
        metadata: { type: "object", additionalProperties: true },
      },
      required: ["milestoneId", "baseVersion"],
      additionalProperties: false,
    },
    annotations: writeAnnotations,
  },
  {
    name: "append_progress_log",
    title: "Append Joy progress log",
    description: "Record a non-destructive project progress entry with an idempotency key.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", minLength: 1, maxLength: 80 },
        taskId: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
        kind: { type: "string", enum: ["note", "progress", "decision", "blocker", "result"] },
        title: { type: "string", minLength: 1, maxLength: 300 },
        detail: { type: "string", maxLength: 12000 },
        progressAfter: { anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] },
        occurredAt: timestampSchema,
        metadata: { type: "object", additionalProperties: true },
        clientRequestId: clientRequestIdSchema,
      },
      required: ["projectId", "kind", "title", "clientRequestId"],
      additionalProperties: false,
    },
    annotations: writeAnnotations,
  },
  {
    name: "attach_evidence",
    title: "Attach Joy evidence reference",
    description: "Attach a safe evidence reference such as a report, screenshot, log, map, or video URL.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", minLength: 1, maxLength: 80 },
        taskId: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
        progressLogId: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
        kind: { type: "string", enum: ["link", "document", "screenshot", "image", "video", "log", "map", "dataset", "other"] },
        label: { type: "string", minLength: 1, maxLength: 300 },
        uri: { type: "string", minLength: 1, maxLength: 4000 },
        contentType: { anyOf: [{ type: "string", maxLength: 200 }, { type: "null" }] },
        metadata: { type: "object", additionalProperties: true },
        clientRequestId: clientRequestIdSchema,
      },
      required: ["projectId", "kind", "label", "uri", "clientRequestId"],
      additionalProperties: false,
    },
    annotations: writeAnnotations,
  },
]);

function responseHeaders(extra = {}) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    ...extra,
  };
}

function jsonResponse(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders(extra),
  });
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message, data = undefined) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function toolSuccess(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
    isError: false,
  };
}

function toolFailure(error) {
  const payload = {
    error: String(error?.code || error?.message || "JOY_MCP_TOOL_FAILED"),
    details: error?.details || null,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError: true,
  };
}

function withoutKeys(value, keys) {
  const output = { ...(value || {}) };
  for (const key of keys) delete output[key];
  return output;
}

function requireString(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new JoyCoreError("JOY_MCP_INVALID_ARGUMENTS", 400, { field });
  return normalized;
}

async function callTool(name, args, env, context, service) {
  switch (name) {
    case "get_overview":
      return service.getOverview(env, context, args);
    case "list_projects":
      return { projects: await service.listProjects(env, context) };
    case "get_project":
      return service.getProject(env, context, requireString(args.projectId, "projectId"));
    case "update_project":
      return service.updateProject(
        env,
        context,
        requireString(args.projectId, "projectId"),
        withoutKeys(args, ["projectId"]),
      );
    case "create_task":
      return service.createTask(
        env,
        context,
        requireString(args.projectId, "projectId"),
        withoutKeys(args, ["projectId"]),
      );
    case "update_task":
      return service.updateTask(
        env,
        context,
        requireString(args.taskId, "taskId"),
        withoutKeys(args, ["taskId"]),
      );
    case "create_milestone":
      return service.createMilestone(
        env,
        context,
        requireString(args.projectId, "projectId"),
        withoutKeys(args, ["projectId"]),
      );
    case "update_milestone":
      return service.updateMilestone(
        env,
        context,
        requireString(args.milestoneId, "milestoneId"),
        withoutKeys(args, ["milestoneId"]),
      );
    case "append_progress_log":
      return service.appendProgressLog(
        env,
        context,
        requireString(args.projectId, "projectId"),
        withoutKeys(args, ["projectId"]),
      );
    case "attach_evidence":
      return service.attachEvidence(
        env,
        context,
        requireString(args.projectId, "projectId"),
        withoutKeys(args, ["projectId"]),
      );
    default:
      throw new JoyCoreError("JOY_MCP_TOOL_NOT_FOUND", 404, { name });
  }
}

function negotiatedVersion(requested) {
  return SUPPORTED_PROTOCOL_VERSIONS.has(requested)
    ? requested
    : MCP_PROTOCOL_VERSION;
}

function validateProtocolHeader(request, method) {
  if (method === "initialize") return;
  const version = request.headers.get("MCP-Protocol-Version");
  if (version && !SUPPORTED_PROTOCOL_VERSIONS.has(version)) {
    throw new JoyCoreError("JOY_MCP_PROTOCOL_VERSION_UNSUPPORTED", 400, {
      received: version,
      supported: [...SUPPORTED_PROTOCOL_VERSIONS],
    });
  }
}

async function readMessage(request) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new JoyCoreError("JOY_MCP_BODY_TOO_LARGE", 413);
  }
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new JoyCoreError("JOY_MCP_CONTENT_TYPE_REQUIRED", 415);
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new JoyCoreError("JOY_MCP_BODY_TOO_LARGE", 413);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new JoyCoreError("JOY_MCP_PARSE_ERROR", 400);
  }
}

async function authenticateJoyMcp(request, env) {
  const context = await authenticateJoyActions(request, env);
  return {
    ...context,
    actorType: "assistant",
    actorId: "chatgpt-mcp",
  };
}

async function processMessage(message, request, env, context, service) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return rpcError(null, -32600, "Invalid Request");
  }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message.id, -32600, "Invalid Request");
  }

  const { id, method } = message;
  const isNotification = id === undefined;
  validateProtocolHeader(request, method);

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return null;
  }
  if (isNotification) return null;

  if (method === "initialize") {
    const requestedVersion = String(message.params?.protocolVersion || "");
    return rpcResult(id, {
      protocolVersion: negotiatedVersion(requestedVersion),
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: "joy-personal-dashboard",
        title: "Joy Personal Dashboard",
        version: "1.0.0",
      },
      instructions: "Use Joy tools to read and safely update the owner's structured projects, tasks, milestones, progress logs, and evidence. Never invent completion or evidence. No destructive tools are available.",
    });
  }

  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools: JOY_MCP_TOOLS });

  if (method === "tools/call") {
    const name = requireString(message.params?.name, "name");
    const args = message.params?.arguments;
    if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args))) {
      return rpcError(id, -32602, "Invalid params", { field: "arguments" });
    }
    try {
      const value = await callTool(name, args || {}, env, context, service);
      return rpcResult(id, toolSuccess(value));
    } catch (error) {
      if (error instanceof JoyCoreError || error?.code) {
        return rpcResult(id, toolFailure(error));
      }
      console.error("Joy MCP tool failed", error);
      return rpcResult(id, toolFailure(new JoyCoreError("JOY_MCP_TOOL_FAILED", 500)));
    }
  }

  return rpcError(id, -32601, "Method not found", { method });
}

function authErrorResponse(error) {
  const status = Number(error?.status || 500);
  const code = String(error?.code || "JOY_MCP_AUTH_FAILED");
  return jsonResponse({ error: code, details: error?.details || null }, status, status === 401
    ? { "WWW-Authenticate": "Bearer realm=\"Joy MCP\"" }
    : {});
}

export function isJoyMcpRoute(pathname) {
  return pathname === MCP_PATH || pathname === MCP_HEALTH_PATH;
}

export async function handleJoyMcpRequest(request, env, dependencies = {}) {
  const url = new URL(request.url);
  const service = dependencies.service || defaultService;
  const authenticate = dependencies.authenticate || authenticateJoyMcp;

  if (url.pathname === MCP_HEALTH_PATH) {
    if (request.method !== "GET") {
      return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET" });
    }
    return jsonResponse({
      ok: true,
      configured: Boolean(env?.JOY_GPT_ACTION_KEY && env?.JOY_OWNER_EMAIL),
      transport: "streamable-http",
      stateless: true,
      protocolVersion: MCP_PROTOCOL_VERSION,
      toolCount: JOY_MCP_TOOLS.length,
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: "POST, OPTIONS",
        "Cache-Control": "no-store",
      },
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST, OPTIONS" });
  }

  let context;
  try {
    context = await authenticate(request, env);
  } catch (error) {
    return authErrorResponse(error);
  }

  let message;
  try {
    message = await readMessage(request);
  } catch (error) {
    if (error?.code === "JOY_MCP_PARSE_ERROR") {
      return jsonResponse(rpcError(null, -32700, "Parse error"), 400);
    }
    return jsonResponse(rpcError(null, -32600, String(error?.code || "Invalid Request")), Number(error?.status || 400));
  }

  if (Array.isArray(message)) {
    return jsonResponse(rpcError(null, -32600, "JSON-RPC batching is not supported"), 400);
  }

  try {
    const response = await processMessage(message, request, env, context, service);
    if (response === null) {
      return new Response(null, {
        status: 202,
        headers: {
          "Cache-Control": "no-store",
          "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
        },
      });
    }
    return jsonResponse(response);
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status >= 500) console.error("Joy MCP request failed", error);
    return jsonResponse(rpcError(
      message?.id,
      status >= 500 ? -32603 : -32602,
      String(error?.code || "JOY_MCP_REQUEST_FAILED"),
      error?.details || undefined,
    ), status);
  }
}
