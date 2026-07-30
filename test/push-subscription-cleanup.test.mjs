import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const router = fs.readFileSync(new URL("../worker/router.js", import.meta.url), "utf8");
const cleanup = fs.readFileSync(new URL("../worker/push-subscription-cleanup.js", import.meta.url), "utf8");
const frontend = fs.readFileSync(new URL("../src/features/notifications/push-notifications.js", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8");

test("router handles push cleanup before the generic push route", () => {
  const cleanupIndex = router.indexOf("isPushSubscriptionCleanupRoute(pathname)");
  const genericPushIndex = router.indexOf("isPushRoute(pathname)");
  assert.ok(cleanupIndex >= 0);
  assert.ok(genericPushIndex > cleanupIndex);
});

test("cleanup preserves the current endpoint and removes stale endpoints for the same device", () => {
  assert.ok(cleanup.includes("AND user_agent = ?"));
  assert.ok(cleanup.includes("AND endpoint <> ?"));
  assert.ok(cleanup.includes("CURRENT_SUBSCRIPTION_NOT_FOUND"));
});

test("the iPhone registers then cleans stale subscriptions", () => {
  assert.ok(frontend.includes("registerCurrentSubscription(subscription)"));
  assert.ok(frontend.includes('requestJson("/api/push/cleanup-current"'));
  assert.ok(frontend.includes("cleanupResult.removed"));
  assert.ok(dashboard.includes("push-notifications.js?v=joy-current-device-v1"));
});
