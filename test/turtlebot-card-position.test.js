import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("TurtleBot full background is shifted slightly right on desktop", () => {
  const build = read("scripts/build.mjs");
  const css = read("project-data/turtlebot4/turtlebot-card-position.css");

  assert.ok(build.includes("turtlebot-card-position.css?v=card-position-v1"));
  assert.ok(css.includes("background-position: center, left center"));
  assert.ok(css.includes("background-size: auto, 102.5% auto"));
  assert.ok(css.includes("@media (min-width: 721px)"));
});
