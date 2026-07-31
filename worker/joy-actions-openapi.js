const nullableInteger = { type: "integer", nullable: true };
const nullableString = { type: "string", nullable: true };

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const projectIdParameter = {
  name: "projectId",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Stable lowercase Joy project ID, for example turtlebot4 or ielts.",
};

const taskIdParameter = {
  name: "taskId",
  in: "path",
  required: true,
  schema: { type: "string" },
};

const milestoneIdParameter = {
  name: "milestoneId",
  in: "path",
  required: true,
  schema: { type: "string" },
};

const errorResponse = {
  description: "The request could not be completed.",
  content: { "application/json": { schema: ref("Error") } },
};

const successJson = (schema) => ({
  description: "Success",
  content: { "application/json": { schema } },
});

const writeResponses = (schema) => ({
  200: successJson(schema),
  201: successJson(schema),
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  503: errorResponse,
});

const projectSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    status: {
      type: "string",
      enum: ["planned", "active", "blocked", "paused", "completed", "archived"],
    },
    progress: { type: "integer", minimum: 0, maximum: 100 },
    currentStageId: nullableString,
    currentFocus: { type: "string" },
    nextAction: { type: "string" },
    blockers: { type: "array", items: { type: "string" } },
    version: { type: "integer", minimum: 0 },
    createdAt: { type: "integer" },
    updatedAt: { type: "integer" },
  },
  required: ["id", "title", "status", "progress", "version", "updatedAt"],
};

const taskSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    milestoneId: nullableString,
    title: { type: "string" },
    description: { type: "string" },
    status: {
      type: "string",
      enum: ["todo", "in_progress", "blocked", "done", "cancelled"],
    },
    priority: { type: "string", enum: ["low", "normal", "high", "critical"] },
    dueAt: nullableInteger,
    scheduledFor: nullableInteger,
    completedAt: nullableInteger,
    version: { type: "integer", minimum: 0 },
    createdAt: { type: "integer" },
    updatedAt: { type: "integer" },
  },
  required: ["id", "projectId", "title", "status", "priority", "version"],
};

const milestoneSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    status: {
      type: "string",
      enum: ["planned", "active", "completed", "missed", "cancelled"],
    },
    targetAt: nullableInteger,
    completedAt: nullableInteger,
    version: { type: "integer", minimum: 0 },
  },
  required: ["id", "projectId", "title", "status", "version"],
};

const progressLogSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    taskId: nullableString,
    kind: {
      type: "string",
      enum: ["note", "progress", "decision", "blocker", "result"],
    },
    title: { type: "string" },
    detail: { type: "string" },
    progressAfter: nullableInteger,
    occurredAt: { type: "integer" },
  },
  required: ["id", "projectId", "kind", "title", "occurredAt"],
};

const evidenceSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    taskId: nullableString,
    progressLogId: nullableString,
    kind: { type: "string", enum: ["file", "url", "image", "log", "commit"] },
    label: { type: "string" },
    uri: { type: "string" },
    contentType: nullableString,
    createdAt: { type: "integer" },
  },
  required: ["id", "projectId", "kind", "label", "uri"],
};

export const JOY_ACTIONS_OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "Joy Personal Dashboard Actions",
    version: "1.0.1",
    description: "Read and safely update the owner's Joy projects, tasks, milestones, progress logs, and evidence. This API intentionally exposes no delete operations.",
  },
  servers: [{ url: "https://app.hey-joy.workers.dev" }],
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/joy/v1/overview": {
      get: {
        operationId: "getJoyOverview",
        summary: "Get the owner's current Joy overview",
        description: "Use this before recommending what the owner should work on. Returns projects, open project tasks, inbox tasks, and recent progress logs.",
        responses: {
          200: successJson(ref("Overview")),
          401: errorResponse,
          403: errorResponse,
          503: errorResponse,
        },
      },
    },
    "/api/joy/v1/projects": {
      get: {
        operationId: "listJoyProjects",
        summary: "List Joy projects",
        description: "Returns canonical projects plus read-only compatibility projects that have not yet been promoted to Joy Core.",
        responses: {
          200: successJson({
            type: "object",
            properties: { projects: { type: "array", items: ref("Project") } },
            required: ["projects"],
          }),
          401: errorResponse,
          403: errorResponse,
          503: errorResponse,
        },
      },
    },
    "/api/joy/v1/projects/{projectId}": {
      get: {
        operationId: "getJoyProject",
        summary: "Get one Joy project with its related records",
        description: "Use this before discussing or changing a specific project.",
        parameters: [projectIdParameter],
        responses: {
          200: successJson(ref("ProjectDetail")),
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          503: errorResponse,
        },
      },
      patch: {
        operationId: "updateJoyProject",
        summary: "Update a Joy project",
        description: "Update focus, next action, progress, blockers, status, or descriptive fields. Assistant credentials cannot archive or delete projects.",
        parameters: [projectIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: ref("ProjectUpdateInput") } },
        },
        responses: writeResponses(ref("Project")),
      },
    },
    "/api/joy/v1/projects/{projectId}/tasks": {
      post: {
        operationId: "createJoyTask",
        summary: "Create a project task",
        description: "Create a task only after the owner asks for it or clearly approves the proposed work. Supply a stable clientRequestId to make retries idempotent.",
        parameters: [projectIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: ref("TaskCreateInput") } },
        },
        responses: writeResponses(ref("TaskCreateResult")),
      },
    },
    "/api/joy/v1/tasks/{taskId}": {
      patch: {
        operationId: "updateJoyTask",
        summary: "Update a project task",
        description: "Change a task's status or details. Mark a task done only when the owner confirms it was completed or provides clear completion evidence.",
        parameters: [taskIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: ref("TaskUpdateInput") } },
        },
        responses: writeResponses(ref("Task")),
      },
    },
    "/api/joy/v1/projects/{projectId}/milestones": {
      post: {
        operationId: "createJoyMilestone",
        summary: "Create a project milestone",
        parameters: [projectIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: ref("MilestoneCreateInput") } },
        },
        responses: writeResponses(ref("MilestoneCreateResult")),
      },
    },
    "/api/joy/v1/milestones/{milestoneId}": {
      patch: {
        operationId: "updateJoyMilestone",
        summary: "Update a project milestone",
        parameters: [milestoneIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: ref("MilestoneUpdateInput") } },
        },
        responses: writeResponses(ref("Milestone")),
      },
    },
    "/api/joy/v1/projects/{projectId}/logs": {
      post: {
        operationId: "appendJoyProgressLog",
        summary: "Append a project progress log",
        description: "Append an immutable note, progress update, decision, blocker, or result. Use a stable clientRequestId to make retries idempotent.",
        parameters: [projectIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: ref("ProgressLogCreateInput") } },
        },
        responses: writeResponses(ref("ProgressLogCreateResult")),
      },
    },
    "/api/joy/v1/projects/{projectId}/evidence": {
      post: {
        operationId: "attachJoyEvidence",
        summary: "Attach evidence to a project",
        description: "Attach a file path, URL, image reference, log, or commit. This stores a reference only and does not upload file bytes.",
        parameters: [projectIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: ref("EvidenceCreateInput") } },
        },
        responses: writeResponses(ref("EvidenceCreateResult")),
      },
    },
  },
  components: {
    schemas: {
      Project: projectSchema,
      Task: taskSchema,
      Milestone: milestoneSchema,
      ProgressLog: progressLogSchema,
      Evidence: evidenceSchema,
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "object", nullable: true, additionalProperties: true },
        },
        required: ["error"],
      },
      Overview: {
        type: "object",
        properties: {
          projects: { type: "array", items: ref("Project") },
          openTasks: { type: "array", items: ref("Task") },
          inboxTasks: { type: "array", items: { type: "object", additionalProperties: true } },
          recentLogs: { type: "array", items: ref("ProgressLog") },
          generatedAt: { type: "integer" },
        },
        required: ["projects", "openTasks", "inboxTasks", "recentLogs"],
      },
      ProjectDetail: {
        type: "object",
        properties: {
          project: ref("Project"),
          tasks: { type: "array", items: ref("Task") },
          milestones: { type: "array", items: ref("Milestone") },
          progressLogs: { type: "array", items: ref("ProgressLog") },
          evidence: { type: "array", items: ref("Evidence") },
          compatibilityMode: { type: "boolean" },
        },
        required: ["project", "tasks", "milestones", "progressLogs", "evidence"],
      },
      ProjectUpdateInput: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 240 },
          summary: { type: "string", maxLength: 4000 },
          status: { type: "string", enum: ["planned", "active", "blocked", "paused", "completed"] },
          progress: { type: "integer", minimum: 0, maximum: 100 },
          currentStageId: nullableString,
          currentFocus: { type: "string", maxLength: 1000 },
          nextAction: { type: "string", maxLength: 1000 },
          blockers: { type: "array", maxItems: 30, items: { type: "string" } },
          baseVersion: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
      TaskCreateInput: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 240 },
          description: { type: "string", maxLength: 4000 },
          milestoneId: nullableString,
          status: { type: "string", enum: ["todo", "in_progress", "blocked", "done", "cancelled"] },
          priority: { type: "string", enum: ["low", "normal", "high", "critical"] },
          dueAt: nullableInteger,
          scheduledFor: nullableInteger,
          clientRequestId: { type: "string", maxLength: 80 },
        },
        required: ["title"],
        additionalProperties: false,
      },
      TaskUpdateInput: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 240 },
          description: { type: "string", maxLength: 4000 },
          milestoneId: nullableString,
          status: { type: "string", enum: ["todo", "in_progress", "blocked", "done", "cancelled"] },
          priority: { type: "string", enum: ["low", "normal", "high", "critical"] },
          dueAt: nullableInteger,
          scheduledFor: nullableInteger,
          baseVersion: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
      TaskCreateResult: {
        type: "object",
        properties: { task: ref("Task"), deduplicated: { type: "boolean" } },
        required: ["task", "deduplicated"],
      },
      MilestoneCreateInput: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 240 },
          description: { type: "string", maxLength: 4000 },
          status: { type: "string", enum: ["planned", "active", "completed", "missed", "cancelled"] },
          targetAt: nullableInteger,
          clientRequestId: { type: "string", maxLength: 80 },
        },
        required: ["title"],
        additionalProperties: false,
      },
      MilestoneUpdateInput: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 240 },
          description: { type: "string", maxLength: 4000 },
          status: { type: "string", enum: ["planned", "active", "completed", "missed", "cancelled"] },
          targetAt: nullableInteger,
          baseVersion: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
      MilestoneCreateResult: {
        type: "object",
        properties: { milestone: ref("Milestone"), deduplicated: { type: "boolean" } },
        required: ["milestone", "deduplicated"],
      },
      ProgressLogCreateInput: {
        type: "object",
        properties: {
          taskId: nullableString,
          kind: { type: "string", enum: ["note", "progress", "decision", "blocker", "result"] },
          title: { type: "string", maxLength: 240 },
          detail: { type: "string", maxLength: 20000 },
          progressAfter: nullableInteger,
          occurredAt: { type: "integer" },
          clientRequestId: { type: "string", maxLength: 80 },
        },
        required: ["title"],
        additionalProperties: false,
      },
      ProgressLogCreateResult: {
        type: "object",
        properties: {
          progressLog: ref("ProgressLog"),
          project: ref("Project"),
          deduplicated: { type: "boolean" },
        },
        required: ["progressLog", "project", "deduplicated"],
      },
      EvidenceCreateInput: {
        type: "object",
        properties: {
          taskId: nullableString,
          progressLogId: nullableString,
          kind: { type: "string", enum: ["file", "url", "image", "log", "commit"] },
          label: { type: "string", maxLength: 240 },
          uri: { type: "string", maxLength: 2000 },
          contentType: nullableString,
          clientRequestId: { type: "string", maxLength: 80 },
        },
        required: ["label", "uri"],
        additionalProperties: false,
      },
      EvidenceCreateResult: {
        type: "object",
        properties: { evidence: ref("Evidence"), deduplicated: { type: "boolean" } },
        required: ["evidence", "deduplicated"],
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Joy API key",
        description: "Private API key stored as the Cloudflare secret JOY_GPT_ACTION_KEY.",
      },
    },
  },
};
