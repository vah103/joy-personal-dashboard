import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = await readFile(resolve(root, "project-data/vocabulary/vocabulary-practice-redesign.js"), "utf8");
const styles = await readFile(resolve(root, "project-data/vocabulary/vocabulary-practice-redesign.css"), "utf8");
const loader = await readFile(resolve(root, "src/features/vocabulary/vocabulary-loader.js"), "utf8");

test("Vocabulary practice modal removes the visible Vocabulary title and surfaces the saved-word count", () => {
  assert.match(script, /#vocabulary-mobile-title'\)\?\.remove\(\)/);
  assert.match(script, /setAttribute\('aria-label', 'Quick practice'\)/);
  assert.match(script, /dataset\.vocabPracticeCount/);
  assert.match(script, /MutationObserver\(syncPracticeHeader\)/);
  assert.match(script, /\.vocabulary-widget-heading small/);
});

test("Vocabulary practice modal uses the approved open flashcard layout", () => {
  assert.match(styles, /\[data-vocab-practice-root="mobile"\][\s\S]*border:\s*0/);
  assert.match(styles, /\.vocabulary-widget-heading[\s\S]*display:\s*none/);
  assert.match(styles, /\.vocabulary-answer-form[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 112px/);
  assert.match(styles, /\.vocabulary-prompt[\s\S]*font-size:\s*clamp\(26px, 4vw, 34px\)/);
  assert.match(styles, /\.vocabulary-practice-actions[\s\S]*margin-top:\s*auto/);
  assert.doesNotMatch(styles, /Tap to open/i);
});

test("Dashboard loader cache-busts the practice redesign assets", () => {
  assert.match(loader, /vocabulary-practice-redesign\.css\?v=joy-vocabulary-practice-redesign-v1/);
  assert.match(loader, /vocabulary-practice-redesign\.js\?v=joy-vocabulary-practice-redesign-v1/);
  assert.match(loader, /loadPracticeRedesign/);
});
