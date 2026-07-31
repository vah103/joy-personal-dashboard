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
  201: success(schema, "Created or updated idempotently"),
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  413: errorResponse,
  503: errorResponse,
});

const taskIdParameter = {
  name: "taskId",
  in: "path",
  required: true,
  schema: { type: "string", maxLength: 160 },
  description: "Exact IELTS Journey task id returned by getIeltsToday or getIeltsTeachingTask.",
};

const rhythmIdParameter = {
  name: "rhythmId",
  in: "path",
  required: true,
  schema: { type: "string", maxLength: 160 },
  description: "Exact IELTS rhythm id returned by getIeltsToday.",
};

const dateParameter = {
  name: "date",
  in: "query",
  required: false,
  schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  description: "Optional Vietnam calendar date for diagnostics. Omit during normal teaching.",
};

const clientRequestId = {
  type: "string",
  maxLength: 80,
  description: "Stable idempotency key. Reuse it only when retrying the same write.",
};

const nullableScore = {
  anyOf: [
    { type: "number", minimum: 0, maximum: 9, multipleOf: 0.5 },
    { type: "null" },
  ],
};

export const IELTS_ACTION_PATHS = {
  "/api/joy/v1/ielts/today": {
    get: {
      operationId: "getIeltsToday",
      summary: "Get the current IELTS teaching context",
      description: "Call this before planning or teaching IELTS. It returns the exact current baseline or rhythm, task details, completion states, next task, recent assessments, recurring errors, and recent external-course knowledge from the same IELTS Journey used by the web app.",
      parameters: [dateParameter],
      responses: {
        200: success(ref("IeltsTeachingContext")),
        401: errorResponse,
        403: errorResponse,
        503: errorResponse,
      },
    },
  },
  "/api/joy/v1/ielts/tasks/{taskId}": {
    get: {
      operationId: "getIeltsTeachingTask",
      summary: "Get one IELTS task for interactive teaching",
      description: "Read the exact objective, steps, official materials, output, completion criteria, current result, relevant recurring errors, and recent course knowledge before teaching this task.",
      parameters: [taskIdParameter, dateParameter],
      responses: {
        200: success(ref("IeltsTeachingTask")),
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        503: errorResponse,
      },
    },
  },
  "/api/joy/v1/ielts/tasks/{taskId}/start": {
    post: {
      operationId: "startIeltsTask",
      summary: "Mark an IELTS task as started",
      description: "Use only when the owner actually begins the task. This updates the same task state shown in IELTS Journey.",
      parameters: [taskIdParameter],
      requestBody: {
        required: false,
        content: { "application/json": { schema: { type: "object", additionalProperties: false } } },
      },
      responses: writeResponses(ref("IeltsTaskMutationResult")),
    },
  },
  "/api/joy/v1/ielts/tasks/{taskId}/complete": {
    post: {
      operationId: "completeIeltsTask",
      summary: "Complete an IELTS Journey task",
      description: "Use only after the owner confirms the work is finished. Record factual time, evidence/result, and reflection; never invent a score, completion, or evidence.",
      parameters: [taskIdParameter],
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("IeltsTaskCompletionInput") } },
      },
      responses: writeResponses(ref("IeltsTaskMutationResult")),
    },
  },
  "/api/joy/v1/ielts/assessments": {
    post: {
      operationId: "addIeltsAssessment",
      summary: "Save an IELTS assessment",
      description: "Save criterion-based or test-based evidence after real work. At least one skill score is required. State uncertainty in evidence instead of presenting an estimated score as official.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("IeltsAssessmentInput") } },
      },
      responses: writeResponses(ref("IeltsAssessmentResult")),
    },
  },
  "/api/joy/v1/ielts/errors": {
    post: {
      operationId: "addIeltsRecurringError",
      summary: "Save or reinforce a recurring IELTS error",
      description: "Record a repeated learner problem with its cause and one prevention action. Reusing clientRequestId makes retries safe.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("IeltsErrorInput") } },
      },
      responses: writeResponses(ref("IeltsErrorResult")),
    },
  },
  "/api/joy/v1/ielts/course-sessions": {
    post: {
      operationId: "addIeltsCourseSession",
      summary: "Save external Writing course knowledge",
      description: "Store reviewed lesson knowledge separately as summary, method, teacher feedback, homework, and next practice so later teaching can use it.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("IeltsCourseSessionInput") } },
      },
      responses: writeResponses(ref("IeltsCourseSessionResult")),
    },
  },
  "/api/joy/v1/ielts/rhythms/{rhythmId}/tasks": {
    put: {
      operationId: "replaceIeltsRhythmTasks",
      summary: "Personalise one IELTS rhythm",
      description: "Replace generated self-study tasks only for the current or next allowed rhythm, normally after reviewing baseline or assessment evidence. External-course tasks remain intact. The total personalised workload cannot exceed six hours.",
      parameters: [rhythmIdParameter],
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("IeltsRhythmTasksInput") } },
      },
      responses: writeResponses(ref("IeltsRhythmTasksResult")),
    },
  },
};

export const IELTS_ACTION_SCHEMAS = {
  IeltsTeachingContext: {
    type: "object",
    properties: {
      planId: { type: "string" },
      date: { type: "string" },
      timezone: { type: "string" },
      goal: { type: "object", additionalProperties: true },
      current: { type: "object", additionalProperties: true },
      nextTask: { type: "object", nullable: true, additionalProperties: true },
      latestAssessment: { type: "object", nullable: true, additionalProperties: true },
      activeErrors: { type: "array", items: { type: "object", additionalProperties: true } },
      recentCourseSessions: { type: "array", items: { type: "object", additionalProperties: true } },
      stateVersion: { type: "integer" },
      updatedAt: { type: "integer" },
    },
    required: ["planId", "date", "current", "activeErrors", "recentCourseSessions", "stateVersion"],
  },
  IeltsTeachingTask: {
    type: "object",
    properties: {
      planId: { type: "string" },
      date: { type: "string" },
      task: { type: "object", additionalProperties: true },
      relevantErrors: { type: "array", items: { type: "object", additionalProperties: true } },
      recentCourseSessions: { type: "array", items: { type: "object", additionalProperties: true } },
      stateVersion: { type: "integer" },
    },
    required: ["planId", "date", "task", "relevantErrors", "recentCourseSessions", "stateVersion"],
  },
  IeltsTaskCompletionInput: {
    type: "object",
    properties: {
      minutes: { type: "number", minimum: 1, maximum: 480 },
      evidence: { type: "string", minLength: 1, maxLength: 20000 },
      reflection: { type: "string", minLength: 1, maxLength: 20000 },
    },
    required: ["minutes", "evidence", "reflection"],
    additionalProperties: false,
  },
  IeltsTaskMutationResult: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      taskId: { type: "string" },
      state: { type: "object", additionalProperties: true },
      stateVersion: { type: "integer" },
    },
    required: ["ok", "taskId", "state", "stateVersion"],
  },
  IeltsAssessmentInput: {
    type: "object",
    properties: {
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      label: { type: "string", maxLength: 240 },
      scores: {
        type: "object",
        properties: {
          listening: nullableScore,
          reading: nullableScore,
          writing: nullableScore,
          speaking: nullableScore,
        },
        additionalProperties: false,
      },
      evidence: { type: "string", minLength: 1, maxLength: 20000 },
      clientRequestId,
    },
    required: ["date", "scores", "evidence", "clientRequestId"],
    additionalProperties: false,
  },
  IeltsAssessmentResult: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      assessment: { type: "object", additionalProperties: true },
      stateVersion: { type: "integer" },
    },
    required: ["ok", "assessment", "stateVersion"],
  },
  IeltsErrorInput: {
    type: "object",
    properties: {
      skill: { type: "string", enum: ["listening", "reading", "writing", "speaking", "review"] },
      label: { type: "string", minLength: 1, maxLength: 240 },
      cause: { type: "string", minLength: 1, maxLength: 4000 },
      action: { type: "string", minLength: 1, maxLength: 4000 },
      clientRequestId,
    },
    required: ["skill", "label", "cause", "action", "clientRequestId"],
    additionalProperties: false,
  },
  IeltsErrorResult: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      error: { type: "object", additionalProperties: true },
      stateVersion: { type: "integer" },
    },
    required: ["ok", "error", "stateVersion"],
  },
  IeltsCourseSessionInput: {
    type: "object",
    properties: {
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      title: { type: "string", minLength: 1, maxLength: 240 },
      taskType: { type: "string", maxLength: 120 },
      status: { type: "string", enum: ["waiting", "reviewed", "applied"] },
      recording: { type: "string", maxLength: 4000 },
      summary: { type: "string", minLength: 1, maxLength: 20000 },
      method: { type: "string", maxLength: 20000 },
      feedback: { type: "string", maxLength: 20000 },
      homework: { type: "string", maxLength: 20000 },
      nextPractice: { type: "string", maxLength: 20000 },
      clientRequestId,
    },
    required: ["date", "title", "summary", "clientRequestId"],
    additionalProperties: false,
  },
  IeltsCourseSessionResult: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      session: { type: "object", additionalProperties: true },
      stateVersion: { type: "integer" },
    },
    required: ["ok", "session", "stateVersion"],
  },
  IeltsGuidedTaskInput: {
    type: "object",
    properties: {
      id: { type: "string", maxLength: 160 },
      kind: { type: "string", enum: ["guided", "test", "review"] },
      skill: { type: "string", enum: ["listening", "reading", "writing", "speaking", "review"] },
      title: { type: "string", minLength: 1, maxLength: 240 },
      minutes: { type: "number", minimum: 5, maximum: 360 },
      objective: { type: "string", minLength: 1, maxLength: 4000 },
      steps: { type: "array", maxItems: 12, items: { type: "string", minLength: 1, maxLength: 1000 } },
      material: { type: "string", maxLength: 4000 },
      output: { type: "string", minLength: 1, maxLength: 4000 },
      doneWhen: { type: "array", maxItems: 8, items: { type: "string", minLength: 1, maxLength: 1000 } },
    },
    required: ["kind", "skill", "title", "minutes", "objective", "steps", "output", "doneWhen"],
    additionalProperties: false,
  },
  IeltsRhythmTasksInput: {
    type: "object",
    properties: {
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      tasks: { type: "array", minItems: 1, maxItems: 12, items: ref("IeltsGuidedTaskInput") },
      clientRequestId,
    },
    required: ["tasks", "clientRequestId"],
    additionalProperties: false,
  },
  IeltsRhythmTasksResult: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      rhythmId: { type: "string" },
      tasks: { type: "array", items: { type: "object", additionalProperties: true } },
      stateVersion: { type: "integer" },
    },
    required: ["ok", "rhythmId", "tasks", "stateVersion"],
  },
};
