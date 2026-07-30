import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("ChatGPT teaches while Joy stores structured tasks and course knowledge", () => {
  const actions = read("src/features/ielts/core-actions.js");
  const ui = read("src/features/ielts/core-ui.js");
  const router = read("worker/router.js");
  const build = read("scripts/build.mjs");

  assert.match(actions, /Start with ChatGPT/);
  assert.match(actions, /Do not give me the entire lesson or all answers at once/);
  assert.match(actions, /type: "rhythm_tasks"/);
  assert.match(actions, /type: "course_session"/);
  assert.match(actions, /objective/);
  assert.match(actions, /steps/);
  assert.match(actions, /doneWhen/);
  assert.match(ui, /Now/);
  assert.match(ui, /Course/);
  assert.match(ui, /Journey/);
  assert.match(ui, /Progress/);
  assert.doesNotMatch(router, /ielts-diagnostic-review/);
  assert.doesNotMatch(build, /core-writing-review|core-writing-rewrite|core-diagnostic/);
});
