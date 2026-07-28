import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referencePath = resolve(root, "project-data/turtlebot4/project-plan-v3-reference-ui.js");
const loaderPath = resolve(root, "src/features/project-hub/project-hub-performance.js");

test("TurtleBot 12-week plan is read-only and calendar-driven", async () => {
  const [reference, loader] = await Promise.all([
    readFile(referencePath, "utf8"),
    readFile(loaderPath, "utf8"),
  ]);

  assert.doesNotThrow(() => new Function(reference));
  assert.match(reference, /12-week reference plan/);
  assert.match(reference, /changes automatically according to time/);
  assert.match(reference, /Current week/);
  assert.match(reference, /Before Lab/);
  assert.match(reference, /At the Lab/);
  assert.match(reference, /After Lab/);
  assert.match(reference, /Completion Gate/);
  assert.doesNotMatch(reference, /data-ps-task=/);
  assert.doesNotMatch(reference, /weekProgress\(/);
  assert.doesNotMatch(reference, /taskProgress\(/);
  assert.match(loader, /project-plan-v3-reference-ui\.js\?v=turtlebot-read-only-plan-v1/);
});
