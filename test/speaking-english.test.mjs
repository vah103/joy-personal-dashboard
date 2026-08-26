import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendPath = resolve(root, "project-data/vocabulary/vocabulary-library-tools.js");
const stylesPath = resolve(root, "project-data/vocabulary/vocabulary-library-tools.css");
const workerPath = resolve(root, "worker/speaking-english.js");
const openAiPath = resolve(root, "worker/shared/openai-responses.js");
const routerPath = resolve(root, "worker/router.js");
const vocabularyLoaderPath = resolve(root, "src/features/vocabulary/vocabulary-loader.js");
const wranglerPath = resolve(root, "wrangler.jsonc");

const [frontend, styles, worker, openAi, router, vocabularyLoader, wrangler] = await Promise.all([
  readFile(frontendPath, "utf8"),
  readFile(stylesPath, "utf8"),
  readFile(workerPath, "utf8"),
  readFile(openAiPath, "utf8"),
  readFile(routerPath, "utf8"),
  readFile(vocabularyLoaderPath, "utf8"),
  readFile(wranglerPath, "utf8"),
]);

test("Say it lives inside Saved Words and keeps Hear in the browser", () => {
  assert.match(frontend, /How do I say this\?/);
  assert.match(frontend, /Make it English/);
  assert.match(frontend, /data-vocab-library-speaking-copy/);
  assert.match(frontend, /data-vocab-library-speaking-speak/);
  assert.match(frontend, /speechSynthesis/);
  assert.doesNotMatch(frontend, /localStorage|sessionStorage/);
  assert.doesNotMatch(worker, /INSERT INTO|UPDATE\s+\w+|DELETE FROM/i);
});

test("Say it supports four compact tones without conversation history", () => {
  for (const tone of ["natural", "casual", "polite", "work"]) {
    assert.match(frontend, new RegExp(`value="${tone}"`));
    assert.match(worker, new RegExp(tone));
  }
  assert.match(styles, /vocabulary-library-speaking-fields/);
  assert.doesNotMatch(worker, /previous_response_id|conversation/i);
});

test("Say it uses one cached gpt-4o-mini request capped at 60 tokens", () => {
  assert.match(worker, /DEFAULT_OPENAI_MODEL = "gpt-4o-mini"/);
  assert.match(worker, /OPENAI_SPEAKING_MODEL/);
  assert.match(worker, /maxOutputTokens:\s*60/);
  assert.match(worker, /readLanguageCache/);
  assert.match(worker, /writeLanguageCache/);
  assert.match(openAi, /store:\s*false/);
  assert.match(wrangler, /"OPENAI_SPEAKING_MODEL"\s*:\s*"gpt-4o-mini"/);
});

test("Say it preserves Workers AI as a one-call fallback", () => {
  assert.match(worker, /using Workers AI fallback/);
  assert.match(worker, /@cf\/meta\/llama-3\.2-3b-instruct/);
  assert.match(worker, /Return exactly one English sentence only/);
  assert.match(worker, /AI_DAILY_LIMIT_REACHED/);
  assert.match(router, /isSpeakingEnglishRoute\(pathname\)/);
});

test("Vocabulary loader loads the Saved Words Say it implementation without standalone Speaking assets", () => {
  assert.match(vocabularyLoader, /vocabulary-library-tools\.js\?v=joy-vocabulary-library-tools-v1/);
  assert.doesNotMatch(vocabularyLoader, /JoySpeakingLoader|project-data\/speaking\//);
});

test("Current Say it JavaScript files pass syntax checks", () => {
  for (const path of [frontendPath, workerPath, openAiPath, routerPath, vocabularyLoaderPath]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});