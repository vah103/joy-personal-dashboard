import test from "node:test";
import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { synchronizeTurtleBotFallbacks } from "../scripts/sync-turtlebot-fallbacks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function copyFixture(publicRoot, source, destination) {
  const target = resolve(publicRoot, destination);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(root, source), target);
}

test("production TurtleBot fallbacks are generated from canonical Stage 5 state", async (context) => {
  const publicRoot = await mkdtemp(resolve(tmpdir(), "joy-turtlebot-fallbacks-"));
  context.after(() => rm(publicRoot, { recursive: true, force: true }));

  await Promise.all([
    copyFixture(
      publicRoot,
      "project-data/turtlebot4/current-state.json",
      "project-data/turtlebot4/current-state.json",
    ),
    copyFixture(
      publicRoot,
      "project-data/turtlebot4/source.json",
      "project-data/turtlebot4/source.json",
    ),
    copyFixture(
      publicRoot,
      "project-data/turtlebot4/project-plan-v3-ui.js",
      "project-data/turtlebot4/project-plan-v3-ui.js",
    ),
    copyFixture(
      publicRoot,
      "src/features/project-details/turtlebot-roadmap.js",
      "turtlebot-roadmap.js",
    ),
  ]);

  await synchronizeTurtleBotFallbacks(publicRoot);

  const [stateSource, snapshotSource, planSource, roadmapSource, packageSource] = await Promise.all([
    readFile(resolve(publicRoot, "project-data/turtlebot4/current-state.json"), "utf8"),
    readFile(resolve(publicRoot, "project-data/turtlebot4/source.json"), "utf8"),
    readFile(resolve(publicRoot, "project-data/turtlebot4/project-plan-v3-ui.js"), "utf8"),
    readFile(resolve(publicRoot, "turtlebot-roadmap.js"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
  ]);

  const currentState = JSON.parse(stateSource);
  const snapshot = JSON.parse(snapshotSource);
  const stages = new Map(snapshot.roadmap.stages.map((stage) => [stage.id, stage]));

  assert.equal(currentState.project.currentStageId, "stage-5");
  assert.equal(snapshot.project.currentStageId, "stage-5");
  assert.equal(snapshot.project.overallProgress, 42);
  assert.equal(snapshot.project.currentFocus, currentState.project.currentFocus);
  assert.equal(snapshot.project.nextAction, currentState.project.nextAction);
  assert.equal(snapshot.roadmap.updatedAt, currentState.updatedAt);
  assert.deepEqual(snapshot.roadmap.completedStageIds, [
    "stage-1",
    "stage-2",
    "stage-3",
    "stage-4",
  ]);

  for (const stageId of snapshot.roadmap.completedStageIds) {
    assert.equal(stages.get(stageId)?.status, "completed");
    assert.ok(stages.get(stageId)?.checklist.every((item) => item.done));
  }
  assert.equal(stages.get("stage-5")?.status, "in-progress");
  assert.equal(stages.get("stage-3")?.results.at(-1)?.date, "2026-07-30");
  assert.equal(stages.get("stage-4")?.results.at(-1)?.date, "2026-08-03");

  assert.match(planSource, /JOY_TURTLEBOT_CANONICAL_FALLBACK/);
  assert.match(planSource, /"currentStageId":"stage-5"/);
  assert.match(planSource, /"currentBlockers":\[\]/);
  assert.match(planSource, /turtleBotFallbackCompletedStages/);

  assert.match(roadmapSource, /JOY_TURTLEBOT_ROADMAP_FALLBACK/);
  assert.match(roadmapSource, /TURTLEBOT_FALLBACK_ACTIVE_STAGE = "stage-5"/);
  assert.match(roadmapSource, /TURTLEBOT_FALLBACK_PROGRESS = 42/);
  assert.match(roadmapSource, /TURTLEBOT_FALLBACK_COMPLETED_STAGES\.has/);

  const packageJson = JSON.parse(packageSource);
  assert.match(
    packageJson.scripts.build,
    /node scripts\/sync-turtlebot-fallbacks\.mjs dist/,
  );
});
