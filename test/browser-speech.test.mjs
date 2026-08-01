import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const speechPath = resolve(root, "project-data/shared/browser-speech.js");
const loaderPath = resolve(root, "src/features/vocabulary/vocabulary-loader.js");

const [speech, loader] = await Promise.all([
  readFile(speechPath, "utf8"),
  readFile(loaderPath, "utf8"),
]);

test("Browser speech handles both Vocabulary and Say it controls", () => {
  assert.match(speech, /data-vocab-speak/);
  assert.match(speech, /data-speaking-speak/);
  assert.match(speech, /stopImmediatePropagation/);
  assert.match(speech, /speechSynthesis/);
  assert.match(speech, /SpeechSynthesisUtterance/);
});

test("Browser speech primes English voices and retries silent Chromium starts", () => {
  assert.match(speech, /voiceschanged/);
  assert.match(speech, /chooseEnglishVoice/);
  assert.match(speech, /en-US/);
  assert.match(speech, /synth\.cancel\(\)/);
  assert.match(speech, /window\.setTimeout\(\(\) => \{/);
  assert.match(speech, /synth\.resume\(\)/);
  assert.match(speech, /runAttempt\(null, 1\)/);
  assert.match(speech, /No English browser voice is available/);
});

test("Vocabulary loader cache-busts and loads browser speech before Vocabulary", () => {
  assert.match(loader, /browser-speech\.js\?v=joy-browser-speech-v1/);
  assert.match(loader, /function loadBrowserSpeech\(\)/);
  assert.match(loader, /loadBrowserSpeech\(\);/);
  assert.match(loader, /script\.addEventListener\("load", loadVocabulary/);
  assert.match(loader, /script\.addEventListener\("error", loadVocabulary/);
});

test("Browser speech and loader JavaScript pass syntax checks", () => {
  for (const path of [speechPath, loaderPath]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});