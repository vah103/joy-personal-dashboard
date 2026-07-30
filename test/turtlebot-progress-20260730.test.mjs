import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const progressPath = resolve(root, "project-data/turtlebot4/progress-20260730.js");
const loaderPath = resolve(root, "src/features/project-hub/turtlebot-plan-loader.js");

test("30 July TurtleBot progress closes Stage 3 and advances to Stage 4", async () => {
  const [progress, loader] = await Promise.all([
    readFile(progressPath, "utf8"),
    readFile(loaderPath, "utf8"),
  ]);

  assert.doesNotThrow(() => new Function(progress));
  assert.doesNotThrow(() => new Function(loader));
  assert.match(progress, /const plan = hubState\?\.projectState/);
  assert.doesNotMatch(progress, /window\.hubState/);
  assert.match(progress, /currentStageId = "stage-4"/);
  assert.match(progress, /progressAfter: 32/);
  assert.match(progress, /trials: 12/);
  assert.match(progress, /successRate: 100/);
  assert.match(progress, /recoveries: 0/);
  assert.match(progress, /meanTravelTimeSeconds: 8\.43/);
  assert.match(progress, /meanPathLengthMeters: 1\.72/);
  assert.match(progress, /STAGE_3_CHECKLIST_IDS/);
  assert.doesNotMatch(progress, /window\.fetch\s*=/);
  assert.doesNotMatch(progress, /MutationObserver\.prototype/);
  assert.match(loader, /progress-20260730\.js\?v=turtlebot-stage3-complete-v1/);
  assert.match(loader, /script\.addEventListener\("load", loadProgressUpdate/);

  const projectState = {
    updatedAt: "2026-07-29",
    project: {
      totalWeeks: 12,
      currentStageId: "stage-3",
      currentBlockers: ["Benchmark pending"],
    },
    history: [],
  };
  let cardUpdates = 0;
  let stores = 0;
  const context = {
    hubState: { projectState, overrides: { checklist: {}, planTasks: {} } },
    hubElements: { modal: { hidden: true } },
    normalizeOverrides(value) {
      return {
        ...value,
        checklist: value?.checklist || {},
        planTasks: value?.planTasks || {},
      };
    },
    storeLocalOverrides() { stores += 1; },
    updateTurtleBotCard() { cardUpdates += 1; },
    renderHub() {},
  };
  context.window = {
    setTimeout(callback) { callback(); },
    addEventListener() {},
  };

  vm.runInNewContext(progress, context);

  assert.equal(projectState.updatedAt, "2026-07-30");
  assert.equal(projectState.project.currentStageId, "stage-4");
  assert.equal(projectState.project.stage3Result.successRate, 100);
  assert.equal(projectState.project.stage3Result.recoveries, 0);
  assert.equal(projectState.history.at(-1).progressAfter, 32);
  for (const id of ["s3-goal-set", "s3-logging", "s3-runs", "s3-metrics"]) {
    assert.equal(context.hubState.overrides.checklist[id], true);
  }
  assert.ok(cardUpdates >= 1);
  assert.ok(stores >= 1);
});
