import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stylesPath = resolve(root, "project-data/vocabulary/vocabulary-modal-fit.css");
const loaderPath = resolve(root, "src/features/vocabulary/vocabulary-loader.js");

const [styles, loader] = await Promise.all([
  readFile(stylesPath, "utf8"),
  readFile(loaderPath, "utf8"),
]);

test("Vocabulary lookup popup fits inside desktop viewport", () => {
  assert.match(styles, /max-height:\s*calc\(100dvh - 24px\)/);
  assert.match(styles, /grid-template-rows:\s*auto auto minmax\(0, 1fr\)/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(styles, /\[data-vocab-lookup-result\][\s\S]*min-height:\s*0/);
  assert.match(styles, /\.vocabulary-result-card[\s\S]*max-height:\s*100%[\s\S]*overflow:\s*auto/);
});

test("Low-height desktop layout keeps save actions visible", () => {
  assert.match(styles, /@media \(min-width: 901px\) and \(max-height: 720px\)/);
  assert.match(styles, /padding:\s*18px 24px 16px/);
  assert.match(styles, /\.vocabulary-result-card dl > div[\s\S]*padding:\s*9px 0/);
  assert.match(styles, /\.vocabulary-save-actions[\s\S]*position:\s*sticky[\s\S]*bottom:\s*-12px/);
});

test("Vocabulary loader cache-busts viewport-fit styles", () => {
  assert.match(loader, /vocabulary-modal-fit\.css\?v=joy-vocabulary-modal-fit-v1/);
});
