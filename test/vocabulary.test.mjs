import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = {
  frontend: resolve(root, "project-data/vocabulary/vocabulary.js"),
  chatFrontend: resolve(root, "project-data/vocabulary/vocabulary-chat-response.js"),
  libraryFrontend: resolve(root, "project-data/vocabulary/vocabulary-library.js"),
  compactFrontend: resolve(root, "project-data/vocabulary/vocabulary-compact.js"),
  mobileInline: resolve(root, "project-data/vocabulary/vocabulary-mobile-inline.js"),
  compactStyles: resolve(root, "project-data/vocabulary/vocabulary-compact.css"),
  extraStyles: resolve(root, "project-data/vocabulary/vocabulary-openai.css"),
  chatStyles: resolve(root, "project-data/vocabulary/vocabulary-chat-response.css"),
  libraryStyles: resolve(root, "project-data/vocabulary/vocabulary-library.css"),
  worker: resolve(root, "worker/vocabulary.js"),
  openAi: resolve(root, "worker/shared/openai-responses.js"),
  router: resolve(root, "worker/router.js"),
  loader: resolve(root, "src/features/vocabulary/vocabulary-loader.js"),
  migration: resolve(root, "migrations/20260728_vocabulary.sql"),
  wrangler: resolve(root, "wrangler.jsonc"),
};

const contents = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, "utf8")]),
));

test("Vocabulary lookup keeps context and a readable two-column workspace", () => {
  assert.match(contents.frontend, /document\.querySelector\("\.scratchpad"\)/);
  assert.match(contents.frontend, /scratchpad\.className = "vocabulary-widget"/);
  assert.match(contents.frontend, /name="context"/);
  assert.match(contents.frontend, /optional · use this for the exact meaning/);
  assert.match(contents.extraStyles, /width:\s*min\(1120px, calc\(100vw - 48px\)\)/);
  assert.match(contents.extraStyles, /grid-template-columns:\s*minmax\(320px, 0\.8fr\) minmax\(0, 1\.2fr\)/);
  assert.match(contents.extraStyles, /font-family:\s*"Nunito"/);
  assert.match(contents.extraStyles, /@media \(max-width: 900px\)/);
});

test("ChatGPT answer is concise and Vietnamese input teaches the English equivalent", () => {
  assert.match(contents.worker, /answerMarkdown/);
  assert.match(contents.worker, /concise English vocabulary tutor/);
  assert.match(contents.worker, /under 140 Vietnamese words/);
  assert.match(contents.worker, /Treat it only as a source meaning to translate/);
  assert.match(contents.worker, /Every sentence after the opening line must explain that selected English word or phrase/);
  assert.match(contents.worker, /Do not define the Vietnamese entry/);
  assert.match(contents.worker, /translate the Vietnamese entry into the best natural English equivalent/);
  assert.match(contents.chatFrontend, /data-vocab-chat-response/);
  assert.match(contents.chatFrontend, /ChatGPT answer/);
  assert.match(contents.chatFrontend, /Save as flashcard/);
  assert.match(contents.chatFrontend, /renderMarkdown/);
  assert.match(contents.chatStyles, /font-family:\s*"Nunito"/);
});

test("Meanings are flexible and Vietnamese pronunciation is phonetic", () => {
  assert.match(contents.worker, /MAX_MEANINGS = 6/);
  assert.match(contents.worker, /const maxMeanings = context \? 1 : MAX_MEANINGS/);
  assert.match(contents.worker, /Choose the number of meanings naturally/);
  assert.match(contents.worker, /Approximate Vietnamese phonetic spelling/);
  assert.match(contents.worker, /pronunciationVi must never be a translation/);
  assert.match(contents.worker, /sameLooseText/);
  assert.match(contents.chatFrontend, /renderFlexibleFlashcard/);
  assert.match(contents.chatFrontend, /Vietnamese pronunciation/);
  assert.match(contents.chatFrontend, /\.slice\(0, 6\)/);
});

test("Saved words library and flashcards use the same API source", () => {
  assert.match(contents.libraryFrontend, /const API_ROOT = "\/api\/vocabulary"/);
  assert.match(contents.libraryFrontend, /Every saved entry belongs to the flashcard deck/);
  assert.match(contents.libraryFrontend, /Flashcards use this same saved list/);
  assert.match(contents.libraryFrontend, /data-vocab-library-search/);
  assert.match(contents.libraryFrontend, /data-vocab-library-practice/);
  assert.match(contents.libraryFrontend, /reviewCount/);
  assert.match(contents.libraryFrontend, /correctCount/);
  assert.match(contents.libraryFrontend, /vocabulary-library-table/);
  assert.match(contents.libraryStyles, /\.vocabulary-library-modal/);
  assert.match(contents.libraryStyles, /@media \(max-width: 760px\)/);
  assert.match(contents.worker, /FROM vocabulary_words/);
  assert.match(contents.worker, /INSERT INTO vocabulary_words/);
  assert.match(contents.worker, /review_count = review_count \+ 1/);
  assert.match(contents.migration, /UNIQUE \(user_email, english_key\)/);
});

test("Compact card opens the library from Words without a duplicate Library button", () => {
  assert.match(contents.compactFrontend, /class="vocabulary-compact-title"[^>]*data-vocab-open-library/);
  assert.match(contents.compactFrontend, /<strong>Words<\/strong>/);
  assert.doesNotMatch(contents.compactFrontend, />Library<\/button>/);
  assert.match(contents.compactFrontend, /data-speaking-open/);
  assert.match(contents.compactFrontend, /data-vocab-open-lookup/);
  assert.match(contents.compactFrontend, /data-vocab-open-practice/);
  assert.match(contents.compactStyles, /\.vocabulary-compact-title\s*\{/);
  assert.match(contents.compactStyles, /background:\s*transparent/);
  assert.match(contents.compactStyles, /white-space:\s*nowrap/);
  assert.doesNotMatch(contents.compactStyles, /@container \(max-width: 220px\)/);
});

test("Mobile launcher preserves the real practice modal", () => {
  assert.match(contents.frontend, /data-vocab-practice-root="mobile"/);
  assert.match(contents.frontend, /data-vocab-practice-form/);
  assert.match(contents.frontend, /data-vocab-show-answer/);
  assert.match(contents.mobileInline, /data-vocab-mobile-launcher/);
  assert.match(contents.mobileInline, /cloneNode\(true\)/);
  assert.match(contents.mobileInline, /vocabulary-compact-card-mobile/);
  assert.match(contents.mobileInline, /practiceModal = document\.querySelector\("\[data-vocab-practice-modal\]"\)/);
  assert.doesNotMatch(contents.mobileInline, /data-vocab-practice-inline/);
});

test("Vocabulary AI remains bounded, cached and routed through the Worker", () => {
  assert.match(contents.worker, /OPENAI_MODEL = "gpt-5-mini"/);
  assert.match(contents.worker, /OPENAI_VOCABULARY_MODEL/);
  assert.match(contents.worker, /CACHE_VERSION = "v6-flexible-meanings-phonetic"/);
  assert.match(contents.worker, /maxOutputTokens:\s*600/);
  assert.match(contents.worker, /reasoningEffort:\s*"minimal"/);
  assert.match(contents.worker, /verbosity:\s*"low"/);
  assert.match(contents.worker, /readLanguageCache/);
  assert.match(contents.worker, /writeLanguageCache/);
  assert.match(contents.openAi, /store:\s*false/);
  assert.match(contents.openAi, /max_output_tokens/);
  assert.match(contents.openAi, /text\.format/);
  assert.match(contents.router, /isVocabularyRoute\(pathname\)/);
  assert.match(contents.wrangler, /"OPENAI_VOCABULARY_MODEL"\s*:\s*"gpt-5-mini"/);
});

test("Dashboard loader installs the current vocabulary assets", () => {
  assert.match(contents.loader, /vocabulary-chat-response\.js\?v=joy-vocabulary-chat-v4/);
  assert.match(contents.loader, /vocabulary-library\.css\?v=joy-vocabulary-library-v1/);
  assert.match(contents.loader, /vocabulary-library\.js\?v=joy-vocabulary-library-v1/);
  assert.match(contents.loader, /vocabulary-compact\.css\?v=joy-vocabulary-compact-v4/);
  assert.match(contents.loader, /vocabulary-compact\.js\?v=joy-vocabulary-compact-v4/);
  assert.match(contents.loader, /loadChatResponse/);
  assert.match(contents.loader, /loadVocabularyCore/);
  assert.match(contents.loader, /loadLibrary/);
  assert.match(contents.loader, /vocabulary-mobile-inline\.js\?v=joy-vocabulary-mobile-inline-v3/);
});

test("Vocabulary JavaScript files pass syntax checks", () => {
  for (const path of [
    paths.frontend,
    paths.chatFrontend,
    paths.libraryFrontend,
    paths.compactFrontend,
    paths.mobileInline,
    paths.worker,
    paths.openAi,
    paths.router,
    paths.loader,
  ]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
