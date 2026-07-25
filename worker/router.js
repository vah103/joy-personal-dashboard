import app from "./index.js";
import { handleProjectHubRequest, isProjectHubRoute } from "./project-hub.js";
import {
  handlePushRequest,
  isPushRoute,
  runRainPushSchedule,
} from "./push.js";
import {
  handleTaskDeleteRequest,
  isTaskDeleteRoute,
} from "./task-delete.js";

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (isPushRoute(pathname)) {
      return handlePushRequest(request, env);
    }
    if (isProjectHubRoute(pathname)) {
      return handleProjectHubRequest(request, env);
    }
    if (isTaskDeleteRoute(pathname)) {
      return handleTaskDeleteRequest(request, env);
    }
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === "function") {
      await app.scheduled(controller, env, ctx);
    }
    ctx.waitUntil(runRainPushSchedule(env));
  },
};
