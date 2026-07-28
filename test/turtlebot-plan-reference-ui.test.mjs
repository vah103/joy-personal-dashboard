import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referencePath = resolve(root, "project-data/turtlebot4/project-plan-v3-reference-ui.js");
const cacheBustPath = resolve(root, "scripts/cache-bust-turtlebot-plan.mjs");

test("TurtleBot 12-week plan contains no checkbox or percentage UI", async () => {
  const [reference, cacheBust] = await Promise.all([
    readFile(referencePath, "utf8"),
    readFile(cacheBustPath, "utf8"),
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
  assert.doesNotMatch(reference, /%/);
  assert.match(cacheBust, /turtlebot-reference-no-progress-v2/);
  assert.match(cacheBust, /loadFlexiblePeriods\(\);", "loadReferencePlan\(\);"/);
});