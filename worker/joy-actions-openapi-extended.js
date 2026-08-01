import { JOY_ACTIONS_OPENAPI as BASE_OPENAPI } from "./joy-actions-openapi.js";
import {
  IELTS_ACTION_PATHS,
  IELTS_ACTION_SCHEMAS,
} from "./ielts-actions-openapi.js";
import {
  IELTS_LISTENING_ACTION_PATHS,
  IELTS_LISTENING_ACTION_SCHEMAS,
} from "./ielts-listening-openapi.js";
import {
  PROJECT_MEMORY_ACTION_PATHS,
  PROJECT_MEMORY_ACTION_SCHEMAS,
} from "./project-memory-openapi.js";
import {
  JOY_DEV_ACTION_PATHS,
  JOY_DEV_ACTION_SCHEMAS,
} from "./joy-dev-openapi.js";

const START_TASK_PATH = "/api/joy/v1/ielts/tasks/{taskId}/start";
const {
  requestBody: _emptyRequestBody,
  ...startTaskOperation
} = IELTS_ACTION_PATHS[START_TASK_PATH].post;

const GPT_IELTS_ACTION_PATHS = {
  ...IELTS_ACTION_PATHS,
  [START_TASK_PATH]: {
    ...IELTS_ACTION_PATHS[START_TASK_PATH],
    post: startTaskOperation,
  },
};

export const JOY_ACTIONS_OPENAPI = Object.freeze({
  ...BASE_OPENAPI,
  info: {
    ...BASE_OPENAPI.info,
    version: "1.4.0",
    description: `${BASE_OPENAPI.info.description} It also exposes shared project memory, safe branch-based repository development, IELTS teaching context, learning-record updates, and private Listening transcription.`,
  },
  paths: {
    ...BASE_OPENAPI.paths,
    ...PROJECT_MEMORY_ACTION_PATHS,
    ...JOY_DEV_ACTION_PATHS,
    ...GPT_IELTS_ACTION_PATHS,
    ...IELTS_LISTENING_ACTION_PATHS,
  },
  components: {
    ...BASE_OPENAPI.components,
    schemas: {
      ...BASE_OPENAPI.components.schemas,
      ...PROJECT_MEMORY_ACTION_SCHEMAS,
      ...JOY_DEV_ACTION_SCHEMAS,
      ...IELTS_ACTION_SCHEMAS,
      ...IELTS_LISTENING_ACTION_SCHEMAS,
    },
  },
});

const COMMON_PROJECT_PATHS = new Set([
  "/api/joy/v1/projects/{projectId}",
  "/api/joy/v1/projects/{projectId}/tasks",
  "/api/joy/v1/tasks/{taskId}",
  "/api/joy/v1/projects/{projectId}/milestones",
  "/api/joy/v1/milestones/{milestoneId}",
  "/api/joy/v1/projects/{projectId}/logs",
  "/api/joy/v1/projects/{projectId}/evidence",
]);

const STRING_ARRAY = {
  type: "array",
  items: { type: "string" },
};

const IELTS_ASSISTANT_PROFILE_SCHEMA = {
  type: "object",
  properties: {
    profileVersion: { type: "string" },
    profileId: { type: "string", enum: ["ielts"] },
    actorId: { type: "string", enum: ["gpt-ielts"] },
    fixedProjectId: { type: "string", enum: ["ielts"] },
    identity: { type: "string" },
    roles: STRING_ARRAY,
    startupSequence: STRING_ARRAY,
    teachingContract: {
      type: "object",
      properties: {
        goal: { type: "string" },
        skills: STRING_ARRAY,
        rules: STRING_ARRAY,
      },
      required: ["goal", "skills", "rules"],
      additionalProperties: false,
    },
    developmentContract: {
      type: "object",
      properties: {
        repository: { type: "string" },
        branchPrefix: { type: "string" },
        preferredCheckSuite: { type: "string" },
        rules: STRING_ARRAY,
      },
      required: ["repository", "branchPrefix", "preferredCheckSuite", "rules"],
      additionalProperties: false,
    },
    sessionContract: {
      type: "object",
      properties: {
        meaningfulEvents: STRING_ARRAY,
        finishRules: STRING_ARRAY,
      },
      required: ["meaningfulEvents", "finishRules"],
      additionalProperties: false,
    },
  },
  required: [
    "profileVersion",
    "profileId",
    "actorId",
    "fixedProjectId",
    "identity",
    "roles",
    "startupSequence",
    "teachingContract",
    "developmentContract",
    "sessionContract",
  ],
  additionalProperties: false,
};

function selectPaths({ includeIelts = false, includeCommonProjectPaths = true } = {}) {
  return Object.fromEntries(Object.entries(JOY_ACTIONS_OPENAPI.paths).filter(([path]) => {
    if (includeCommonProjectPaths && COMMON_PROJECT_PATHS.has(path)) return true;
    if (path.startsWith("/api/joy/v1/workspaces/")) return true;
    if (path.startsWith("/api/joy/v1/work-sessions/")) return true;
    if (path.startsWith("/api/joy/v1/dev/")) return true;
    return includeIelts && path.startsWith("/api/joy/v1/ielts/");
  }));
}

function builderSafeSchema(value) {
  if (Array.isArray(value)) return value.map(builderSafeSchema);
  if (!value || typeof value !== "object") return value;

  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, builderSafeSchema(child)]),
  );

  if (normalized.type === "object" && !Object.hasOwn(normalized, "properties")) {
    normalized.properties = {};
  }
  return normalized;
}

function schemaComponents(includeAssistantProfile) {
  if (!includeAssistantProfile) return JOY_ACTIONS_OPENAPI.components;
  const workspace = JOY_ACTIONS_OPENAPI.components.schemas.WorkspaceBootstrapResult;
  return {
    ...JOY_ACTIONS_OPENAPI.components,
    schemas: {
      ...JOY_ACTIONS_OPENAPI.components.schemas,
      JoySpecializedAssistantProfile: IELTS_ASSISTANT_PROFILE_SCHEMA,
      WorkspaceBootstrapResult: {
        ...workspace,
        properties: {
          ...workspace.properties,
          assistantProfile: { $ref: "#/components/schemas/JoySpecializedAssistantProfile" },
        },
        required: [...new Set([...(workspace.required || []), "assistantProfile"])],
      },
    },
  };
}

function specializedSchema({
  title,
  description,
  includeIelts,
  includeCommonProjectPaths,
  includeAssistantProfile = false,
}) {
  return Object.freeze(builderSafeSchema({
    ...JOY_ACTIONS_OPENAPI,
    info: {
      ...JOY_ACTIONS_OPENAPI.info,
      title,
      version: "1.6.0",
      description,
    },
    paths: selectPaths({ includeIelts, includeCommonProjectPaths }),
    components: schemaComponents(includeAssistantProfile),
  }));
}

export const JOY_IELTS_ACTIONS_OPENAPI = specializedSchema({
  title: "Joy IELTS Coach and Developer Actions",
  description: "Private Actions for the owner's IELTS teacher-developer GPT. The server locks this credential to the IELTS project while permitting safe branch-based repository work.",
  includeIelts: true,
  includeCommonProjectPaths: false,
  includeAssistantProfile: true,
});

export const JOY_TURTLEBOT4_ACTIONS_OPENAPI = specializedSchema({
  title: "Joy TurtleBot4 Engineer and Developer Actions",
  description: "Private Actions for the owner's TurtleBot4 engineer-developer GPT. The server locks this credential to the TurtleBot4 project while permitting safe branch-based repository work.",
  includeIelts: false,
  includeCommonProjectPaths: true,
});
