import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("IELTS includes the Writing AI reviewer, freshness guard and adaptive rewrite", () => {
  const model = read("project-data/ielts/ielts-core-model.js");
  const ui = read("project-data/ielts/ielts-core-ui.js");
  const actions = read("project-data/ielts/ielts-core-actions.js");
  const diagnostic = read("project-data/ielts/ielts-core-diagnostic.js");
  const reviewer = read("project-data/ielts/ielts-core-writing-review.js");
  const freshness = read("project-data/ielts/ielts-core-writing-review-freshness.js");
  const rewrite = read("project-data/ielts/ielts-core-writing-rewrite.js");
  const build = read("scripts/build.mjs");
  const card = read("project-data/ielts/ielts-card.js");
  const router = read("worker/router.js");
  const reviewCss = read("project-data/ielts/ielts-writing-review.css");
  const rewriteCss = read("project-data/ielts/ielts-writing-rewrite.css");

  assert.match(build, /ielts-core-writing-review\.js/);
  assert.match(build, /ielts-core-writing-review-freshness\.js/);
  assert.match(build, /ielts-august-core-v5/);
  assert.match(card, /ielts-writing-review\.css\?v=ielts-writing-review-v1/);
  assert.match(card, /ielts-core-writing-rewrite\.js\?v=ielts-writing-rewrite-v1/);
  assert.match(card, /REWRITE_SCRIPT/);
  assert.match(card, /ensureCoreStyles/);
  assert.match(router, /isIeltsDiagnosticReviewRoute/);
  assert.match(router, /handleIeltsDiagnosticReviewRequest/);

  assert.match(reviewer, /\/api\/ielts\/diagnostic-review/);
  assert.match(reviewer, /Reviewing in two passes/);
  assert.match(reviewer, /writing-diagnostic-ai-v1/);
  assert.match(reviewer, /reviewFingerprint/);
  assert.match(reviewer, /Essay changed · review again/);
  assert.match(freshness, /return null/);
  assert.match(rewrite, /Required adaptive mission/);
  assert.match(rewrite, /deadlineHours/);
  assert.match(rewrite, /Minimum 100 words/);
  assert.match(rewrite, /todayWithWritingRewrite/);
  assert.match(rewrite, /coachWithWritingRewrite/);
  assert.match(reviewCss, /writing-review-summary/);
  assert.match(reviewCss, /review-criteria/);
  assert.match(rewriteCss, /writing-rewrite-mission/);

  assert.doesNotThrow(() => new Function(
    `(function(){${model}\n${ui}\n${actions}\n${diagnostic}\n${reviewer}\n${freshness}\n${rewrite}\n})();`,
  ));
});
