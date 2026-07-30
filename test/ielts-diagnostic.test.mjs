import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("IELTS baseline and assessments are stored as evidence in schema v2", () => {
  const plan = JSON.parse(read("project-data/ielts/program-2026.json"));
  const model = read("src/features/ielts/core-model.js");
  const ui = read("src/features/ielts/core-ui.js");
  const actions = read("src/features/ielts/core-actions.js");
  const worker = read("worker/ielts-core.js");

  assert.equal(plan.baseline.tasks.length, 4);
  assert.match(model, /schemaVersion: 2/);
  assert.match(model, /courseSessions/);
  assert.match(model, /assessments/);
  assert.match(ui, /Progress toward Band 7\.0/);
  assert.match(actions, /Add assessment/);
  assert.match(actions, /scores:/);
  assert.match(worker, /schemaVersion: 2/);
  assert.doesNotThrow(() => new Function(`(function(){${model}\n${ui}\n${actions}\n})();`));
});
