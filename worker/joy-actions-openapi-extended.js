import { JOY_ACTIONS_OPENAPI as BASE_OPENAPI } from "./joy-actions-openapi.js";
import {
  IELTS_ACTION_PATHS,
  IELTS_ACTION_SCHEMAS,
} from "./ielts-actions-openapi.js";
import {
  IELTS_LISTENING_ACTION_PATHS,
  IELTS_LISTENING_ACTION_SCHEMAS,
} from "./ielts-listening-openapi.js";

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
    version: "1.2.0",
    description: `${BASE_OPENAPI.info.description} It also exposes the owner's IELTS Journey teaching context, safe learning-record updates, and a private Listening file-transcription workflow for audio and answer screenshots attached in GPT Joy.`,
  },
  paths: {
    ...BASE_OPENAPI.paths,
    ...GPT_IELTS_ACTION_PATHS,
    ...IELTS_LISTENING_ACTION_PATHS,
  },
  components: {
    ...BASE_OPENAPI.components,
    schemas: {
      ...BASE_OPENAPI.components.schemas,
      ...IELTS_ACTION_SCHEMAS,
      ...IELTS_LISTENING_ACTION_SCHEMAS,
    },
  },
});
