import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("IELTS Core exposes a persisted learner profile and four-skill diagnostic", () => {
  const plan = JSON.parse(read("project-data/ielts/august-2026.json"));
  const model = read("src/features/ielts/core-model.js");
  const ui = read("src/features/ielts/core-ui.js");
  const actions = read("src/features/ielts/core-actions.js");
  const diagnostic = read("src/features/ielts/core-diagnostic.js");

  assert.equal(plan.version, "2026.08.2");
  assert.ok(plan.prelaunch.some((item) => item.id === "prep-profile"));
  assert.ok(plan.prelaunch.some((item) => item.id === "prep-diagnostic"));
  assert.match(model, /2026\.08\.2/);
  assert.match(model, /__learnerBaseline/);
  assert.doesNotMatch(actions, /DOMContentLoaded",load/);

  assert.match(diagnostic, /function profileDefault/);
  assert.match(diagnostic, /BASELINE_SKILLS=\["writing","speaking","reading","listening"\]/);
  assert.match(diagnostic, /function readingBand/);
  assert.match(diagnostic, /function listeningBand/);
  assert.match(diagnostic, /minimum 150 words/);
  assert.match(diagnostic, /minimum 250 words/);
  assert.match(diagnostic, /Part 1–2–3 speaking baseline/);
  assert.match(diagnostic, /Writing and Speaking bands must come from a later review/);
  assert.match(diagnostic, /openBaseline/);
  assert.match(diagnostic, /DOMContentLoaded",load/);

  assert.doesNotThrow(() => new Function(
    `(function(){${model}\n${ui}\n${actions}\n${diagnostic}\n})();`,
  ));
});
