import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statePath = resolve(root, "project-data/turtlebot4/current-state.json");

test("Stage 4 evidence points to the committed GitHub report", async () => {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const stage4 = state.roadmap.results.find((result) => result.stageId === "stage-4");

  assert.ok(stage4, "Stage 4 result must exist");
  assert.deepEqual(stage4.evidence, ["report/2026-08-03.md"]);
  assert.doesNotMatch(stage4.evidence.join("\n"), /Google Docs daily report/i);
});
