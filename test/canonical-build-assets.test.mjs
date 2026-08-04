import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const packageJson = JSON.parse(read("package.json"));
const dashboard = read("src/pages/dashboard/index.html");
const build = read("scripts/build.mjs");
const turtleBotVersioner = read("scripts/version-turtlebot-assets.mjs");
const financeBundle = read("scripts/build-finance-bundle.mjs");
const removedPatches = [
  "scripts/cache-bust-finance-p1008.mjs",
  "scripts/cache-bust-task-english.mjs",
  "scripts/cache-bust-task-natural-input.mjs",
  "scripts/cache-bust-turtlebot-plan.mjs",
];
const removedFinanceOverlays = [
  "project-data/finance/finance-layout-v2.js",
  "project-data/finance/finance-layout-v2.css",
  "project-data/finance/finance-dashboard-v1.js",
  "project-data/finance/finance-p1008-refine-v3.js",
  "project-data/finance/finance-p1008-refine-v3.css",
];

test("frontend build has one canonical HTML owner", () => {
  const buildSteps = packageJson.scripts.build.split(" && ");
  const canonicalBuild = "node scripts/build.mjs";
  const turtleBotFallbackSync = "node scripts/sync-turtlebot-fallbacks.mjs dist";
  const turtleBotAssetVersioning = "node scripts/version-turtlebot-assets.mjs dist";
  const sanitizePublicData = "node scripts/sanitize-public-project-data.mjs";
  const financeBuild = "node scripts/build-finance-bundle.mjs";

  assert.equal(buildSteps[0], "node scripts/validate-ielts-sources.mjs");
  assert.equal(buildSteps.filter((step) => step === canonicalBuild).length, 1);
  assert.equal(buildSteps.filter((step) => step === turtleBotFallbackSync).length, 1);
  assert.equal(buildSteps.filter((step) => step === turtleBotAssetVersioning).length, 1);
  assert.ok(buildSteps.indexOf(canonicalBuild) < buildSteps.indexOf(turtleBotFallbackSync));
  assert.ok(buildSteps.indexOf(turtleBotFallbackSync) < buildSteps.indexOf(turtleBotAssetVersioning));
  assert.ok(buildSteps.indexOf(turtleBotAssetVersioning) < buildSteps.indexOf(sanitizePublicData));
  assert.ok(buildSteps.indexOf(sanitizePublicData) < buildSteps.indexOf(financeBuild));
  assert.equal(buildSteps.at(-1), financeBuild);

  assert.match(build, /readFile\(resolve\(dashboardPage, "index\.html"\), "utf8"\)/);
  assert.match(build, /dashboardBackendAnchor/);
  assert.doesNotMatch(build, /const projectHubHead =|const dashboardFeatureScripts =/);
  assert.match(turtleBotVersioner, /versionTurtleBotAssets/);
  assert.match(turtleBotVersioner, /joy-build-version/);
  assert.match(turtleBotVersioner, /cache:\s*"no-store"/);
  for (const path of removedPatches) {
    assert.equal(fs.existsSync(new URL(path, root)), false, `${path} must remain removed`);
  }
});

test("canonical dashboard HTML owns final production asset versions", () => {
  for (const reference of [
    "finance-demo.css?v=joy-finance-core-v5",
    "finance-demo.js?v=joy-finance-core-v10",
    "finance-p1008.css?v=joy-finance-p1008-v5",
    "finance-p1008.js?v=joy-finance-p1008-v5",
    "finance-p1008-capture-v2.css?v=joy-finance-p1008-capture-v3",
    "finance-p1008-shopping-v1.css?v=joy-finance-p1008-shopping-v1",
    "finance-p1008-shopping-v1.js?v=joy-finance-p1008-shopping-v1",
    "finance-p1008-shopping-compact-v1.css?v=joy-finance-p1008-shopping-compact-v1",
    "finance-p1008-shopping-compact-v1.js?v=joy-finance-p1008-shopping-compact-v1",
    "task-english.js?v=joy-task-english-v7",
    "task-natural-input.js?v=joy-natural-reminders-v2",
    "speaking-loader.js?v=joy-speaking-loader-v1",
    "vocabulary-loader.js?v=joy-vocabulary-loader-v1",
    "project-hub-performance.js?v=turtlebot-hub-lifecycle-v1",
    "turtlebot-plan-loader.js?v=turtlebot-plan-loader-v2",
  ]) {
    assert.match(dashboard, new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Finance presentation overlays are absorbed into canonical bundles", () => {
  for (const path of removedFinanceOverlays) {
    assert.equal(fs.existsSync(new URL(path, root)), false, `${path} must remain removed`);
    assert.doesNotMatch(dashboard, new RegExp(path.split("/").at(-1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const source of [
    "finance-dashboard.js",
    "finance-month-layout.js",
    "finance-month-layout.css",
    "finance-p1008-layout.js",
    "finance-p1008-layout.css",
  ]) {
    assert.match(financeBundle, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(financeBundle, /extractInlineStyle/);
  assert.match(financeBundle, /financeCssBundle/);
  assert.match(financeBundle, /p1008CssBundle/);
});

test("secondary builders never rewrite dist index HTML", () => {
  assert.doesNotMatch(financeBundle, /index\.html/);
  assert.doesNotMatch(financeBundle, /replaceAll?\(/);
  assert.match(financeBundle, /writeFile\(resolve\(dist, "finance-demo\.js"\), financeBundle\)/);
  assert.match(financeBundle, /writeFile\(resolve\(distProjectFinanceDir, "finance-p1008\.js"\), p1008Bundle\)/);
});
