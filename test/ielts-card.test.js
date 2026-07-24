import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("IELTS dashboard card uses the real document artwork and stays responsive", () => {
  const build = read("scripts/build.mjs");
  const css = read("project-data/ielts/ielts-card.css");
  const script = read("project-data/ielts/ielts-card.js");
  const image = new URL("../project-data/ielts/ielts-card-background.webp", import.meta.url);

  assert.ok(build.includes("project-data/ielts/ielts-card.css?v=ielts-card-v1"));
  assert.ok(build.includes("project-data/ielts/ielts-card.js?v=ielts-card-v1"));
  assert.ok(fs.existsSync(image));
  assert.ok(fs.statSync(image).size > 50_000);

  assert.ok(css.includes('url("ielts-card-background.webp?v=ielts-card-v1")'));
  assert.ok(css.includes(".ielts-target-pill"));
  assert.ok(css.includes("@media (max-width: 720px)"));
  assert.ok(css.includes("background-size:\n      100% 100%,\n      100% auto;"));

  assert.ok(script.includes('card.classList.add("ielts-project-card")'));
  assert.ok(script.includes("Target Band 7.0"));
  assert.ok(script.includes("childList: true"));
  assert.ok(!script.includes("subtree: true"));
});