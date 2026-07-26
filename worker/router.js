import app from "./index.js";
import { handleProjectHubRequest, isProjectHubRoute } from "./project-hub.js";
import {
  guardGoogleIntegration,
  handleGoogleAuthRequest,
  hasEnabledGmailIntegration,
  integrationForApiPath,
  isGoogleAuthRoute,
  protectJoyAsset,
} from "./google-auth.js";
import {
  handlePushRequest,
  isPushRoute,
  runRainPushSchedule,
} from "./push.js";
import {
  handleTaskDeleteRequest,
  isTaskDeleteRoute,
} from "./task-delete.js";
import {
  handleTaskImportRequest,
  isTaskImportRoute,
} from "./task-sync.js";
import {
  handleTaskReminderRequest,
  isTaskReminderRoute,
  runTaskReminderSchedule,
} from "./task-reminders.js";

const PROTECTED_ASSETS = new Set(["/", "/index.html", "/sale-manager.html"]);

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;

    try {
      if (isPushRoute(pathname)) {
        return handlePushRequest(request, env);
      }
      if (isTaskReminderRoute(pathname)) {
        return handleTaskReminderRequest(request, env);
      }
      if (isGoogleAuthRoute(pathname)) {
        return handleGoogleAuthRequest(request, env);
      }
      if (PROTECTED_ASSETS.has(pathname) && request.method === "GET") {
        return protectJoyAsset(request, env);
      }
      if (isProjectHubRoute(pathname)) {
        return handleProjectHubRequest(request, env);
      }
      if (isTaskDeleteRoute(pathname)) {
        return handleTaskDeleteRequest(request, env);
      }
      if (isTaskImportRoute(pathname)) {
        return handleTaskImportRequest(request, env);
      }

      const integration = integrationForApiPath(pathname);
      if (integration) {
        const denied = await guardGoogleIntegration(request, env, integration);
        if (denied) return denied;
      }

      return app.fetch(request, env, ctx);
    } catch (error) {
      console.error("Joy router failed", error);
      if (pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "JOY_AUTH_FAILED" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      return new Response("Joy could not open this page. Please try again.", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  },

  async scheduled(controller, env, ctx) {
    if (
      typeof app.scheduled === "function"
      && await hasEnabledGmailIntegration(env)
    ) {
      await app.scheduled(controller, env, ctx);
    }
    ctx.waitUntil(runRainPushSchedule(env));
    ctx.waitUntil(runTaskReminderSchedule(env));
  },
};
