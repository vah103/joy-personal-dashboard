import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [performance, vocabulary, turtlebot, dashboard] = await Promise.all([
  read("src/features/project-hub/project-hub-performance.js"),
  read("src/features/vocabulary/vocabulary-loader.js"),
  read("src/features/project-hub/turtlebot-plan-loader.js"),
  read("src/pages/dashboard/index.html"),
]);

test("Project Hub performance owns only modal lifecycle behavior", () => {
  assert.match(performance, /pageshow/);
  assert.match(performance, /turtlebot-hub-modal/);
  assert.doesNotMatch(performance, /vocabulary|speaking|project-plan-v3|project-hub-tabs-cleanup/i);
});

test("Vocabulary loader owns the current language UI without legacy frontend layers", () => {
  assert.match(vocabulary, /project-data\/vocabulary\/vocabulary\.css/);
  assert.match(vocabulary, /vocabulary-practice-redesign\.css/);
  assert.match(vocabulary, /vocabulary-library-tools\.css/);
  assert.match(vocabulary, /vocabulary-mobile-inline\.js/);
  assert.doesNotMatch(vocabulary, /JoySpeakingLoader|project-data\/speaking\//);
  assert.doesNotMatch(vocabulary, /vocabulary-openai\.css|vocabulary-result-size\.css|vocabulary-modal-fit\.css/);
  assert.doesNotMatch(vocabulary, /vocabulary-library-add-button\.js/);
  assert.doesNotMatch(vocabulary, /project-plan-v3|project-hub-tabs-cleanup/);

  for (const removedPath of [
    "project-data/speaking/speaking.js",
    "project-data/speaking/speaking.css",
    "project-data/speaking/speaking-openai.css",
    "project-data/vocabulary/vocabulary-openai.css",
    "project-data/vocabulary/vocabulary-result-size.css",
    "project-data/vocabulary/vocabulary-modal-fit.css",
    "project-data/vocabulary/vocabulary-library-add-button.js",
  ]) {
    assert.equal(fs.existsSync(new URL(`../${removedPath}`, import.meta.url)), false, `${removedPath} must remain removed`);
  }

  assert.match(dashboard, /vocabulary-loader\.js\?v=joy-vocabulary-loader-v1/);
});

test("TurtleBot plan chain is isolated from language feature loading", () => {
  assert.match(turtlebot, /project-plan-v3-ui\.js/);
  assert.match(turtlebot, /project-plan-v3-reference-ui\.js/);
  assert.match(turtlebot, /project-hub-tabs-cleanup\.js/);
  assert.doesNotMatch(turtlebot, /vocabulary|speaking/i);
  assert.match(dashboard, /turtlebot-plan-loader\.js\?v=turtlebot-plan-loader-v2/);
});
