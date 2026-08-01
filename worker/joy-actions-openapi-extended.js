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

function selectPaths({ includeIelts = false } = {}) {
  return Object.fromEntries(Object.entries(JOY_ACTIONS_OPENAPI.paths).filter(([path]) => {
    if (COMMON_PROJECT_PATHS.has(path)) return true;
    if (path.startsWith("/api/joy/v1/workspaces/")) return true;
    if (path.startsWith("/api/joy/v1/work-sessions/")) return true;
    if (path.startsWith("/api/joy/v1/dev/")) return true;
    return includeIelts && path.startsWith("/api/joy/v1/ielts/");
  }));
}

function specializedSchema({ title, description, includeIelts }) {
  return Object.freeze({
    ...JOY_ACTIONS_OPENAPI,
    info: {
      ...JOY_ACTIONS_OPENAPI.info,
      title,
      version: "1.5.0",
      description,
    },
    paths: selectPaths({ includeIelts }),
  });
}

export const JOY_IELTS_ACTIONS_OPENAPI = specializedSchema({
  title: "Joy IELTS Coach and Developer Actions",
  description: "Private Actions for the owner's IELTS teacher-developer GPT. The server locks this credential to the IELTS project while permitting safe branch-based repository work.",
  includeIelts: true,
});

export const JOY_TURTLEBOT4_ACTIONS_OPENAPI = specializedSchema({
  title: "Joy TurtleBot4 Engineer and Developer Actions",
  description: "Private Actions for the owner's TurtleBot4 engineer-developer GPT. The server locks this credential to the TurtleBot4 project while permitting safe branch-based repository work.",
  includeIelts: false,
});
