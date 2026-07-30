import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
function read(path) { return fs.readFileSync(new URL(path, root), "utf8"); }

test("IELTS dashboard card loads the organized Vietnamese August Coach, baseline and AI reviewer", () => {
  const build = read("scripts/build.mjs");
  const css = read("project-data/ielts/ielts-card.css");
  const diagnosticCss = read("project-data/ielts/ielts-diagnostic.css");
  const reviewCss = read("project-data/ielts/ielts-writing-review.css");
  const rewriteCss = read("project-data/ielts/ielts-writing-rewrite.css");
  const script = read("src/features/ielts/card.js");
  const actions = read("src/features/ielts/core-actions.js");
  const reviewer = read("src/features/ielts/core-writing-review.js");
  const rewrite = read("src/features/ielts/core-writing-rewrite.js");
  const image = new URL("../project-data/ielts/ielts-card-background.webp", import.meta.url);

  assert.ok(build.includes("project-data/ielts/ielts-card.css?v=ielts-card-v2"));
  assert.ok(build.includes("project-data/ielts/ielts-core.css?v=ielts-august-core-v3"));
  assert.ok(build.includes("project-data/ielts/ielts-diagnostic.css?v=ielts-baseline-v2"));
  assert.ok(build.includes("project-data/ielts/ielts-writing-review.css?v=ielts-writing-review-v1"));
  assert.ok(build.includes("project-data/ielts/ielts-writing-rewrite.css?v=ielts-writing-rewrite-v1"));
  assert.ok(build.includes("project-data/ielts/ielts-core-bundle.js?v=ielts-august-core-v8"));
  assert.ok(build.includes('"core-diagnostic.js"'));
  assert.ok(build.includes('"core-writing-review.js"'));
  assert.ok(build.includes('"core-writing-rewrite.js"'));
  assert.ok(build.includes('"i18n-vi-hooks.js"'));
  assert.ok(!build.includes("core-writing-review-freshness.js"));
  assert.ok(build.includes("project-data/ielts/ielts-card.js?v=ielts-card-v8"));
  assert.ok(build.includes('resolve(ieltsFeature, "card.js")'));
  assert.ok(fs.existsSync(image));
  assert.ok(fs.statSync(image).size > 50_000);

  assert.ok(css.includes('url("ielts-card-background.webp?v=ielts-card-v2")'));
  assert.ok(css.includes(".ielts-target-pill"));
  assert.ok(css.includes("@media (max-width: 720px)"));
  assert.ok(diagnosticCss.includes(".diagnostic-grid"));
  assert.ok(diagnosticCss.includes(".baseline-summary"));
  assert.ok(reviewCss.includes(".writing-review-summary"));
  assert.ok(reviewCss.includes(".review-criteria"));
  assert.ok(rewriteCss.includes(".writing-rewrite-mission"));

  assert.ok(script.includes('cardElement.classList.add("ielts-project-card")'));
  assert.ok(script.includes("Mục tiêu Band 7.0"));
  assert.ok(script.includes("Tăng tốc tháng 8 · Trợ lý IELTS cá nhân"));
  assert.ok(script.includes("TRỌNG TÂM HIỆN TẠI"));
  assert.ok(!script.includes("ielts-core-bundle.js?v="));
  assert.ok(!script.includes("REWRITE_SCRIPT"));
  assert.ok(!script.includes("ielts-core-writing-rewrite.js?v="));
  assert.ok(!script.includes("ielts-writing-rewrite.css?v="));
  assert.ok(script.includes('cardElement.addEventListener("click", openCoach, true)'));
  assert.ok(script.includes("window.JoyIELTS.open()"));
  assert.ok(script.includes('cardElement.classList.remove("project-card-has-details")'));
  assert.ok(!script.includes("ensureCoreStyles"));
  assert.ok(script.includes("window.JoyIELTS?.refreshCard?.()"));
  assert.ok(!actions.includes('closest?.(".project-card.ielts-project-card")'));
  assert.ok(!actions.includes("new MutationObserver"));
  assert.ok(actions.includes("refreshCard:updateCard"));
  assert.ok(script.includes("stopImmediatePropagation"));
  assert.ok(!actions.includes("stopImmediatePropagation"));
  assert.ok(reviewer.includes("withWritingReviewState"));
  assert.ok(reviewer.includes("enhanceWritingDiagnosticCard"));
  assert.ok(rewrite.includes("ensureWritingRewriteAssignment"));
});
