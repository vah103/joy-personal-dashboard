import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendPath = resolve(root, "project-data/vocabulary/vocabulary.js");
const compactFrontendPath = resolve(root, "project-data/vocabulary/vocabulary-compact.js");
const libraryFrontendPath = resolve(root, "project-data/vocabulary/vocabulary-library.js");
const libraryToolsPath = resolve(root, "project-data/vocabulary/vocabulary-library-tools.js");
const mobileInlinePath = resolve(root, "project-data/vocabulary/vocabulary-mobile-inline.js");
const compactStylesPath = resolve(root, "project-data/vocabulary/vocabulary-compact.css");
const libraryStylesPath = resolve(root, "project-data/vocabulary/vocabulary-library.css");
const workerPath = resolve(root, "worker/vocabulary.js");
const openAiPath = resolve(root, "worker/shared/openai-responses.js");
const routerPath = resolve(root, "worker/router.js");
const loaderPath = resolve(root, "src/features/vocabulary/vocabulary-loader.js");
const migrationPath = resolve(root, "migrations/20260728_vocabulary.sql");
const wranglerPath = resolve(root, "wrangler.jsonc");

const [
  frontend,
  compactFrontend,
  libraryFrontend,
  libraryTools,
  mobileInline,
  compactStyles,
  libraryStyles,
  worker,
  openAi,
  router,
  loader,
  migration,
  wrangler,
] = await Promise.all([
  readFile(frontendPath, "utf8"),
  readFile(compactFrontendPath, "utf8"),
  readFile(libraryFrontendPath, "utf8"),
  readFile(libraryToolsPath, "utf8"),
  readFile(mobileInlinePath, "utf8"),
  readFile(compactStylesPath, "utf8"),
  readFile(libraryStylesPath, "utf8"),
  readFile(workerPath, "utf8"),
  readFile(openAiPath, "utf8"),
  readFile(routerPath, "utf8"),
  readFile(loaderPath, "utf8"),
  readFile(migrationPath, "utf8"),
  readFile(wranglerPath, "utf8"),
]);

test("Vocabulary keeps flashcards and Saved Words owns contextual lookup", () => {
  assert.match(frontend, /document\.querySelector\("\[data-vocabulary-widget\]"\)/);
  assert.doesNotMatch(frontend, /\.scratchpad|scratchpad\./i);
  assert.match(libraryTools, /name="context"/);
  assert.match(libraryTools, /Context <small>optional<\/small>/);
  assert.match(libraryTools, /renderMeanings/);
});

test("Vocabulary outside card keeps Practice while lookup and Say it live in Saved Words", () => {
  assert.match(compactFrontend, /data-vocab-practice-root="desktop"/);
  assert.match(compactFrontend, /vocabulary-compact-card/);
  assert.match(compactFrontend, /data-vocab-open-practice/);
  assert.doesNotMatch(compactFrontend, /data-vocab-open-lookup/);
  assert.doesNotMatch(compactFrontend, /data-speaking-open/);
  assert.doesNotMatch(compactFrontend, /data-vocab-practice-form|Your answer|Show answer|Check/);
  assert.match(frontend, /data-vocab-practice-root="mobile"/);
  assert.match(frontend, /data-vocab-practice-form/);
  assert.match(frontend, /data-vocab-show-answer/);
  assert.match(libraryTools, /toolButton\("lookup", "Look up"/);
  assert.match(libraryTools, /toolButton\("say", "Say it"/);
  assert.match(compactStyles, /\.vocabulary-compact-meta/);
  assert.match(compactStyles, /cursor:\s*pointer/);
  assert.match(compactStyles, /-webkit-line-clamp:\s*2/);
});

test("Vocabulary practice rotates through word and example-context prompts while answers stay words", () => {
  assert.match(frontend, /function availableDirections\(word\)/);
  assert.match(frontend, /directions = \["vi-en", "en-vi"\]/);
  assert.match(frontend, /directions\.push\("vi-example-en"\)/);
  assert.match(frontend, /directions\.push\("en-example-vi"\)/);
  assert.match(frontend, /Vietnamese example → English word/);
  assert.match(frontend, /English example → Vietnamese word/);
  assert.match(frontend, /prompt:\s*word\.exampleVietnamese[\s\S]*expected:\s*word\.english/);
  assert.match(frontend, /prompt:\s*word\.example[\s\S]*expected:\s*word\.vietnamese/);
  assert.match(frontend, /vocabulary-prompt\$\{config\.isExample \? " is-example" : ""\}/);
});

test("Vocabulary top bar opens a clean six-column editable saved-word library", () => {
  assert.match(libraryFrontend, /\.vocabulary-compact-topline/);
  assert.match(libraryFrontend, /event\.target\.closest\("button"\)/);
  assert.match(libraryFrontend, /vocabulary-library-table/);
  assert.match(libraryFrontend, />English</);
  assert.match(libraryFrontend, />IPA</);
  assert.match(libraryFrontend, />Vietnamese reading</);
  assert.match(libraryFrontend, />Vietnamese meaning</);
  assert.match(libraryFrontend, />English example</);
  assert.match(libraryFrontend, />Vietnamese example</);
  assert.match(libraryFrontend, /data-vocab-library-add/);
  assert.doesNotMatch(libraryFrontend, /data-vocab-library-save-row/);
  assert.doesNotMatch(libraryFrontend, />Save<\/button>/);
  assert.match(libraryFrontend, /document\.addEventListener\("change", handleFieldChange\)/);
  assert.match(libraryFrontend, /Changes save automatically/);
  assert.match(libraryFrontend, /data-vocab-field="english"/);
  assert.match(libraryFrontend, /data-vocab-field="ipa"/);
  assert.match(libraryFrontend, /data-vocab-field="pronunciationVi"/);
  assert.match(libraryFrontend, /data-vocab-field="vietnamese"/);
  assert.match(libraryFrontend, /data-vocab-field="example"/);
  assert.match(libraryFrontend, /data-vocab-field="exampleVietnamese"/);
  assert.match(libraryStyles, /min-width:\s*1320px/);
  assert.match(libraryStyles, /position:\s*sticky/);
  assert.match(libraryStyles, /font:\s*750 17px\/1\.5/);
  assert.match(libraryStyles, /font-size:\s*12px/);
  assert.doesNotMatch(libraryStyles, /vocabulary-library-row-actions/);
});

test("Vocabulary library auto-saves manual inserts and persistent edits through the existing D1 route", () => {
  assert.match(libraryFrontend, /handleFieldChange/);
  assert.match(libraryFrontend, /await saveRow\(row\)/);
  assert.match(libraryFrontend, /word\.operation = "update"/);
  assert.match(libraryFrontend, /exampleVietnamese:\s*fieldValue\(row, "exampleVietnamese"\)/);
  assert.match(libraryFrontend, /Complete all six columns/);
  assert.match(libraryFrontend, /method:\s*"POST"/);
  assert.match(libraryFrontend, /row\.dataset\.saving/);
  assert.match(worker, /allowManual:\s*true/);
  assert.match(worker, /body\.operation === "update"/);
  assert.match(worker, /updateVocabularyWord/);
  assert.match(worker, /UPDATE vocabulary_words/);
  assert.match(worker, /english_key = \?/);
  assert.match(worker, /VOCABULARY_WORD_EXISTS/);
  assert.match(worker, /updated:\s*true/);
  assert.match(worker, /serializeExample\(word\)/);
  assert.match(worker, /parseStoredExample/);
});

test("Narrow layouts clone the compact launcher and preserve the real practice modal", () => {
  assert.match(mobileInline, /data-vocab-mobile-launcher/);
  assert.match(mobileInline, /cloneNode\(true\)/);
  assert.match(mobileInline, /vocabulary-compact-card-mobile/);
  assert.match(mobileInline, /practiceModal = document\.querySelector\("\[data-vocab-practice-modal\]"\)/);
  assert.doesNotMatch(mobileInline, /removeAttribute\("role"\)/);
  assert.doesNotMatch(mobileInline, /delete\s+mobilePractice\.dataset\.vocabPracticeModal/);
  assert.doesNotMatch(mobileInline, /insertAdjacentElement\("afterend",\s*mobilePractice\)/);
  assert.doesNotMatch(mobileInline, /data-vocab-practice-inline/);
});

test("Vocabulary uses one cached OpenAI request with a strict token cap", () => {
  assert.match(worker, /DEFAULT_OPENAI_MODEL = "gpt-5-mini"/);
  assert.match(worker, /OPENAI_VOCABULARY_MODEL/);
  assert.match(worker, /maxOutputTokens:\s*220/);
  assert.match(worker, /reasoningEffort:\s*"minimal"/);
  assert.match(worker, /verbosity:\s*"low"/);
  assert.match(worker, /readLanguageCache/);
  assert.match(worker, /writeLanguageCache/);
  assert.match(openAi, /store:\s*false/);
  assert.match(openAi, /max_output_tokens/);
  assert.match(openAi, /text\.format/);
  assert.doesNotMatch(worker, /retrying plain JSON/i);
  assert.match(wrangler, /"OPENAI_VOCABULARY_MODEL"\s*:\s*"gpt-5-mini"/);
});

test("Vocabulary returns one contextual meaning or at most two common meanings", () => {
  assert.match(worker, /const maxMeanings = context \? 1 : 2/);
  assert.match(worker, /one or two most useful meanings, separated only by a semicolon/);
  assert.match(worker, /exactly one meaning that fits the supplied context/);
  assert.match(worker, /exampleVietnamese/);
});

test("Vocabulary uses saved data first and Workers AI only as fallback", () => {
  assert.match(worker, /findSavedVocabularyResult/);
  assert.match(worker, /provider:\s*"saved"/);
  assert.match(worker, /using Workers AI fallback/);
  assert.match(worker, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);
  assert.match(router, /isVocabularyRoute\(pathname\)/);
});

test("Vocabulary save and review routes retain authenticated D1 storage", () => {
  assert.match(worker, /FROM vocabulary_words/);
  assert.match(worker, /INSERT INTO vocabulary_words/);
  assert.match(worker, /review_count = review_count \+ 1/);
  assert.match(migration, /UNIQUE \(user_email, english_key\)/);
});

test("Dashboard loader cache-busts the current Vocabulary assets only", () => {
  assert.match(loader, /vocabulary-compact\.css\?v=joy-vocabulary-compact-v2/);
  assert.match(loader, /vocabulary-practice-redesign\.css\?v=joy-vocabulary-practice-redesign-v3/);
  assert.match(loader, /vocabulary-library\.css\?v=joy-vocabulary-library-v4/);
  assert.match(loader, /vocabulary-library-tools\.css\?v=joy-vocabulary-library-tools-v1/);
  assert.match(loader, /vocabulary\.js\?v=joy-vocabulary-v3/);
  assert.match(loader, /vocabulary-compact\.js\?v=joy-vocabulary-compact-v4/);
  assert.match(loader, /vocabulary-library\.js\?v=joy-vocabulary-library-v3/);
  assert.match(loader, /vocabulary-library-tools\.js\?v=joy-vocabulary-library-tools-v1/);
  assert.match(loader, /vocabulary-mobile-inline\.js\?v=joy-vocabulary-mobile-inline-v3/);
  assert.doesNotMatch(loader, /vocabulary-openai|vocabulary-result-size|vocabulary-modal-fit|project-data\/speaking/);
});

test("Vocabulary JavaScript files pass syntax checks", () => {
  for (const path of [
    frontendPath,
    compactFrontendPath,
    libraryFrontendPath,
    libraryToolsPath,
    mobileInlinePath,
    workerPath,
    openAiPath,
    routerPath,
    loaderPath,
  ]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
