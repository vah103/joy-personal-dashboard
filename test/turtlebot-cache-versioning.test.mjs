import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { versionTurtleBotAssets } from "../scripts/version-turtlebot-assets.mjs";

const BUILD_VERSION = "joy-build-cache-test-1234";

async function createFixture(root) {
  const projectData = resolve(root, "project-data", "turtlebot4");
  await mkdir(projectData, { recursive: true });

  await Promise.all([
    writeFile(resolve(root, "index.html"), `<!doctype html>
<meta name="joy-build-version" content="${BUILD_VERSION}">
<script src="project-data/turtlebot4/project-state-v2.js?v=old-state"></script>
<script src="turtlebot-roadmap.js?v=old-roadmap"></script>
<script src="turtlebot-plan-loader.js?v=old-loader"></script>
`),
    writeFile(resolve(root, "turtlebot-plan-loader.js"), `(() => {
  const cleanup = "/project-data/turtlebot4/project-hub-tabs-cleanup.js?v=old-cleanup";
  const reference = "/project-data/turtlebot4/project-plan-v3-reference-ui.js?v=old-reference";
  const state = "/project-data/turtlebot4/project-current-state.js?v=old-state";
  const plan = "/project-data/turtlebot4/project-plan-v3-ui.js?v=old-plan";
  void [cleanup, reference, state, plan];
})();
`),
    writeFile(resolve(projectData, "project-current-state.js"), `(() => {
  const STATE_URL = "/project-data/turtlebot4/current-state.json?v=old-json";
  fetch(STATE_URL, { credentials: "same-origin" });
})();
`),
  ]);
}

test("TurtleBot deploy assets use the current build SHA and no-store JSON fetch", async (context) => {
  const publicRoot = await mkdtemp(resolve(tmpdir(), "joy-turtlebot-cache-"));
  context.after(() => rm(publicRoot, { recursive: true, force: true }));
  await createFixture(publicRoot);

  assert.equal(await versionTurtleBotAssets(publicRoot), BUILD_VERSION);
  assert.equal(await versionTurtleBotAssets(publicRoot), BUILD_VERSION);

  const [indexHtml, loader, currentState] = await Promise.all([
    readFile(resolve(publicRoot, "index.html"), "utf8"),
    readFile(resolve(publicRoot, "turtlebot-plan-loader.js"), "utf8"),
    readFile(resolve(publicRoot, "project-data", "turtlebot4", "project-current-state.js"), "utf8"),
  ]);

  for (const asset of [
    "project-data/turtlebot4/project-state-v2.js",
    "turtlebot-roadmap.js",
    "turtlebot-plan-loader.js",
  ]) {
    assert.match(indexHtml, new RegExp(`${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?v=${BUILD_VERSION}`));
  }

  for (const asset of [
    "/project-data/turtlebot4/project-hub-tabs-cleanup.js",
    "/project-data/turtlebot4/project-plan-v3-reference-ui.js",
    "/project-data/turtlebot4/project-current-state.js",
    "/project-data/turtlebot4/project-plan-v3-ui.js",
  ]) {
    assert.match(loader, new RegExp(`${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?v=${BUILD_VERSION}`));
  }

  assert.match(
    currentState,
    new RegExp(`current-state\\.json\\?v=${BUILD_VERSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
  assert.match(currentState, /fetch\(STATE_URL, \{ credentials: "same-origin", cache: "no-store" \}\)/);
  assert.doesNotMatch(`${indexHtml}\n${loader}\n${currentState}`, /old-(?:state|roadmap|loader|cleanup|reference|plan|json)/);
});
