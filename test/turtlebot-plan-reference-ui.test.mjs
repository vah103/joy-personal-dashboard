import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referencePath = resolve(root, "project-data/turtlebot4/project-plan-v3-reference-ui.js");
const loaderPath = resolve(root, "src/features/project-hub/turtlebot-plan-loader.js");
const dashboardPath = resolve(root, "src/pages/dashboard/index.html");
const packagePath = resolve(root, "package.json");

test("TurtleBot 12-week plan contains no checkbox or visible progress UI", async () => {
  const [reference, loader, dashboard, packageSource] = await Promise.all([
    readFile(referencePath, "utf8"),
    readFile(loaderPath, "utf8"),
    readFile(dashboardPath, "utf8"),
    readFile(packagePath, "utf8"),
  ]);

  assert.doesNotThrow(() => new Function(reference));
  assert.match(reference, /12-week reference plan/);
  assert.match(reference, /Current week/);
  assert.match(reference, /Before Lab/);
  assert.match(reference, /At the Lab/);
  assert.match(reference, /After Lab/);
  assert.match(reference, /Completion Gate/);
  assert.match(reference, /renderPlan = renderReferenceOverview/);
  assert.doesNotMatch(reference, /data-ps-task=/);
  assert.doesNotMatch(reference, /type="checkbox"/);
  assert.doesNotMatch(reference, /weekProgress\(/);
  assert.doesNotMatch(reference, /taskProgress\(/);
  assert.doesNotMatch(reference, /previousRenderPlan/);
  assert.doesNotMatch(reference, /progress-track|hub-progress-summary|hub-check-row/);
  assert.doesNotMatch(reference, /\$\{[^}\n]*(?:progress|percentage)[^}\n]*\}%/i);
  assert.match(loader, /project-hub-tabs-cleanup\.js\?v=turtlebot-doc-commands-v1/);
  assert.match(dashboard, /turtlebot-plan-loader\.js\?v=turtlebot-plan-loader-v1/);
  assert.match(dashboard, /turtlebot-roadmap-font\.css\?v=turtlebot-inline-header-tabs-v3/);
  assert.doesNotMatch(packageSource, /cache-bust-turtlebot-plan/);
});
