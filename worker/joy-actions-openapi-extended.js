import { JOY_ACTIONS_OPENAPI as BASE_OPENAPI } from "./joy-actions-openapi.js";
import {
  IELTS_ACTION_PATHS,
  IELTS_ACTION_SCHEMAS,
} from "./ielts-actions-openapi.js";

export const JOY_ACTIONS_OPENAPI = Object.freeze({
  ...BASE_OPENAPI,
  info: {
    ...BASE_OPENAPI.info,
    version: "1.1.0",
    description: `${BASE_OPENAPI.info.description} It also exposes the owner's IELTS Journey teaching context and safe learning-record updates.`,
  },
  paths: {
    ...BASE_OPENAPI.paths,
    ...IELTS_ACTION_PATHS,
  },
  components: {
    ...BASE_OPENAPI.components,
    schemas: {
      ...BASE_OPENAPI.components.schemas,
      ...IELTS_ACTION_SCHEMAS,
    },
  },
});
