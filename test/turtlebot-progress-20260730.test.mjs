import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const currentStatePath = resolve(root, "project-data/turtlebot4/current-state.json");
const mergerPath = resolve(root, "project-data/turtlebot4/project-current-state.js");
const loaderPath = resolve(root, "src/features/project-hub/turtlebot-plan-loader.js");
const oldProgressPath = resolve(root, "project-data/turtlebot4/progress-20260730.js");

test("canonical TurtleBot state closes Stage 3 and advances to Stage 4", async () => {
  const [stateSource, merger, loader] = await Promise.all([
    readFile(currentStatePath, "utf8"),
    readFile(mergerPath, "utf8"),
    readFile(loaderPath, "utf8"),
  ]);
  const state = JSON.parse(stateSource);

  assert.doesNotThrow(() => new Function(merger));
  assert.doesNotThrow(() => new Function(loader));
  assert.equal(state.updatedAt, "2026-07-30");
  assert.equal(state.project.currentStageId, "stage-4");
  assert.equal(state.project.stage3Result.trials, 12);
  assert.equal(state.project.stage3Result.successRate, 100);
  assert.equal(state.project.stage3Result.recoveries, 0);
  assert.equal(state.project.stage3Result.meanTravelTimeSeconds, 8.43);
  assert.equal(state.project.stage3Result.meanPathLengthMeters, 1.72);
  assert.equal(state.history.progressAfter, 32);
  assert.deepEqual(state.roadmap.completedChecklistIds, [
    "s3-goal-set",
    "s3-logging",
    "s3-runs",
    "s3-metrics",
  ]);

  assert.match(merger, /applyRoadmapPatch/);
  assert.match(merger, /applyPlanPatch/);
  assert.match(merger, /Object\.defineProperty\(hubState, "source"/);
  assert.doesNotMatch(merger, /setTimeout|pageshow|localStorage/);
  assert.match(loader, /project-current-state\.js\?v=turtlebot-current-state-v1/);
  assert.doesNotMatch(loader, /progress-20260730\.js/);
  await assert.rejects(access(oldProgressPath));
});
