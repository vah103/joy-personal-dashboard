const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const errorResponse = {
  description: "The request could not be completed.",
  content: { "application/json": { schema: ref("Error") } },
};

const success = (schema, description = "Success") => ({
  description,
  content: { "application/json": { schema } },
});

const writeResponses = (schema) => ({
  200: success(schema),
  201: success(schema),
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  413: errorResponse,
  503: errorResponse,
});

const projectIdParameter = {
  name: "projectId",
  in: "path",
  required: true,
  schema: { type: "string", maxLength: 80 },
  description: "Stable Joy project ID, such as ielts or turtlebot4.",
};

const sessionIdParameter = {
  name: "sessionId",
  in: "path",
  required: true,
  schema: { type: "string", maxLength: 80 },
  description: "Work-session ID returned by startJoyWorkSession.",
};

const nullableString = {
  anyOf: [{ type: "string" }, { type: "null" }],
};

const metadataSchema = {
  type: "object",
  additionalProperties: true,
};

export const PROJECT_MEMORY_ACTION_PATHS = {
  "/api/joy/v1/workspaces/{projectId}": {
    get: {
      operationId: "bootstrapJoyWorkspace",
      summary: "Load the complete current workspace for one Joy project",
      description: "Call at the start of project work. Returns live Joy project data, the latest snapshot, active session, recent sessions and events, decisions, open blockers, evidence, repo references, and continuation guidance.",
      parameters: [
        projectIdParameter,
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 20 },
        },
      ],
      responses: {
        200: success(ref("WorkspaceBootstrapResult")),
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        503: errorResponse,
      },
    },
  },
  "/api/joy/v1/workspaces/{projectId}/sessions": {
    post: {
      operationId: "startJoyWorkSession",
      summary: "Start or resume a project work session",
      description: "Start before teaching, coding, testing, or lab work. Reuses an existing open session by default and stores the goal in the shared project snapshot. Use a stable clientRequestId for retries.",
      parameters: [projectIdParameter],
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("WorkSessionStartInput") } },
      },
      responses: writeResponses(ref("WorkSessionStartResult")),
    },
  },
  "/api/joy/v1/work-sessions/{sessionId}/events": {
    post: {
      operationId: "appendJoyWorkSessionEvent",
      summary: "Record meaningful work completed during a project session",
      description: "Record decisions, commands, code changes, tests, results, blockers, evidence, task changes, or repo references as work happens. Typed records are created for decision, blocker, evidence, and repo_ref events.",
      parameters: [sessionIdParameter],
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("WorkSessionEventInput") } },
      },
      responses: writeResponses(ref("WorkSessionEventResult")),
    },
  },
  "/api/joy/v1/work-sessions/{sessionId}/finish": {
    post: {
      operationId: "finishJoyWorkSession",
      summary: "Finish a work session and prepare the next continuation",
      description: "Call at the end of project work. Closes the session, updates the project snapshot and Joy project focus, records a progress result, preserves open blockers, and stores next actions for the next GPT conversation.",
      parameters: [sessionIdParameter],
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("WorkSessionFinishInput") } },
      },
      responses: writeResponses(ref("WorkSessionFinishResult")),
    },
  },
};

export const PROJECT_MEMORY_ACTION_SCHEMAS = {
  ProjectSnapshot: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      summary: { type: "string" },
      currentGoal: { type: "string" },
      currentState: metadataSchema,
      nextActions: { type: "array", items: { type: "string" } },
      latestSessionId: nullableString,
      version: { type: "integer" },
      createdAt: { type: "integer" },
      updatedAt: { type: "integer" },
    },
    required: ["projectId", "summary", "currentGoal", "nextActions", "version"],
    additionalProperties: false,
  },
  WorkSession: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      title: { type: "string" },
      goal: { type: "string" },
      status: { type: "string", enum: ["open", "completed", "cancelled"] },
      summary: { type: "string" },
      outcomes: { type: "array", items: { type: "string" } },
      nextActions: { type: "array", items: { type: "string" } },
      metadata: metadataSchema,
      actorType: { type: "string" },
      actorId: { type: "string" },
      clientRequestId: nullableString,
      version: { type: "integer" },
      startedAt: { type: "integer" },
      endedAt: { anyOf: [{ type: "integer" }, { type: "null" }] },
      createdAt: { type: "integer" },
      updatedAt: { type: "integer" },
    },
    required: ["id", "projectId", "title", "goal", "status", "version", "startedAt"],
    additionalProperties: false,
  },
  WorkSessionEvent: {
    type: "object",
    properties: {
      id: { type: "string" },
      sessionId: { type: "string" },
      projectId: { type: "string" },
      kind: {
        type: "string",
        enum: [
          "note",
          "decision",
          "command",
          "result",
          "blocker",
          "evidence",
          "repo_ref",
          "task_update",
          "plan_update",
          "code_change",
          "test",
          "other",
        ],
      },
      title: { type: "string" },
      detail: { type: "string" },
      payload: metadataSchema,
      occurredAt: { type: "integer" },
      clientRequestId: nullableString,
      createdAt: { type: "integer" },
    },
    required: ["id", "sessionId", "projectId", "kind", "title", "occurredAt"],
    additionalProperties: false,
  },
  ProjectDecision: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      sessionId: nullableString,
      title: { type: "string" },
      decision: { type: "string" },
      rationale: { type: "string" },
      status: { type: "string", enum: ["active", "superseded", "reversed"] },
      supersedesId: nullableString,
      occurredAt: { type: "integer" },
    },
    required: ["id", "projectId", "title", "decision", "status"],
    additionalProperties: false,
  },
  ProjectBlocker: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      sessionId: nullableString,
      title: { type: "string" },
      detail: { type: "string" },
      status: { type: "string", enum: ["open", "resolved"] },
      resolution: { type: "string" },
      openedAt: { type: "integer" },
      resolvedAt: { anyOf: [{ type: "integer" }, { type: "null" }] },
    },
    required: ["id", "projectId", "title", "status"],
    additionalProperties: false,
  },
  ProjectMemoryEvidence: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      sessionId: nullableString,
      label: { type: "string" },
      kind: {
        type: "string",
        enum: ["file", "url", "image", "log", "commit", "test", "metric", "note"],
      },
      uri: nullableString,
      detail: { type: "string" },
      metadata: metadataSchema,
      createdAt: { type: "integer" },
    },
    required: ["id", "projectId", "label", "kind"],
    additionalProperties: false,
  },
  ProjectRepoRef: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      sessionId: nullableString,
      repoFullName: { type: "string" },
      refType: {
        type: "string",
        enum: ["branch", "commit", "pull_request", "issue", "workflow", "file", "tag"],
      },
      ref: { type: "string" },
      uri: nullableString,
      status: { type: "string", enum: ["active", "merged", "closed", "failed", "superseded"] },
      metadata: metadataSchema,
      createdAt: { type: "integer" },
      updatedAt: { type: "integer" },
    },
    required: ["id", "projectId", "repoFullName", "refType", "ref", "status"],
    additionalProperties: false,
  },
  WorkspaceBootstrapResult: {
    type: "object",
    properties: {
      project: { type: "object", additionalProperties: true },
      memory: {
        type: "object",
        properties: {
          snapshot: { anyOf: [ref("ProjectSnapshot"), { type: "null" }] },
          activeSession: { anyOf: [ref("WorkSession"), { type: "null" }] },
          activeEvents: { type: "array", items: ref("WorkSessionEvent") },
          recentSessions: { type: "array", items: ref("WorkSession") },
          recentEvents: { type: "array", items: ref("WorkSessionEvent") },
          decisions: { type: "array", items: ref("ProjectDecision") },
          openBlockers: { type: "array", items: ref("ProjectBlocker") },
          evidence: { type: "array", items: ref("ProjectMemoryEvidence") },
          repoRefs: { type: "array", items: ref("ProjectRepoRef") },
        },
        required: [
          "activeEvents",
          "recentSessions",
          "recentEvents",
          "decisions",
          "openBlockers",
          "evidence",
          "repoRefs",
        ],
        additionalProperties: false,
      },
      continuation: {
        type: "object",
        properties: {
          status: { type: "string" },
          currentGoal: { type: "string" },
          nextActions: { type: "array", items: { type: "string" } },
          blockers: { type: "array", items: { type: "string" } },
          latestSummary: { type: "string" },
        },
        required: ["status", "currentGoal", "nextActions", "blockers", "latestSummary"],
        additionalProperties: false,
      },
      generatedAt: { type: "integer" },
    },
    required: ["project", "memory", "continuation", "generatedAt"],
    additionalProperties: false,
  },
  WorkSessionStartInput: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1, maxLength: 240 },
      goal: { type: "string", minLength: 1, maxLength: 4000 },
      resumeExisting: { type: "boolean" },
      metadata: metadataSchema,
      clientRequestId: { type: "string", minLength: 1, maxLength: 80 },
    },
    required: ["title", "goal", "clientRequestId"],
    additionalProperties: false,
  },
  WorkSessionStartResult: {
    type: "object",
    properties: {
      session: ref("WorkSession"),
      snapshot: { anyOf: [ref("ProjectSnapshot"), { type: "null" }] },
      deduplicated: { type: "boolean" },
      resumed: { type: "boolean" },
    },
    required: ["session", "deduplicated", "resumed"],
    additionalProperties: false,
  },
  DecisionInput: {
    type: "object",
    properties: {
      id: { type: "string", maxLength: 80 },
      title: { type: "string", maxLength: 240 },
      decision: { type: "string", maxLength: 20000 },
      rationale: { type: "string", maxLength: 20000 },
      status: { type: "string", enum: ["active", "superseded", "reversed"] },
      supersedesId: { type: "string", maxLength: 80 },
    },
    additionalProperties: false,
  },
  BlockerInput: {
    type: "object",
    properties: {
      id: { type: "string", maxLength: 80 },
      title: { type: "string", maxLength: 240 },
      detail: { type: "string", maxLength: 20000 },
      status: { type: "string", enum: ["open", "resolved"] },
      resolution: { type: "string", maxLength: 20000 },
    },
    additionalProperties: false,
  },
  MemoryEvidenceInput: {
    type: "object",
    properties: {
      id: { type: "string", maxLength: 80 },
      label: { type: "string", maxLength: 240 },
      kind: {
        type: "string",
        enum: ["file", "url", "image", "log", "commit", "test", "metric", "note"],
      },
      uri: { type: "string", maxLength: 2000 },
      detail: { type: "string", maxLength: 20000 },
      metadata: metadataSchema,
    },
    additionalProperties: false,
  },
  RepoRefInput: {
    type: "object",
    properties: {
      id: { type: "string", maxLength: 80 },
      repoFullName: { type: "string", minLength: 1, maxLength: 240 },
      refType: {
        type: "string",
        enum: ["branch", "commit", "pull_request", "issue", "workflow", "file", "tag"],
      },
      ref: { type: "string", minLength: 1, maxLength: 1000 },
      uri: { type: "string", maxLength: 2000 },
      status: { type: "string", enum: ["active", "merged", "closed", "failed", "superseded"] },
      metadata: metadataSchema,
    },
    required: ["repoFullName", "refType", "ref"],
    additionalProperties: false,
  },
  WorkSessionEventInput: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: [
          "note",
          "decision",
          "command",
          "result",
          "blocker",
          "evidence",
          "repo_ref",
          "task_update",
          "plan_update",
          "code_change",
          "test",
          "other",
        ],
      },
      title: { type: "string", minLength: 1, maxLength: 240 },
      detail: { type: "string", maxLength: 20000 },
      payload: metadataSchema,
      occurredAt: { type: "integer" },
      decision: ref("DecisionInput"),
      blocker: ref("BlockerInput"),
      evidence: ref("MemoryEvidenceInput"),
      repoRef: ref("RepoRefInput"),
      clientRequestId: { type: "string", minLength: 1, maxLength: 80 },
    },
    required: ["kind", "title", "clientRequestId"],
    additionalProperties: false,
  },
  WorkSessionEventResult: {
    type: "object",
    properties: {
      event: ref("WorkSessionEvent"),
      typedMemory: {
        type: "object",
        properties: {
          decision: ref("ProjectDecision"),
          blocker: ref("ProjectBlocker"),
          evidence: ref("ProjectMemoryEvidence"),
          repoRef: ref("ProjectRepoRef"),
        },
        additionalProperties: false,
      },
      snapshot: { anyOf: [ref("ProjectSnapshot"), { type: "null" }] },
      deduplicated: { type: "boolean" },
    },
    required: ["event", "typedMemory", "deduplicated"],
    additionalProperties: false,
  },
  WorkSessionFinishInput: {
    type: "object",
    properties: {
      summary: { type: "string", minLength: 1, maxLength: 20000 },
      outcomes: { type: "array", maxItems: 50, items: { type: "string", maxLength: 4000 } },
      nextActions: { type: "array", maxItems: 30, items: { type: "string", maxLength: 2000 } },
      currentState: metadataSchema,
      projectUpdate: ref("ProjectUpdateInput"),
      logTitle: { type: "string", maxLength: 240 },
      metadata: metadataSchema,
      clientRequestId: { type: "string", minLength: 1, maxLength: 80 },
    },
    required: ["summary", "clientRequestId"],
    additionalProperties: false,
  },
  WorkSessionFinishResult: {
    type: "object",
    properties: {
      session: ref("WorkSession"),
      snapshot: { anyOf: [ref("ProjectSnapshot"), { type: "null" }] },
      project: { type: "object", additionalProperties: true },
      progressLog: { type: "object", additionalProperties: true },
      openBlockers: { type: "array", items: ref("ProjectBlocker") },
      deduplicated: { type: "boolean" },
    },
    required: ["session", "snapshot", "deduplicated"],
    additionalProperties: false,
  },
};
