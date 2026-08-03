import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const currentStatePath = resolve(root, "project-data/turtlebot4/current-state.json");
const mergerPath = resolve(root, "project-data/turtlebot4/project-current-state.js");
const validationPath = resolve(root, "docs/turtlebot4-stage4-simulation-validation.md");
const loaderPath = resolve(root, "src/features/project-hub/turtlebot-plan-loader.js");
const oldProgressPath = resolve(root, "project-data/turtlebot4/progress-20260730.js");

test("canonical TurtleBot state completes Stage 4 and activates Stage 5", async () => {
  const [stateSource, merger, validation, loader] = await Promise.all([
    readFile(currentStatePath, "utf8"),
    readFile(mergerPath, "utf8"),
    readFile(validationPath, "utf8"),
    readFile(loaderPath, "utf8"),
  ]);
  const state = JSON.parse(stateSource);

  assert.doesNotThrow(() => new Function(merger));
  assert.doesNotThrow(() => new Function(loader));
  assert.equal(state.updatedAt, "2026-08-03");
  assert.equal(state.project.currentStageId, "stage-5");
  assert.equal(state.project.currentStatus, "in-progress");
  assert.deepEqual(state.project.currentBlockers, []);
  assert.equal(state.roadmap.completedStageId, "stage-4");
  assert.equal(state.roadmap.activeStageId, "stage-5");
  assert.equal(state.roadmap.resultStageId, "stage-4");
  assert.equal(state.history.progressAfter, 40);
  assert.deepEqual(state.roadmap.completedChecklistIds, [
    "s3-goal-set",
    "s3-logging",
    "s3-runs",
    "s3-metrics",
    "s4-world",
    "s4-sensors",
    "s4-scenarios",
    "s4-parity",
  ]);
  assert.match(state.roadmap.result.summary, /Stage 4 completed in simulation/);
  assert.match(state.roadmap.result.summary, /restart recovery/);
  assert.match(state.roadmap.result.summary, /Physical-robot behavior remains/);
  assert.match(state.roadmap.result.evidence.join(" "), /turtlebot4-stage4-simulation-validation/);

  assert.match(validation, /S4-A — Baseline bring-up/);
  assert.match(validation, /S4-B — Controlled motion/);
  assert.match(validation, /S4-C — World parity run/);
  assert.match(validation, /S4-D — Restart recovery/);
  assert.match(validation, /Simulation-to-real parity matrix/);
  assert.match(validation, /Passing Stage 4 proves the simulation baseline only/);

  assert.match(merger, /applyRoadmapPatch/);
  assert.match(merger, /for \(const stage of source\.roadmap\.stages\)/);
  assert.match(merger, /resultStageId/);
  assert.match(merger, /Object\.defineProperty\(hubState, "source"/);
  assert.doesNotMatch(merger, /setTimeout|pageshow|localStorage/);
  assert.match(loader, /project-current-state\.js\?v=turtlebot-current-state-v1/);
  assert.doesNotMatch(loader, /progress-20260730\.js/);
  await assert.rejects(access(oldProgressPath));
});
