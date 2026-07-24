import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("TurtleBot card uses a separate sharp robot layer", () => {
  const build = read("scripts/build.mjs");
  const layer = read("project-data/turtlebot4/turtlebot-card-robot-layer.css");
  const robot = read("project-data/turtlebot4/turtlebot4-card-robot.svg");

  assert.ok(build.includes("turtlebot-card-robot-layer.css?v=robot-layer-v1"));
  assert.ok(layer.includes('url("turtlebot4-card-robot.svg?v=robot-layer-v1")'));
  assert.ok(layer.includes("background-size: contain"));
  assert.ok(layer.includes("transform: none"));
  assert.ok(!layer.includes("background-size: cover"));
  assert.ok(robot.includes('viewBox="0 0 614 795"'));
  assert.ok(robot.includes("data:image/webp;base64,"));
});
