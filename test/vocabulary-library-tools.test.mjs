import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [tools, toolStyles, compact, loader] = await Promise.all([
  readFile(resolve(root, "project-data/vocabulary/vocabulary-library-tools.js"), "utf8"),
  readFile(resolve(root, "project-data/vocabulary/vocabulary-library-tools.css"), "utf8"),
  readFile(resolve(root, "project-data/vocabulary/vocabulary-compact.js"), "utf8"),
  readFile(resolve(root, "src/features/vocabulary/vocabulary-loader.js"), "utf8"),
]);

test("Saved Words owns both lookup and Say it tools", () => {
  assert.match(tools, /button\.dataset\.vocabLibraryTool = tool/);
  assert.match(tools, /toolButton\("lookup", "Look up"/);
  assert.match(tools, /toolButton\("say", "Say it"/);
  assert.match(tools, /dialog\.insertBefore\(tools, status\)/);
  assert.match(tools, /const VOCABULARY_API = "\/api\/vocabulary"/);
  assert.match(tools, /const SPEAKING_API = "\/api\/speaking\/english"/);
});

test("lookup can save directly to Saved Words and Say it stays inline", () => {
  assert.match(tools, /data-vocab-library-lookup-form/);
  assert.match(tools, /data-vocab-library-speaking-form/);
  assert.match(tools, /data-vocab-library-lookup-save/);
  assert.match(tools, /Save to Words/);
  assert.match(tools, /data-vocab-library-speaking-copy/);
  assert.match(tools, /data-vocab-library-speaking-speak/);
});

test("compact Vocabulary no longer exposes lookup or Say it outside the library", () => {
  assert.doesNotMatch(compact, /data-speaking-open/);
  assert.doesNotMatch(compact, /data-vocab-open-lookup/);
  assert.match(compact, /class="vocabulary-compact-topline" role="button" tabindex="0"/);
  assert.match(toolStyles, /\.vocabulary-widget \[data-vocab-open-lookup\]/);
});

test("loader cache-busts and loads the inline library tools", () => {
  assert.match(loader, /vocabulary-library-tools\.css\?v=joy-vocabulary-library-tools-v1/);
  assert.match(loader, /vocabulary-library-tools\.js\?v=joy-vocabulary-library-tools-v1/);
  assert.match(loader, /vocabulary-compact\.js\?v=joy-vocabulary-compact-v3/);
  assert.match(loader, /loadScript\(SCRIPTS\.libraryTools, loadMobileInline/);
});