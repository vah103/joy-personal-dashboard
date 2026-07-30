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
  "src/features/ielts/README.md",
];

const removedDuplicates = [
  "project-data/ielts/ielts-card.js",
  "project-data/ielts/ielts-core-model.js",
  "project-data/ielts/ielts-core-ui.js",
  "project-data/ielts/ielts-core-actions.js",
];

test("IELTS JavaScript has one feature-source location", () => {
  sourceFiles.forEach((path) => assert.equal(exists(path), true, `${path} should exist`));
  removedDuplicates.forEach((path) => assert.equal(exists(path), false, `${path} should not be committed`));
});

test("IELTS public project data remains available", () => {
  [
    "project-data/ielts/program-2026.json",
    "project-data/ielts/ielts-card.css",
    "project-data/ielts/ielts-core.css",
    "project-data/ielts/README.md",
  ].forEach((path) => assert.equal(exists(path), true, `${path} should remain public`));
});

test("legacy August Coach sources have been removed", () => {
  [
    "src/features/ielts/core-diagnostic.js",
    "src/features/ielts/core-writing-review.js",
    "src/features/ielts/core-writing-rewrite.js",
    "project-data/ielts/august-2026.json",
    "project-data/ielts/ielts-diagnostic.css",
    "worker/ielts-diagnostic-review.js",
  ].forEach((path) => assert.equal(exists(path), false, `${path} should be removed`));
});
