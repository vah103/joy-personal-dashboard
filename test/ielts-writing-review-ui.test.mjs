import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("IELTS bundle includes the Writing AI reviewer and freshness guard", () => {
  const model = read("project-data/ielts/ielts-core-model.js");
  const ui = read("project-data/ielts/ielts-core-ui.js");
  const actions = read("project-data/ielts/ielts-core-actions.js");
  const diagnostic = read("project-data/ielts/ielts-core-diagnostic.js");
  const reviewer = read("project-data/ielts/ielts-core-writing-review.js");
  const freshness = read("project-data/ielts/ielts-core-writing-review-freshness.js");
  const build = read("scripts/build.mjs");
  const card = read("project-data/ielts/ielts-card.js");
  const router = read("worker/router.js");
  const css = read("project-data/ielts/ielts-writing-review.css");

  assert.match(build, /ielts-core-writing-review\.js/);
  assert.match(build, /ielts-core-writing-review-freshness\.js/);
  assert.match(build, /ielts-august-core-v5/);
  assert.match(card, /ielts-writing-review\.css\?v=ielts-writing-review-v1/);
  assert.match(card, /ensureCoreStyles/);
  assert.match(router, /isIeltsDiagnosticReviewRoute/);
  assert.match(router, /handleIeltsDiagnosticReviewRequest/);

  assert.match(reviewer, /\/api\/ielts\/diagnostic-review/);
  assert.match(reviewer, /Reviewing in two passes/);
  assert.match(reviewer, /writing-diagnostic-ai-v1/);
  assert.match(reviewer, /reviewFingerprint/);
  assert.match(reviewer, /Essay changed · review again/);
  assert.match(freshness, /return null/);
  assert.match(css, /writing-review-summary/);
  assert.match(css, /review-criteria/);

  assert.doesNotThrow(() => new Function(
    `(function(){${model}\n${ui}\n${actions}\n${diagnostic}\n${reviewer}\n${freshness}\n})();`,
  ));
});
