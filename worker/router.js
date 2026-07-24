import app from "./index.js";
import { handleProjectHubRequest, isProjectHubRoute } from "./project-hub.js";

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (isProjectHubRoute(pathname)) {
      return handleProjectHubRequest(request, env);
    }
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === "function") {
      return app.scheduled(controller, env, ctx);
    }
    return undefined;
  },
};
