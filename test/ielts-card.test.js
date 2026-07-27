import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("IELTS dashboard card loads the isolated August Coach and stays responsive", () => {
  const build = read("scripts/build.mjs");
  const css = read("project-data/ielts/ielts-card.css");
  const script = read("project-data/ielts/ielts-card.js");
  const actions = read("project-data/ielts/ielts-core-actions.js");
  const image = new URL("../project-data/ielts/ielts-card-background.webp", import.meta.url);

  assert.ok(build.includes("project-data/ielts/ielts-card.css?v=ielts-card-v2"));
  assert.ok(build.includes("project-data/ielts/ielts-core.css?v=ielts-august-core-v3"));
  assert.ok(build.includes("project-data/ielts/ielts-core-polish.css?v=ielts-august-core-v3"));
  assert.ok(build.includes("project-data/ielts/ielts-core-bundle.js?v=ielts-august-core-v3"));
  assert.ok(build.includes("ieltsCoreSourceFiles"));
  assert.ok(build.includes("(function registerIeltsAugustCore()"));
  assert.ok(build.includes("project-data/ielts/ielts-card.js?v=ielts-card-v4"));
  assert.ok(fs.existsSync(image));
  assert.ok(fs.statSync(image).size > 50_000);

  assert.ok(css.includes('url("ielts-card-background.webp?v=ielts-card-v2")'));
  assert.ok(css.includes(".ielts-target-pill"));
  assert.ok(css.includes("@media (max-width: 720px)"));
  assert.ok(css.includes("background-size:\n      100% 100%,\n      100% auto;"));

  assert.ok(script.includes('card.classList.add("ielts-project-card")'));
  assert.ok(script.includes("Target Band 7.0"));
  assert.ok(script.includes("ielts-core-bundle.js?v=ielts-august-core-v3"));
  assert.ok(script.includes('card.addEventListener("click", openCoach, true)'));
  assert.ok(script.includes("window.JoyIELTS.open()"));
  assert.ok(script.includes('card.classList.remove("project-card-has-details")'));
  assert.ok(script.includes('card.removeAttribute("data-project-detail-key")'));
  assert.ok(script.includes("Loading August Core"));
  assert.ok(script.includes("childList: true"));
  assert.ok(!script.includes("subtree: true"));
  assert.ok(actions.includes("stopImmediatePropagation"));
  assert.ok(actions.includes("},true);"));
});