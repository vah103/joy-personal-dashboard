import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("IELTS dashboard card loads the isolated August Coach and learner baseline", () => {
  const build = read("scripts/build.mjs");
  const css = read("project-data/ielts/ielts-card.css");
  const diagnosticCss = read("project-data/ielts/ielts-diagnostic.css");
  const script = read("project-data/ielts/ielts-card.js");
  const actions = read("project-data/ielts/ielts-core-actions.js");
  const image = new URL("../project-data/ielts/ielts-card-background.webp", import.meta.url);

  assert.ok(build.includes("project-data/ielts/ielts-card.css?v=ielts-card-v2"));
  assert.ok(build.includes("project-data/ielts/ielts-core.css?v=ielts-august-core-v3"));
  assert.ok(build.includes("project-data/ielts/ielts-diagnostic.css?v=ielts-baseline-v1"));
  assert.ok(build.includes("project-data/ielts/ielts-core-bundle.js?v=ielts-august-core-v4"));
  assert.ok(build.includes('"ielts-core-diagnostic.js"'));
  assert.ok(build.includes("project-data/ielts/ielts-card.js?v=ielts-card-v5"));
  assert.ok(fs.existsSync(image));
  assert.ok(fs.statSync(image).size > 50_000);

  assert.ok(css.includes('url("ielts-card-background.webp?v=ielts-card-v2")'));
  assert.ok(css.includes(".ielts-target-pill"));
  assert.ok(css.includes("@media (max-width: 720px)"));
  assert.ok(diagnosticCss.includes(".diagnostic-grid"));
  assert.ok(diagnosticCss.includes(".baseline-summary"));

  assert.ok(script.includes('card.classList.add("ielts-project-card")'));
  assert.ok(script.includes("Target Band 7.0"));
  assert.ok(script.includes("ielts-core-bundle.js?v=ielts-august-core-v4"));
  assert.ok(script.includes('card.addEventListener("click", openCoach, true)'));
  assert.ok(script.includes("window.JoyIELTS.open()"));
  assert.ok(script.includes('card.classList.remove("project-card-has-details")'));
  assert.ok(script.includes("ielts-diagnostic.css?v=ielts-baseline-v1"));
  assert.ok(actions.includes("__learnerBaseline"));
  assert.ok(actions.includes("stopImmediatePropagation"));
});