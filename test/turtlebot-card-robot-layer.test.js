import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("TurtleBot card uses a separate direct WebP robot layer", () => {
  const build = read("scripts/build.mjs");
  const layer = read("project-data/turtlebot4/turtlebot-card-robot-layer.css");

  assert.ok(fs.existsSync(new URL("turtlebot4-art.webp", root)));
  assert.ok(build.includes("turtlebot-card-robot-layer.css?v=robot-layer-v2"));
  assert.ok(layer.includes('url("/turtlebot4-art.webp?v=robot-layer-v2")'));
  assert.ok(layer.includes("background-size: contain"));
  assert.ok(layer.includes("mix-blend-mode: multiply"));
  assert.ok(layer.includes("transform: none"));
  assert.ok(!layer.includes("turtlebot4-card-robot.svg"));
  assert.ok(!layer.includes("background-size: cover"));
});
