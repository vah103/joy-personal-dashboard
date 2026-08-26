import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  integrationForApiPath,
  isGoogleAuthRoute,
} from "../worker/google-auth.js";

const authSource = fs.readFileSync(new URL("../worker/google-auth.js", import.meta.url), "utf8");
const routerSource = fs.readFileSync(new URL("../worker/router.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");
const buildSource = fs.readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
const wranglerSource = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const dashboardHtml = fs.readFileSync(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8");
const loginHtml = fs.readFileSync(new URL("../src/pages/login/index.html", import.meta.url), "utf8");
const accountUi = fs.readFileSync(new URL("../src/features/auth/auth-ui.js", import.meta.url), "utf8");
const migrationSource = fs.readFileSync(new URL("../migrations/20260731_canonical_runtime_schema.sql", import.meta.url), "utf8");

test("Joy exposes a dedicated Google login flow", () => {
  assert.equal(isGoogleAuthRoute("/auth/login"), true);
  assert.equal(isGoogleAuthRoute("/auth/connect/gmail"), true);
  assert.equal(isGoogleAuthRoute("/auth/connect/sheets"), true);
  assert.equal(isGoogleAuthRoute("/api/signout"), true);
  assert.ok(authSource.includes('scope: ["openid", "email", "profile", serviceScope]'));
  assert.ok(authSource.includes('access_type: isLogin ? "online" : "offline"'));
  assert.ok(loginHtml.includes("Continue with Google"));
  assert.ok(loginHtml.includes('href="/auth/login"'));
});

test("Gmail and Sheets APIs are guarded independently", () => {
  assert.equal(integrationForApiPath("/api/emails"), "gmail");
  assert.equal(integrationForApiPath("/api/emails/pin"), "gmail");
  assert.equal(integrationForApiPath("/api/sales/viewings"), "sheets");
  assert.equal(integrationForApiPath("/api/finance/summary"), "sheets");
  assert.equal(integrationForApiPath("/api/tasks"), "");
  assert.ok(migrationSource.includes("gmail_enabled INTEGER"));
  assert.ok(migrationSource.includes("sheets_enabled INTEGER"));
  assert.ok(authSource.includes("GMAIL_AUTHORIZATION_REQUIRED"));
  assert.ok(authSource.includes("SHEETS_AUTHORIZATION_REQUIRED"));
  assert.doesNotMatch(authSource, /CREATE TABLE IF NOT EXISTS/);
});

test("dashboard pages require a Joy session", () => {
  assert.ok(routerSource.includes('const PROTECTED_ASSETS = new Set(["/", "/index.html", "/sale-manager.html"])'));
  assert.ok(routerSource.includes("protectJoyAsset(request, env)"));
  assert.ok(authSource.includes('serveAsset(request, env, "/login.html")'));

  const workerFirstMatch = wranglerSource.match(/"run_worker_first"\s*:\s*(true|\[[\s\S]*?\])/);
  assert.ok(workerFirstMatch, "Cloudflare assets must declare run_worker_first");
  if (workerFirstMatch[1] !== "true") {
    const workerFirstRoutes = JSON.parse(workerFirstMatch[1]);
    for (const route of ["/api/*", "/auth/*", "/", "/index.html", "/sale-manager.html"]) {
      assert.ok(
        workerFirstRoutes.includes(route),
        `Cloudflare must route ${route} through the Worker before static assets`,
      );
    }
  }
});

test("sign out preserves integrations while service disconnects are separate", () => {
  assert.ok(authSource.includes('DELETE FROM sessions WHERE token_hash = ?'));
  assert.ok(authSource.includes('/api/integrations/gmail/disconnect'));
  assert.ok(authSource.includes('/api/integrations/sheets/disconnect'));
  assert.ok(accountUi.includes('request("/api/signout"'));
  assert.ok(accountUi.includes('root.location.assign("/auth/connect/gmail")'));
  assert.ok(accountUi.includes('root.location.assign("/auth/connect/sheets")'));
});

test("legacy authentication handlers are not duplicated in the app worker", () => {
  assert.ok(routerSource.includes("isGoogleAuthRoute(pathname)"));
  assert.ok(routerSource.includes("handleGoogleAuthRequest(request, env)"));
  for (const handler of [
    "startGoogleAuthorization",
    "finishGoogleAuthorization",
    "verifyGoogleIdentity",
    "createSession",
    "sessionStatus",
    "disconnectGoogle",
  ]) {
    assert.ok(!appSource.includes(handler), `Legacy handler remains: ${handler}`);
  }
});

test("Cloudflare build contains all authentication assets", () => {
  assert.ok(buildSource.includes('resolve(loginPage, "login.css")'));
  assert.ok(buildSource.includes('resolve(features, "auth", "auth-ui.js")'));
  assert.ok(buildSource.includes('resolve(features, "auth", "auth-ui.css")'));
  assert.ok(dashboardHtml.includes("auth-ui.css?v=joy-google-account-v3"));
  assert.ok(dashboardHtml.includes("auth-ui.js?v=joy-google-account-v3"));
});
