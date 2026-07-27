import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const exists = (path) => fs.existsSync(new URL(path, root));

const sourceFiles = [
  "src/features/ielts/card.js",
  "src/features/ielts/core-model.js",
  "src/features/ielts/core-ui.js",
  "src/features/ielts/core-actions.js",
  "src/features/ielts/core-diagnostic.js",
  "src/features/ielts/core-writing-review.js",
  "src/features/ielts/core-writing-rewrite.js",
  "src/features/ielts/README.md",
];

const removedDuplicates = [
  "project-data/ielts/ielts-card.js",
  "project-data/ielts/ielts-core-model.js",
  "project-data/ielts/ielts-core-ui.js",
  "project-data/ielts/ielts-core-actions.js",
  "project-data/ielts/ielts-core-diagnostic.js",
  "project-data/ielts/ielts-core-writing-review.js",
  "project-data/ielts/ielts-core-writing-review-freshness.js",
  "project-data/ielts/ielts-core-writing-rewrite.js",
];

test("IELTS JavaScript has one feature-source location", () => {
  sourceFiles.forEach((path) => assert.equal(exists(path), true, `${path} should exist`));
  removedDuplicates.forEach((path) => assert.equal(exists(path), false, `${path} should not be committed`));
});

test("IELTS public project data remains available", () => {
  [
    "project-data/ielts/august-2026.json",
    "project-data/ielts/august-days-01-09.json",
    "project-data/ielts/august-days-10-16.json",
    "project-data/ielts/august-days-17-23.json",
    "project-data/ielts/august-days-24-31.json",
    "project-data/ielts/ielts-card-background.webp",
    "project-data/ielts/ielts-card.css",
    "project-data/ielts/ielts-core.css",
    "project-data/ielts/README.md",
  ].forEach((path) => assert.equal(exists(path), true, `${path} should remain public`));
});
