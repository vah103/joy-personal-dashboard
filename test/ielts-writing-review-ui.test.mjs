import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("IELTS includes the consolidated Writing AI reviewer, freshness guard and adaptive rewrite", () => {
  const model = read("src/features/ielts/core-model.js");
  const ui = read("src/features/ielts/core-ui.js");
  const actions = read("src/features/ielts/core-actions.js");
  const diagnostic = read("src/features/ielts/core-diagnostic.js");
  const reviewer = read("src/features/ielts/core-writing-review.js");
  const rewrite = read("src/features/ielts/core-writing-rewrite.js");
  const build = read("scripts/build.mjs");
  const card = read("src/features/ielts/card.js");
  const router = read("worker/router.js");
  const reviewCss = read("project-data/ielts/ielts-writing-review.css");
  const rewriteCss = read("project-data/ielts/ielts-writing-rewrite.css");

  assert.match(build, /core-writing-review\.js/);
  assert.match(build, /core-writing-rewrite\.js/);
  assert.doesNotMatch(build, /core-writing-review-freshness\.js/);
  assert.match(build, /ielts-august-core-v6/);
  assert.match(card, /ielts-writing-review\.css\?v=ielts-writing-review-v1/);
  assert.match(card, /ielts-writing-rewrite\.css\?v=ielts-writing-rewrite-v1/);
  assert.doesNotMatch(card, /REWRITE_SCRIPT/);
  assert.doesNotMatch(card, /ielts-core-writing-rewrite\.js\?v=/);
  assert.match(card, /ensureCoreStyles/);
  assert.match(router, /isIeltsDiagnosticReviewRoute/);
  assert.match(router, /handleIeltsDiagnosticReviewRequest/);

  assert.match(reviewer, /\/api\/ielts\/diagnostic-review/);
  assert.match(reviewer, /Reviewing in two passes/);
  assert.match(reviewer, /writing-diagnostic-ai-v1/);
  assert.match(reviewer, /reviewFingerprint/);
  assert.match(reviewer, /Essay changed · review again/);
  assert.match(reviewer, /diagnosticBandWithWritingFreshness/);
  assert.match(reviewer, /return null/);
  assert.match(rewrite, /Required adaptive mission/);
  assert.match(rewrite, /deadlineHours/);
  assert.match(rewrite, /Minimum 100 words/);
  assert.match(rewrite, /todayWithWritingRewrite/);
  assert.match(rewrite, /coachWithWritingRewrite/);
  assert.match(reviewCss, /writing-review-summary/);
  assert.match(reviewCss, /review-criteria/);
  assert.match(rewriteCss, /writing-rewrite-mission/);

  assert.doesNotThrow(() => new Function(
    `(function(){${model}\n${ui}\n${actions}\n${diagnostic}\n${reviewer}\n${rewrite}\n})();`,
  ));
});