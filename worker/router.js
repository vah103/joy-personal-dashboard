import app from "./index.js";
import {
  handleDailyBriefRequest,
  isDailyBriefRoute,
  runDailyBriefSchedule,
} from "./daily-brief-budget.js";
import {
  handleDashboardDataRequest,
  isDashboardDataRoute,
} from "./dashboard-data.js";
import {
  handleFinanceGoldPriceRequest,
  isFinanceGoldPriceRoute,
} from "./finance-gold-price.js";
import {
  handleFinanceLedgerRequest,
  isFinanceLedgerRoute,
} from "./finance-ledger.js";
import {
  handleFinanceP1008Request,
  isFinanceP1008Route,
} from "./finance-p1008-sync.js";
import {
  handleFinanceP1008ShoppingRequest,
  isFinanceP1008ShoppingRoute,
} from "./finance-p1008-shopping.js";
import {
  handleGoogleDocsAuthRequest,
  isGoogleDocsAuthRoute,
} from "./google-docs-auth.js";
import {
  handleIeltsCourseSyncRequest,
  isIeltsCourseSyncRoute,
  runIeltsCourseSyncSchedule,
} from "./ielts-course-sync.js";
import {
  handleIeltsCoreRequest,
  isIeltsCoreRoute,
  runIeltsSchedule,
} from "./ielts-core.js";
import { handleJoyActionsRequest, isJoyActionsRoute } from "./joy-actions.js";
import { handleJoyCoreWebRequest, isJoyCoreWebRoute } from "./joy-core-web.js";
import { handleJoyMcpRequest, isJoyMcpRoute } from "./joy-mcp.js";
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
  handleSaleViewingRequest,
  isSaleViewingRoute,
  runSaleViewingSchedule,
} from "./sale-viewings.js";
import {
  handleSpeakingEnglishRequest,
  isSpeakingEnglishRoute,
} from "./speaking-english.js";
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
const DASHBOARD_HEADING_STYLESHEET = "dashboard-openai-headings.css?v=joy-openai-headings-v3";

function scheduleIndependentJob(ctx, label, job) {
  ctx.waitUntil(
    Promise.resolve()
      .then(job)
      .catch((error) => {
        console.error(`Joy ${label} scheduled job failed`, error);
      }),
  );
}

function noStoreResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.delete("Content-Length");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function withDashboardHeadingAssetVersion(response) {
  const contentType = response.headers.get("Content-Type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;

  const html = await response.text();
  const versionedHtml = html.replace(
    /dashboard-openai-headings\.css\?v=[^"'\s>]+/g,
    DASHBOARD_HEADING_STYLESHEET,
  );
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.delete("Content-Length");
  return new Response(versionedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;

    try {
      if (pathname === "/dashboard-openai-headings.css" && request.method === "GET") {
        return noStoreResponse(await env.ASSETS.fetch(request));
      }
      if (isJoyMcpRoute(pathname)) {
        return handleJoyMcpRequest(request, env);
      }
      if (isJoyActionsRoute(pathname)) {
        return handleJoyActionsRequest(request, env);
      }
      if (isJoyCoreWebRoute(pathname)) {
        return handleJoyCoreWebRequest(request, env);
      }
      if (isDailyBriefRoute(pathname)) {
        return handleDailyBriefRequest(request, env, ctx);
      }
      if (isDashboardDataRoute(pathname)) {
        return handleDashboardDataRequest(request, env);
      }
      if (isFinanceGoldPriceRoute(pathname)) {
        return handleFinanceGoldPriceRequest(request, env);
      }
      if (isFinanceP1008ShoppingRoute(pathname)) {
        return handleFinanceP1008ShoppingRequest(request, env);
      }
      if (isFinanceP1008Route(pathname)) {
        return handleFinanceP1008Request(request, env);
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
      if (isSpeakingEnglishRoute(pathname)) {
        return handleSpeakingEnglishRequest(request, env);
      }
      if (isVocabularyRoute(pathname)) {
        return handleVocabularyRequest(request, env);
      }
      if (isGoogleDocsAuthRoute(pathname, request)) {
        return handleGoogleDocsAuthRequest(request, env);
      }
      if (isGoogleAuthRoute(pathname)) {
        return handleGoogleAuthRequest(request, env);
      }
      if (PROTECTED_ASSETS.has(pathname) && request.method === "GET") {
        return withDashboardHeadingAssetVersion(await protectJoyAsset(request, env));
      }
      if (isProjectHubRoute(pathname)) {
        return handleProjectHubRequest(request, env);
      }
      if (isIeltsCourseSyncRoute(pathname)) {
        return handleIeltsCourseSyncRequest(request, env);
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
      if (isSaleViewingRoute(pathname)) {
        return handleSaleViewingRequest(request, env);
      }

      const integration = integrationForApiPath(pathname);
      if (integration) {
        const denied = await guardGoogleIntegration(request, env, integration);
        if (denied) return denied;
      }

      return app.fetch(request, env, ctx);
    } catch (error) {
      console.error("Joy router failed", error);
      if (pathname.startsWith("/api/") || pathname === "/mcp") {
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
    scheduleIndependentJob(ctx, "Sale viewing", () => runSaleViewingSchedule(env));
    scheduleIndependentJob(ctx, "Daily Brief", () => runDailyBriefSchedule(env));
    scheduleIndependentJob(ctx, "IELTS", () => runIeltsSchedule(env));
    scheduleIndependentJob(ctx, "IELTS course", () => runIeltsCourseSyncSchedule(env));
  },
};
