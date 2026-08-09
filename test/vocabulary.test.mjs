import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendPath = resolve(root, "project-data/vocabulary/vocabulary.js");
const chatFrontendPath = resolve(root, "project-data/vocabulary/vocabulary-chat-response.js");
const libraryFrontendPath = resolve(root, "project-data/vocabulary/vocabulary-library.js");
const compactFrontendPath = resolve(root, "project-data/vocabulary/vocabulary-compact.js");
const mobileInlinePath = resolve(root, "project-data/vocabulary/vocabulary-mobile-inline.js");
const compactStylesPath = resolve(root, "project-data/vocabulary/vocabulary-compact.css");
const extraStylesPath = resolve(root, "project-data/vocabulary/vocabulary-openai.css");
const chatStylesPath = resolve(root, "project-data/vocabulary/vocabulary-chat-response.css");
const libraryStylesPath = resolve(root, "project-data/vocabulary/vocabulary-library.css");
const workerPath = resolve(root, "worker/vocabulary.js");
const openAiPath = resolve(root, "worker/shared/openai-responses.js");
const routerPath = resolve(root, "worker/router.js");
const loaderPath = resolve(root, "src/features/vocabulary/vocabulary-loader.js");
const migrationPath = resolve(root, "migrations/20260728_vocabulary.sql");
const wranglerPath = resolve(root, "wrangler.jsonc");

const [
  frontend,
  chatFrontend,
  libraryFrontend,
  compactFrontend,
  mobileInline,
  compactStyles,
  extraStyles,
  chatStyles,
  libraryStyles,
  worker,
  openAi,
  router,
  loader,
  migration,
  wrangler,
] = await Promise.all([
  readFile(frontendPath, "utf8"),
  readFile(chatFrontendPath, "utf8"),
  readFile(libraryFrontendPath, "utf8"),
  readFile(compactFrontendPath, "utf8"),
  readFile(mobileInlinePath, "utf8"),
  readFile(compactStylesPath, "utf8"),
  readFile(extraStylesPath, "utf8"),
  readFile(chatStylesPath, "utf8"),
  readFile(libraryStylesPath, "utf8"),
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

test("Vocabulary lookup uses a wide readable two-column workspace", () => {
  assert.match(extraStyles, /width:\s*min\(1120px, calc\(100vw - 48px\)\)/);
  assert.match(extraStyles, /grid-template-columns:\s*minmax\(320px, 0\.8fr\) minmax\(0, 1\.2fr\)/);
  assert.match(extraStyles, /grid-template-areas:[\s\S]*"form status"[\s\S]*"form result"/);
  assert.match(extraStyles, /font-family:\s*"Nunito"/);
  assert.match(extraStyles, /Your vocabulary result will appear here/);
  assert.match(extraStyles, /@media \(max-width: 900px\)/);
});

test("Vocabulary displays a natural ChatGPT answer before the saveable flashcard", () => {
  assert.match(worker, /answerMarkdown/);
  assert.match(worker, /concise English vocabulary tutor/);
  assert.match(worker, /under 140 Vietnamese words/);
  assert.match(worker, /VOCABULARY_TUTOR_INSTRUCTIONS/);
  assert.match(chatFrontend, /\/api\/vocabulary\/lookup/);
  assert.match(chatFrontend, /response\.clone\(\)\.json\(\)/);
  assert.match(chatFrontend, /data-vocab-chat-response/);
  assert.match(chatFrontend, /ChatGPT answer/);
  assert.match(chatFrontend, /Save as flashcard/);
  assert.match(chatFrontend, /renderMarkdown/);
  assert.match(chatFrontend, /escapeHtml/);
  assert.match(chatStyles, /\.vocabulary-chat-response/);
  assert.match(chatStyles, /font-family:\s*"Nunito"/);
});

test("Vietnamese lookup teaches the selected English equivalent", () => {
  assert.match(worker, /Treat it only as a source meaning to translate/);
  assert.match(worker, /Every sentence after the opening line must explain that selected English word or phrase/);
  assert.match(worker, /Do not define the Vietnamese entry/);
  assert.match(worker, /translate the Vietnamese entry into the best natural English equivalent/);
  assert.match(worker, /inputLanguageFor/);
});

test("Meanings are flexible and Vietnamese pronunciation is phonetic", () => {
  assert.match(worker, /MAX_MEANINGS = 6/);
  assert.match(worker, /const maxMeanings = context \? 1 : MAX_MEANINGS/);
  assert.match(worker, /Choose the number of meanings naturally/);
  assert.match(worker, /a flexible number of useful common meanings separated by semicolons/);
  assert.match(worker, /Approximate Vietnamese phonetic spelling/);
  assert.match(worker, /pronunciationVi must never be a translation/);
  assert.match(worker, /sameLooseText/);
  assert.match(chatFrontend, /renderFlexibleFlashcard/);
  assert.match(chatFrontend, /Vietnamese pronunciation/);
  assert.match(chatFrontend, /\.slice\(0, 6\)/);
});

test("Saved words appear in one searchable library used by the flashcard deck", () => {
  assert.match(libraryFrontend, /const API_ROOT = "\/api\/vocabulary"/);
  assert.match(libraryFrontend, /Every saved entry belongs to the flashcard deck/);
  assert.match(libraryFrontend, /Flashcards use this same saved list/);
  assert.match(libraryFrontend, /data-vocab-library-search/);
  assert.match(libraryFrontend, /data-vocab-library-practice/);
  assert.match(libraryFrontend, /reviewCount/);
  assert.match(libraryFrontend, /correctCount/);
  assert.match(libraryFrontend, /vocabulary-library-table/);
  assert.match(compactFrontend, /data-vocab-open-library/);
  assert.match(libraryStyles, /\.vocabulary-library-modal/);
  assert.match(libraryStyles, /\.vocabulary-library-table/);
  assert.match(libraryStyles, /@media \(max-width: 760px\)/);
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
  assert.doesNotMatch(mobileInline, /data-vocab-practice-inline/);
});

test("Vocabulary uses one cached OpenAI request with a concise bounded response", () => {
  assert.match(worker, /OPENAI_MODEL = "gpt-5-mini"/);
  assert.match(worker, /OPENAI_VOCABULARY_MODEL/);
  assert.match(worker, /CACHE_VERSION = "v6-flexible-meanings-phonetic"/);
  assert.match(worker, /maxOutputTokens:\s*600/);
  assert.match(worker, /reasoningEffort:\s*"minimal"/);
  assert.match(worker, /verbosity:\s*"low"/);
  assert.match(worker, /readLanguageCache/);
  assert.match(worker, /writeLanguageCache/);
  assert.match(openAi, /store:\s*false/);
  assert.match(openAi, /max_output_tokens/);
  assert.match(openAi, /text\.format/);
  assert.match(wrangler, /"OPENAI_VOCABULARY_MODEL"\s*:\s*"gpt-5-mini"/);
});

test("Saved words still receive an AI explanation and retain their flashcard identity", () => {
  assert.match(worker, /const saved = context \? null : await savedWord/);
  assert.match(worker, /lookupPayload\(cachedResult, saved/);
  assert.match(worker, /lookupPayload\(normalized, saved/);
  assert.match(worker, /alreadySaved:\s*Boolean\(saved\)/);
  assert.match(worker, /id:\s*saved\.id/);
  assert.match(worker, /if \(saved\) return json\(\{ word: saved, answerMarkdown: savedAnswer/);
  assert.match(worker, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);
  assert.match(router, /isVocabularyRoute\(pathname\)/);
});

test("Already-saved results hide duplicate save controls after GPT refreshes the answer", () => {
  assert.match(chatFrontend, /latestAlreadySaved/);
  assert.match(chatFrontend, /Already saved — GPT refreshed the explanation/);
  assert.match(chatFrontend, /saveActions\.hidden = true/);
  assert.match(chatFrontend, /Saved flashcard/);
});

test("Vocabulary save and review routes retain authenticated D1 storage", () => {
  assert.match(worker, /FROM vocabulary_words/);
  assert.match(worker, /INSERT INTO vocabulary_words/);
  assert.match(worker, /review_count = review_count \+ 1/);
  assert.match(migration, /UNIQUE \(user_email, english_key\)/);
});

test("Dashboard loader installs ChatGPT response, library, compact card and mobile launcher", () => {
  assert.match(loader, /vocabulary-chat-response\.css\?v=joy-vocabulary-chat-v2/);
  assert.match(loader, /vocabulary-chat-response\.js\?v=joy-vocabulary-chat-v4/);
  assert.match(loader, /vocabulary-library\.css\?v=joy-vocabulary-library-v1/);
  assert.match(loader, /vocabulary-library\.js\?v=joy-vocabulary-library-v1/);
  assert.match(loader, /loadChatResponse/);
  assert.match(loader, /loadVocabularyCore/);
  assert.match(loader, /loadLibrary/);
  assert.match(loader, /vocabulary-openai\.css\?v=joy-vocabulary-openai-v2/);
  assert.match(loader, /vocabulary-compact\.css\?v=joy-vocabulary-compact-v2/);
  assert.match(loader, /vocabulary\.js\?v=joy-vocabulary-v2/);
  assert.match(loader, /vocabulary-compact\.js\?v=joy-vocabulary-compact-v3/);
  assert.match(loader, /vocabulary-mobile-inline\.js\?v=joy-vocabulary-mobile-inline-v3/);
});

test("Vocabulary JavaScript files pass syntax checks", () => {
  for (const path of [frontendPath, chatFrontendPath, libraryFrontendPath, compactFrontendPath, mobileInlinePath, workerPath, openAiPath, routerPath, loaderPath]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
