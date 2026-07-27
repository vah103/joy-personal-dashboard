import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ieltsDir = resolve(root, "project-data", "ielts");

const bundledSources = [
  "ielts-core-model.js",
  "ielts-core-ui.js",
  "ielts-core-actions.js",
  "ielts-core-diagnostic.js",
  "ielts-core-writing-review.js",
  "ielts-core-writing-review-freshness.js",
];

const standaloneSources = [
  "ielts-card.js",
  "ielts-core-writing-rewrite.js",
];

const bundledParts = await Promise.all(
  bundledSources.map((file) => readFile(resolve(ieltsDir, file), "utf8")),
);

const bundle = [
  "(function validateIeltsAugustCore() {",
  ...bundledParts,
  "})();",
].join("\n");

try {
  // Compile only. The function is intentionally not executed in Node.
  new Function(bundle);

  for (const file of standaloneSources) {
    const source = await readFile(resolve(ieltsDir, file), "utf8");
    new Function(source);
  }
} catch (error) {
  console.error("IELTS frontend validation failed before build.");
  throw error;
}

console.log("IELTS frontend sources validated");
