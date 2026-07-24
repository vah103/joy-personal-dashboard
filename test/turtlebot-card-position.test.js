import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("TurtleBot full background shifts right without rescaling", () => {
  const build = read("scripts/build.mjs");
  const css = read("project-data/turtlebot4/turtlebot-card-position.css");

  assert.ok(build.includes("turtlebot-card-position.css?v=card-position-v2"));
  assert.ok(css.includes('url("/turtlebot4-card-background.webp?v=shift-right-v1")'));
  assert.ok(css.includes("background-size: cover"));
  assert.ok(css.includes("transform: translateX(18px)"));
  assert.ok(!css.includes("102.5%"));
  assert.ok(css.includes("@media (min-width: 721px)"));
});
