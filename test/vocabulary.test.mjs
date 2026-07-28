import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendPath = resolve(root, "project-data/vocabulary/vocabulary.js");
const stylesPath = resolve(root, "project-data/vocabulary/vocabulary.css");
const workerPath = resolve(root, "worker/vocabulary.js");
const routerPath = resolve(root, "worker/router.js");
const injectorPath = resolve(root, "scripts/inject-language-tools.mjs");
const projectHubPath = resolve(root, "src/features/project-hub/project-hub-performance.js");
const migrationPath = resolve(root, "migrations/20260728_vocabulary.sql");

const [frontend, styles, worker, router, injector, projectHub, migration] = await Promise.all([
  readFile(frontendPath, "utf8"),
  readFile(stylesPath, "utf8"),
  readFile(workerPath, "utf8"),
  readFile(routerPath, "utf8"),
  readFile(injectorPath, "utf8"),
  readFile(projectHubPath, "utf8"),
  readFile(migrationPath, "utf8"),
]);

test("Vocabulary replaces the visible Scratchpad with a vertical flashcard", () => {
  assert.match(frontend, /document\.querySelector\("\.scratchpad"\)/);
  assert.match(frontend, /scratchpad\.className = "vocabulary-widget"/);
  assert.match(frontend, /Translate into \$\{target\}/);
  assert.match(frontend, /data-vocab-practice-form/);
  assert.match(styles, /\.vocabulary-practice\s*\{[\s\S]*flex-direction:\s*column/);
});

test("Lookup returns one English word and one Vietnamese meaning", () => {
  assert.match(worker, /return exactly one best dictionary pair/i);
  assert.match(worker, /The English result must be one word only/i);
  assert.match(worker, /Never return alternatives/i);
  assert.match(worker, /\^\[a-z\]\+/);
  assert.match(frontend, /One best match found\./);
});

test("Vocabulary lookup uses structured output with a plain JSON retry", () => {
  assert.match(worker, /response_format:\s*\{[\s\S]*type:\s*"json_schema"/);
  assert.match(worker, /VOCABULARY_JSON_SCHEMA/);
  assert.match(worker, /retrying plain JSON/);
  assert.match(worker, /VOCABULARY_AI_FAILED/);
  assert.match(worker, /pathname === VOCABULARY_LOOKUP_PATH[\s\S]*return lookupVocabularyWord\(request, env\);[\s\S]*ensureVocabularySchema\(env\)/);
});

test("Vocabulary save and review routes use authenticated D1 storage", () => {
  assert.match(router, /isVocabularyRoute\(pathname\)/);
  assert.match(worker, /FROM vocabulary_words/);
  assert.match(worker, /INSERT INTO vocabulary_words/);
  assert.match(worker, /review_count = review_count \+ 1/);
  assert.match(migration, /UNIQUE \(user_email, english_key\)/);
});

test("Dashboard build loads Vocabulary independently from Project Hub", () => {
  assert.match(injector, /project-data\/vocabulary\/vocabulary\.css\?v=joy-vocabulary-v2/);
  assert.match(injector, /project-data\/vocabulary\/vocabulary\.js\?v=joy-vocabulary-v2/);
  assert.doesNotMatch(projectHub, /vocabulary|speaking/i);
});

test("Vocabulary JavaScript files pass syntax checks", () => {
  for (const path of [frontendPath, workerPath, routerPath, injectorPath, projectHubPath]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
