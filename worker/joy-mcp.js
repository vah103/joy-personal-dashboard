import { authenticateJoyActions } from "./joy-actions.js";
import {
  EVIDENCE_KINDS,
  MILESTONE_STATUSES,
  PROGRESS_LOG_KINDS,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "./joy-core/model.js";
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
import { json as sharedJson } from "./shared/http.js";

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

const readAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});
const writeAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
});

const id = (description) => ({
  type: "string",
  minLength: 1,
  maxLength: 80,
  description,
});
const nullableId = (description) => ({
  anyOf: [id(description), { type: "null" }],
});
const enumSchema = (values) => ({ type: "string", enum: [...values] });
const timestamp = (description = "Unix timestamp in milliseconds, or null.") => ({
  anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
  description,
});
const metadata = { type: "object", additionalProperties: true };
const baseVersion = {
  type: "integer",
  minimum: 0,
  description: "Entity version from the latest read, used for optimistic concurrency.",
};
const clientRequestId = {
  type: "string",
  minLength: 1,
  maxLength: 60,
  description: "Stable idempotency key. Reuse it only when retrying the same create request.",
};
const noArguments = { type: "object", properties: {}, additionalProperties: false };
const safeProjectStatuses = PROJECT_STATUSES.filter((status) => status !== "archived");

function objectSchema(properties, required = []) {
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}

export const JOY_MCP_TOOLS = Object.freeze([
  {
    name: "get_overview",
    title: "Get Joy overview",
    description: "Read active projects, open project tasks, inbox tasks, and recent progress logs from Joy Core.",
    inputSchema: objectSchema({
      taskLimit: { type: "integer", minimum: 1, maximum: 200 },
      inboxLimit: { type: "integer", minimum: 1, maximum: 200 },
      logLimit: { type: "integer", minimum: 1, maximum: 200 },
    }),
    annotations: readAnnotations,
  },
  {
    name: "list_projects",
    title: "List Joy projects",
    description: "List projects visible to the private Joy assistant.",
    inputSchema: noArguments,
    annotations: readAnnotations,
  },
  {
    name: "get_project",
    title: "Get Joy project",
    description: "Read one project with its tasks, milestones, progress logs, and evidence.",
    inputSchema: objectSchema({ projectId: id("Joy project id.") }, ["projectId"]),
    annotations: readAnnotations,
  },
  {
    name: "update_project",
    title: "Update Joy project",
    description: "Update safe project fields. Archiving and deletion are not available.",
    inputSchema: objectSchema({
      projectId: id("Joy project id."),
      baseVersion,
      title: { type: "string", minLength: 1, maxLength: 240 },
      summary: { type: "string", maxLength: 4000 },
      status: enumSchema(safeProjectStatuses),
      progress: { type: "number", minimum: 0, maximum: 100 },
      currentStageId: nullableId("Current stage id."),
      currentFocus: { type: "string", maxLength: 1000 },
      nextAction: { type: "string", maxLength: 1000 },
      blockers: {
        type: "array",
        items: { type: "string", maxLength: 500 },
        maxItems: 30,
      },
      metadata,
    }, ["projectId", "baseVersion"]),
    annotations: writeAnnotations,
  },
  {
    name: "create_task",
    title: "Create Joy project task",
    description: "Create a task inside a Joy project using a retry-safe clientRequestId.",
    inputSchema: objectSchema({
      projectId: id("Joy project id."),
      milestoneId: nullableId("Optional milestone id."),
      title: { type: "string", minLength: 1, maxLength: 240 },
      description: { type: "string", maxLength: 4000 },
      status: enumSchema(TASK_STATUSES),
      priority: enumSchema(TASK_PRIORITIES),
      dueAt: timestamp(),
      scheduledFor: timestamp(),
      position: { type: "integer" },
      metadata,
      clientRequestId,
    }, ["projectId", "title", "clientRequestId"]),
    annotations: writeAnnotations,
  },
  {
    name: "update_task",
    title: "Update Joy project task",
    description: "Update a task using its latest baseVersion. Deletion is not available.",
    inputSchema: objectSchema({
      taskId: id("Joy task id."),
      baseVersion,
      milestoneId: nullableId("Optional milestone id."),
      title: { type: "string", minLength: 1, maxLength: 240 },
      description: { type: "string", maxLength: 4000 },
      status: enumSchema(TASK_STATUSES),
      priority: enumSchema(TASK_PRIORITIES),
      dueAt: timestamp(),
      scheduledFor: timestamp(),
      position: { type: "integer" },
      metadata,
    }, ["taskId", "baseVersion"]),
    annotations: writeAnnotations,
  },
  {
    name: "create_milestone",
    title: "Create Joy milestone",
    description: "Create a milestone in a Joy project using a retry-safe clientRequestId.",
    inputSchema: objectSchema({
      projectId: id("Joy project id."),
      title: { type: "string", minLength: 1, maxLength: 240 },
      description: { type: "string", maxLength: 4000 },
      status: enumSchema(MILESTONE_STATUSES),
      targetAt: timestamp(),
      position: { type: "integer" },
      metadata,
      clientRequestId,
    }, ["projectId", "title", "clientRequestId"]),
    annotations: writeAnnotations,
  },
  {
    name: "update_milestone",
    title: "Update Joy milestone",
    description: "Update a milestone using its latest baseVersion. Deletion is not available.",
    inputSchema: objectSchema({
      milestoneId: id("Joy milestone id."),
      baseVersion,
      title: { type: "string", minLength: 1, maxLength: 240 },
      description: { type: "string", maxLength: 4000 },
      status: enumSchema(MILESTONE_STATUSES),
      targetAt: timestamp(),
      position: { type: "integer" },
      metadata,
    }, ["milestoneId", "baseVersion"]),
    annotations: writeAnnotations,
  },
  {
    name: "append_progress_log",
    title: "Append Joy progress log",
    description: "Record a non-destructive project progress entry using an idempotency key.",
    inputSchema: objectSchema({
      projectId: id("Joy project id."),
      taskId: nullableId("Optional related task id."),
      kind: enumSchema(PROGRESS_LOG_KINDS),
      title: { type: "string", minLength: 1, maxLength: 240 },
      detail: { type: "string", maxLength: 20000 },
      progressAfter: {
        anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }],
      },
      occurredAt: timestamp(),
      metadata,
      clientRequestId,
    }, ["projectId", "kind", "title", "clientRequestId"]),
    annotations: writeAnnotations,
  },
  {
    name: "attach_evidence",
    title: "Attach Joy evidence reference",
    description: "Attach a report, URL, image, log, commit, or other evidence reference to a project.",
    inputSchema: objectSchema({
      projectId: id("Joy project id."),
      taskId: nullableId("Optional related task id."),
      progressLogId: nullableId("Optional related progress-log id."),
      kind: enumSchema(EVIDENCE_KINDS),
      label: { type: "string", minLength: 1, maxLength: 240 },
      uri: { type: "string", minLength: 1, maxLength: 2000 },
      contentType: {
        anyOf: [{ type: "string", maxLength: 200 }, { type: "null" }],
      },
      metadata,
      clientRequestId,
    }, ["projectId", "kind", "label", "uri", "clientRequestId"]),
    annotations: writeAnnotations,
  },
]);

function mcpJson(value, status = 200, extra = {}) {
  return sharedJson(value, status, {
    "X-Robots-Tag": "noindex, nofollow",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    ...extra,
  });
}

function result(idValue, value) {
  return { jsonrpc: "2.0", id: idValue, result: value };
}

function error(idValue, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: idValue ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

function toolResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
    isError: false,
  };
}

function toolError(cause) {
  const value = {
    error: String(cause?.code || cause?.message || "JOY_MCP_TOOL_FAILED"),
    details: cause?.details || null,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
    isError: true,
  };
}

function requiredString(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new JoyCoreError("JOY_MCP_INVALID_ARGUMENTS", 400, { field });
  }
  return normalized;
}

function omit(value, keys) {
  const output = { ...(value || {}) };
  for (const key of keys) delete output[key];
  return output;
}

async function callTool(name, args, env, context, service) {
  switch (name) {
    case "get_overview":
      return service.getOverview(env, context, args);
    case "list_projects":
      return { projects: await service.listProjects(env, context) };
    case "get_project":
      return service.getProject(env, context, requiredString(args.projectId, "projectId"));
    case "update_project":
      return service.updateProject(
        env,
        context,
        requiredString(args.projectId, "projectId"),
        omit(args, ["projectId"]),
      );
    case "create_task":
      return service.createTask(
        env,
        context,
        requiredString(args.projectId, "projectId"),
        omit(args, ["projectId"]),
      );
    case "update_task":
      return service.updateTask(
        env,
        context,
        requiredString(args.taskId, "taskId"),
        omit(args, ["taskId"]),
      );
    case "create_milestone":
      return service.createMilestone(
        env,
        context,
        requiredString(args.projectId, "projectId"),
        omit(args, ["projectId"]),
      );
    case "update_milestone":
      return service.updateMilestone(
        env,
        context,
        requiredString(args.milestoneId, "milestoneId"),
        omit(args, ["milestoneId"]),
      );
    case "append_progress_log":
      return service.appendProgressLog(
        env,
        context,
        requiredString(args.projectId, "projectId"),
        omit(args, ["projectId"]),
      );
    case "attach_evidence":
      return service.attachEvidence(
        env,
        context,
        requiredString(args.projectId, "projectId"),
        omit(args, ["projectId"]),
      );
    default:
      throw new JoyCoreError("JOY_MCP_TOOL_NOT_FOUND", 404, { name });
  }
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
  const contentType = String(request.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
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

async function authenticateMcp(request, env) {
  return {
    ...await authenticateJoyActions(request, env),
    actorType: "assistant",
    actorId: "chatgpt-mcp",
  };
}

async function processMessage(message, request, env, context, service) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return error(null, -32600, "Invalid Request");
  }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return error(message.id, -32600, "Invalid Request");
  }

  const { id: idValue, method } = message;
  validateProtocolHeader(request, method);

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return null;
  }
  if (idValue === undefined) return null;

  if (method === "initialize") {
    const requested = String(message.params?.protocolVersion || "");
    return result(idValue, {
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.has(requested)
        ? requested
        : MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "joy-personal-dashboard",
        title: "Joy Personal Dashboard",
        version: "1.0.0",
      },
      instructions: "Use Joy tools to read and safely update the owner's structured projects, tasks, milestones, progress logs, and evidence. Never invent completion or evidence. No destructive tools are available.",
    });
  }

  if (method === "ping") return result(idValue, {});
  if (method === "tools/list") return result(idValue, { tools: JOY_MCP_TOOLS });

  if (method === "tools/call") {
    const name = requiredString(message.params?.name, "name");
    const args = message.params?.arguments;
    if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args))) {
      return error(idValue, -32602, "Invalid params", { field: "arguments" });
    }
    try {
      return result(idValue, toolResult(
        await callTool(name, args || {}, env, context, service),
      ));
    } catch (cause) {
      if (cause instanceof JoyCoreError || cause?.code) {
        return result(idValue, toolError(cause));
      }
      console.error("Joy MCP tool failed", cause);
      return result(idValue, toolError(new JoyCoreError("JOY_MCP_TOOL_FAILED", 500)));
    }
  }

  return error(idValue, -32601, "Method not found", { method });
}

function authenticationFailure(cause) {
  const status = Number(cause?.status || 500);
  return mcpJson({
    error: String(cause?.code || "JOY_MCP_AUTH_FAILED"),
    details: cause?.details || null,
  }, status, status === 401 ? { "WWW-Authenticate": "Bearer realm=\"Joy MCP\"" } : {});
}

export function isJoyMcpRoute(pathname) {
  return pathname === MCP_PATH || pathname === MCP_HEALTH_PATH;
}

export async function handleJoyMcpRequest(request, env, dependencies = {}) {
  const url = new URL(request.url);
  const service = dependencies.service || defaultService;
  const authenticate = dependencies.authenticate || authenticateMcp;

  if (url.pathname === MCP_HEALTH_PATH) {
    if (request.method !== "GET") {
      return mcpJson({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET" });
    }
    return mcpJson({
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
      headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" },
    });
  }
  if (request.method !== "POST") {
    return mcpJson({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST, OPTIONS" });
  }

  let context;
  try {
    context = await authenticate(request, env);
  } catch (cause) {
    return authenticationFailure(cause);
  }

  let message;
  try {
    message = await readMessage(request);
  } catch (cause) {
    if (cause?.code === "JOY_MCP_PARSE_ERROR") {
      return mcpJson(error(null, -32700, "Parse error"), 400);
    }
    return mcpJson(
      error(null, -32600, String(cause?.code || "Invalid Request")),
      Number(cause?.status || 400),
    );
  }

  if (Array.isArray(message)) {
    return mcpJson(error(null, -32600, "JSON-RPC batching is not supported"), 400);
  }

  try {
    const rpcResponse = await processMessage(message, request, env, context, service);
    if (rpcResponse === null) {
      return new Response(null, {
        status: 202,
        headers: {
          "Cache-Control": "no-store",
          "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
        },
      });
    }
    return mcpJson(rpcResponse);
  } catch (cause) {
    const status = Number(cause?.status || 500);
    if (status >= 500) console.error("Joy MCP request failed", cause);
    return mcpJson(error(
      message?.id,
      status >= 500 ? -32603 : -32602,
      String(cause?.code || "JOY_MCP_REQUEST_FAILED"),
      cause?.details || undefined,
    ), status);
  }
}
