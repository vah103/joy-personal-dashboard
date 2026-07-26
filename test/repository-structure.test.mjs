import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);

const requiredPaths = [
  "src/pages/dashboard/index.html",
  "src/pages/dashboard/app.js",
  "src/pages/dashboard/styles.css",
  "src/pages/login/index.html",
  "src/pages/sale/index.html",
  "src/features/auth/auth-ui.js",
  "src/features/finance/finance.js",
  "src/features/notifications/weather-status-ui.js",
  "src/features/project-hub/project-hub-core.js",
  "src/assets/icons/joy-blue-icon.png",
  "src/pwa/site.webmanifest",
  "src/pwa/sw.js",
  "scripts/build.mjs",
  "scripts/run-tests.mjs",
];

test("Cloudflare-first source structure is complete", () => {
  for (const path of requiredPaths) {
    assert.equal(fs.existsSync(new URL(path, root)), true, `Missing ${path}`);
  }
});

test("build reads from src and preserves public asset names", () => {
  const build = fs.readFileSync(new URL("scripts/build.mjs", root), "utf8");
  assert.ok(build.includes('const src = resolve(root, "src")'));
  assert.ok(build.includes('[resolve(features, "finance", "finance.js"), "finance-demo.js"]'));
  assert.ok(build.includes('[resolve(pwa, "sw.js"), "sw.js"]'));
  assert.ok(build.includes('cp(resolve(root, "project-data")'));
});
