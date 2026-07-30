import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [performance, speaking, vocabulary, turtlebot, build] = await Promise.all([
  read("src/features/project-hub/project-hub-performance.js"),
  read("src/features/speaking/speaking-loader.js"),
  read("src/features/vocabulary/vocabulary-loader.js"),
  read("src/features/project-hub/turtlebot-plan-loader.js"),
  read("scripts/build.mjs"),
]);

test("Project Hub performance owns only modal lifecycle behavior", () => {
  assert.match(performance, /pageshow/);
  assert.match(performance, /turtlebot-hub-modal/);
  assert.doesNotMatch(performance, /vocabulary|speaking|project-plan-v3|project-hub-tabs-cleanup/i);
});

test("Speaking and Vocabulary use dedicated loaders with preserved ordering", () => {
  assert.match(speaking, /JoySpeakingLoader = Object\.freeze/);
  assert.match(speaking, /project-data\/speaking\/speaking\.css/);
  assert.match(speaking, /project-data\/speaking\/speaking\.js/);
  assert.doesNotMatch(speaking, /vocabulary|turtlebot/i);

  assert.match(vocabulary, /project-data\/vocabulary\/vocabulary\.css/);
  assert.match(vocabulary, /vocabulary-mobile-inline\.js/);
  assert.match(vocabulary, /JoySpeakingLoader\?\.load/);
  assert.doesNotMatch(vocabulary, /project-plan-v3|project-hub-tabs-cleanup/);

  const speakingIndex = build.indexOf("speaking-loader.js?v=joy-speaking-loader-v1");
  const vocabularyIndex = build.indexOf("vocabulary-loader.js?v=joy-vocabulary-loader-v1");
  assert.ok(speakingIndex >= 0);
  assert.ok(vocabularyIndex > speakingIndex);
});

test("TurtleBot plan chain is isolated from language feature loading", () => {
  assert.match(turtlebot, /project-plan-v3-ui\.js/);
  assert.match(turtlebot, /project-plan-v3-reference-ui\.js/);
  assert.match(turtlebot, /project-hub-tabs-cleanup\.js/);
  assert.doesNotMatch(turtlebot, /vocabulary|speaking/i);
  assert.match(build, /turtlebot-plan-loader\.js\?v=turtlebot-plan-loader-v1/);
});
