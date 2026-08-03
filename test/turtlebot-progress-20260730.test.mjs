import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const currentStatePath = resolve(root, "project-data/turtlebot4/current-state.json");
const mergerPath = resolve(root, "project-data/turtlebot4/project-current-state.js");
const loaderPath = resolve(root, "src/features/project-hub/turtlebot-plan-loader.js");
const appConfigPath = resolve(root, "src/pages/dashboard/app-config.js");
const oldProgressPath = resolve(root, "project-data/turtlebot4/progress-20260730.js");

test("canonical TurtleBot state closes Stage 4 and advances to Stage 5", async () => {
  const [stateSource, merger, loader, appConfig] = await Promise.all([
    readFile(currentStatePath, "utf8"),
    readFile(mergerPath, "utf8"),
    readFile(loaderPath, "utf8"),
    readFile(appConfigPath, "utf8"),
  ]);
  const state = JSON.parse(stateSource);

  assert.doesNotThrow(() => new Function(merger));
  assert.doesNotThrow(() => new Function(loader));
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.updatedAt, "2026-08-03");
  assert.equal(state.project.currentStageId, "stage-5");
  assert.equal(state.project.stage3Result.trials, 12);
  assert.equal(state.project.stage3Result.successRate, 100);
  assert.equal(state.project.stage3Result.recoveries, 0);
  assert.equal(state.project.stage3Result.meanTravelTimeSeconds, 8.43);
  assert.equal(state.project.stage3Result.meanPathLengthMeters, 1.72);
  assert.deepEqual(state.project.stage4Result.verifiedWorlds, ["Depot", "Warehouse"]);
  assert.equal(state.project.stage4Result.controlledMotionVerified, true);
  assert.equal(state.project.stage4Result.rvizStatus, "OK");
  assert.equal(state.project.stage4Result.restartRepeatabilityVerified, true);
  assert.equal(state.history.at(-1).progressAfter, 42);
  assert.deepEqual(state.roadmap.completedStageIds, ["stage-3", "stage-4"]);
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
  assert.equal(state.roadmap.activeStageId, "stage-5");
  assert.equal(state.roadmap.results.at(-1).stageId, "stage-4");
  assert.ok(state.plan.completedTaskIds.includes("w4-d7-t2"));

  assert.match(merger, /applyRoadmapPatch/);
  assert.match(merger, /applyPlanPatch/);
  assert.match(merger, /completedStageIds/);
  assert.match(merger, /appendAllUnique/);
  assert.match(merger, /Object\.defineProperty\(hubState, "source"/);
  assert.doesNotMatch(merger, /setTimeout|pageshow|localStorage/);
  assert.match(loader, /project-current-state\.js\?v=turtlebot-current-state-v2/);
  assert.doesNotMatch(loader, /progress-20260730\.js/);
  assert.match(appConfig, /progress: 42/);
  assert.match(appConfig, /Stage 5 · Frontier Detection/);
  await assert.rejects(access(oldProgressPath));
});

test("current-state merger preserves completed Stage 3 while completing Stage 4", async () => {
  const [stateSource, merger] = await Promise.all([
    readFile(currentStatePath, "utf8"),
    readFile(mergerPath, "utf8"),
  ]);
  const currentState = JSON.parse(stateSource);
  const stage = (id, checklistIds) => ({
    id,
    status: "not-started",
    checklist: checklistIds.map((itemId) => ({ id: itemId, done: false })),
    results: [],
  });
  const context = {
    hubState: {
      source: {
        project: { currentStageId: "stage-3" },
        history: [],
        roadmap: {
          updatedAt: "2026-07-29",
          stages: [
            stage("stage-3", ["s3-goal-set", "s3-logging", "s3-runs", "s3-metrics"]),
            stage("stage-4", ["s4-world", "s4-sensors", "s4-scenarios", "s4-parity"]),
            stage("stage-5", ["s5-detect"]),
          ],
        },
      },
      projectState: {
        project: { id: "turtlebot4" },
        history: [],
        weeks: [{ days: [{ tasks: [{ id: "w4-d7-t2", done: false }] }] }],
      },
      activeStageId: "stage-3",
    },
    hubElements: { modal: { hidden: true } },
    updateTurtleBotCard() {},
    renderHub() {},
    fetch: async () => ({ ok: true, json: async () => currentState }),
    console: { error: (error) => assert.fail(String(error)) },
  };

  runInNewContext(merger, context);
  await new Promise((resolve) => setImmediate(resolve));

  const stages = context.hubState.source.roadmap.stages;
  assert.equal(stages[0].status, "completed");
  assert.equal(stages[1].status, "completed");
  assert.equal(stages[2].status, "in-progress");
  assert.ok(stages[0].checklist.every((item) => item.done));
  assert.ok(stages[1].checklist.every((item) => item.done));
  assert.equal(stages[0].results.at(-1).date, "2026-07-30");
  assert.equal(stages[1].results.at(-1).date, "2026-08-03");
  assert.equal(context.hubState.activeStageId, "stage-5");
  assert.equal(context.hubState.projectState.history.at(-1).progressAfter, 42);
  assert.equal(context.hubState.projectState.weeks[0].days[0].tasks[0].done, true);
});
