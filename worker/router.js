import app from "./index.js";
import {
  handleDailyBriefRequest,
  isDailyBriefRoute,
  runDailyBriefSchedule,
} from "./daily-brief-policy.js";
import {
  handleFinanceLedgerRequest,
  isFinanceLedgerRoute,
} from "./finance-with-seed.js";
import {
  handleIeltsDiagnosticReviewRequest,
  isIeltsDiagnosticReviewRoute,
} from "./ielts-diagnostic-review.js";
import {
  handleIeltsCoreRequest,
  isIeltsCoreRoute,
  runIeltsSchedule,
} from "./ielts-core.js";
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
  handlePushSubscriptionCleanup,
  isPushSubscriptionCleanupRoute,
} from "./push-subscription-cleanup.js";
import {
  handleReliableReminderRequest,
  isReliableReminderRoute,
  runReliableReminderSchedule,
} from "./reminder-delivery.js";
import {
  handleSaleViewingCreate,
  isSaleViewingCreateRoute,
} from "./sale-viewing-create.js";
import {
  handleTaskDeleteRequest,
  isTaskDeleteRoute,
} from "./task-delete.js";
import {
  handleTaskEnglishRequest,
  isTaskEnglishRoute,
} from "./task-english.js";
import {
  handleTaskImportRequest,
  isTaskImportRoute,
} from "./task-sync.js";
import {
  handleTaskReminderRequest,
  isTaskReminderRoute,
} from "./task-reminders.js";
import {
  handleVocabularyRequest,
  isVocabularyRoute,
} from "./vocabulary.js";

const PROTECTED_ASSETS = new Set(["/", "/index.html", "/sale-manager.html"]);

function scheduleIndependentJob(ctx, label, job) {
  ctx.waitUntil(
    Promise.resolve()
      .then(job)
      .catch((error) => {
        console.error(`Joy ${label} scheduled job failed`, error);
      }),
  );
}

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;

    try {
      if (isDailyBriefRoute(pathname)) {
        return handleDailyBriefRequest(request, env, ctx);
      }
      if (isFinanceLedgerRoute(pathname)) {
        return handleFinanceLedgerRequest(request, env);
      }
      if (isPushSubscriptionCleanupRoute(pathname)) {
        return handlePushSubscriptionCleanup(request, env);
      }
      if (isReliableReminderRoute(pathname)) {
        return handleReliableReminderRequest(request, env);
      }
      if (isPushRoute(pathname)) {
        return handlePushRequest(request, env);
      }
      if (isTaskReminderRoute(pathname)) {
        return handleTaskReminderRequest(request, env);
      }
      if (isTaskEnglishRoute(pathname)) {
        return handleTaskEnglishRequest(request, env);
      }
      if (isVocabularyRoute(pathname)) {
        return handleVocabularyRequest(request, env);
      }
      if (isIeltsDiagnosticReviewRoute(pathname)) {
        return handleIeltsDiagnosticReviewRequest(request, env);
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
      if (isIeltsCoreRoute(pathname)) {
        return handleIeltsCoreRequest(request, env);
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

      if (isSaleViewingCreateRoute(pathname, request.method)) {
        return handleSaleViewingCreate(request, env);
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

  scheduled(controller, env, ctx) {
    scheduleIndependentJob(ctx, "Gmail", async () => {
      if (
        typeof app.scheduled === "function"
        && await hasEnabledGmailIntegration(env)
      ) {
        await app.scheduled(controller, env, ctx);
      }
    });

    scheduleIndependentJob(ctx, "weather", () => runRainPushSchedule(env));
    scheduleIndependentJob(ctx, "reminder", () => runReliableReminderSchedule(env));
    scheduleIndependentJob(ctx, "Daily Brief", () => runDailyBriefSchedule(env));
    scheduleIndependentJob(ctx, "IELTS", () => runIeltsSchedule(env));
  },
};
