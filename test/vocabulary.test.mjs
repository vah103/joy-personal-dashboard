import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendPath = resolve(root, "project-data/vocabulary/vocabulary.js");
const compactFrontendPath = resolve(root, "project-data/vocabulary/vocabulary-compact.js");
const mobileInlinePath = resolve(root, "project-data/vocabulary/vocabulary-mobile-inline.js");
const compactStylesPath = resolve(root, "project-data/vocabulary/vocabulary-compact.css");
const extraStylesPath = resolve(root, "project-data/vocabulary/vocabulary-openai.css");
const workerPath = resolve(root, "worker/vocabulary.js");
const openAiPath = resolve(root, "worker/shared/openai-responses.js");
const routerPath = resolve(root, "worker/router.js");
const loaderPath = resolve(root, "src/features/vocabulary/vocabulary-loader.js");
const migrationPath = resolve(root, "migrations/20260728_vocabulary.sql");
const wranglerPath = resolve(root, "wrangler.jsonc");

const [
  frontend,
  compactFrontend,
  mobileInline,
  compactStyles,
  extraStyles,
  worker,
  openAi,
  router,
  loader,
  migration,
  wrangler,
] = await Promise.all([
  readFile(frontendPath, "utf8"),
  readFile(compactFrontendPath, "utf8"),
  readFile(mobileInlinePath, "utf8"),
  readFile(compactStylesPath, "utf8"),
  readFile(extraStylesPath, "utf8"),
  readFile(workerPath, "utf8"),
  readFile(openAiPath, "utf8"),
  readFile(routerPath, "utf8"),
  readFile(loaderPath, "utf8"),
  readFile(migrationPath, "utf8"),
  readFile(wranglerPath, "utf8"),
]);

test("Vocabulary keeps flashcards and adds optional context", () => {
  assert.match(frontend, /document\.querySelector\("\.scratchpad"\)/);
  assert.match(frontend, /scratchpad\.className = "vocabulary-widget"/);
  assert.match(frontend, /name="context"/);
  assert.match(frontend, /optional · use this for the exact meaning/);
  assert.match(frontend, /renderMeanings/);
  assert.match(extraStyles, /\.vocabulary-context-field/);
});

test("Vocabulary outside card clearly opens full practice in the popup", () => {
  assert.match(compactFrontend, /data-vocab-practice-root="desktop"/);
  assert.match(compactFrontend, /vocabulary-compact-card/);
  assert.match(compactFrontend, /data-vocab-open-practice/);
  assert.match(compactFrontend, />Practice</);
  assert.match(compactFrontend, /Practice vocabulary and enter an answer/);
  assert.match(compactFrontend, /data-vocab-open-lookup/);
  assert.match(compactFrontend, /data-speaking-open/);
  assert.doesNotMatch(compactFrontend, /data-vocab-practice-form|Your answer|Show answer|Check/);
  assert.match(frontend, /data-vocab-practice-root="mobile"/);
  assert.match(frontend, /data-vocab-practice-form/);
  assert.match(frontend, /data-vocab-show-answer/);
  assert.match(compactStyles, /\.vocabulary-compact-meta/);
  assert.match(compactStyles, /cursor:\s*pointer/);
  assert.match(compactStyles, /-webkit-line-clamp:\s*2/);
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
  assert.match(frontend, /split\(\/\\s\*;\\s\*\//);
  assert.match(frontend, /\.slice\(0, 2\)/);
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

test("Dashboard loader cache-busts all Vocabulary assets", () => {
  assert.match(loader, /vocabulary-openai\.css\?v=joy-vocabulary-openai-v1/);
  assert.match(loader, /vocabulary-compact\.css\?v=joy-vocabulary-compact-v2/);
  assert.match(loader, /vocabulary\.js\?v=joy-vocabulary-v2/);
  assert.match(loader, /vocabulary-compact\.js\?v=joy-vocabulary-compact-v2/);
  assert.match(loader, /vocabulary-mobile-inline\.js\?v=joy-vocabulary-mobile-inline-v3/);
  assert.match(loader, /loadCompactCard/);
});

test("Vocabulary JavaScript files pass syntax checks", () => {
  for (const path of [
    frontendPath,
    compactFrontendPath,
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
