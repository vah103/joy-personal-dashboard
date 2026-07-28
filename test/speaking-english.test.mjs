import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendPath = resolve(root, "project-data/speaking/speaking.js");
const stylesPath = resolve(root, "project-data/speaking/speaking.css");
const workerPath = resolve(root, "worker/speaking-english.js");
const routerPath = resolve(root, "worker/router.js");
const injectorPath = resolve(root, "scripts/inject-language-tools.mjs");
const projectHubPath = resolve(root, "src/features/project-hub/project-hub-performance.js");

const [frontend, styles, worker, router, injector, projectHub] = await Promise.all([
  readFile(frontendPath, "utf8"),
  readFile(stylesPath, "utf8"),
  readFile(workerPath, "utf8"),
  readFile(routerPath, "utf8"),
  readFile(injectorPath, "utf8"),
  readFile(projectHubPath, "utf8"),
]);

test("Say it tool translates one Vietnamese sentence without saving it", () => {
  assert.match(frontend, /How do I say this\?/);
  assert.match(frontend, /Vietnamese sentence/);
  assert.match(frontend, /Make it English/);
  assert.match(frontend, /data-speaking-copy/);
  assert.match(frontend, /data-speaking-speak/);
  assert.doesNotMatch(frontend, /localStorage|sessionStorage/);
  assert.doesNotMatch(worker, /INSERT INTO|UPDATE\s+\w+|DELETE FROM/i);
});

test("Speaking API returns exactly one natural English sentence", () => {
  assert.match(worker, /Return exactly one English sentence only/);
  assert.match(worker, /natural everyday spoken English/);
  assert.match(worker, /@cf\/meta\/llama-3\.2-3b-instruct/);
  assert.match(worker, /AI_DAILY_LIMIT_REACHED/);
  assert.match(router, /isSpeakingEnglishRoute\(pathname\)/);
});

test("Speaking assets load after Vocabulary without Project Hub coupling", () => {
  const vocabularyIndex = injector.indexOf("vocabulary.js?v=joy-vocabulary-v2");
  const speakingIndex = injector.indexOf("speaking.js?v=joy-speaking-v2");
  assert.ok(vocabularyIndex >= 0);
  assert.ok(speakingIndex > vocabularyIndex);
  assert.doesNotMatch(projectHub, /vocabulary|speaking/i);
  assert.match(styles, /\.speaking-modal/);
  assert.match(styles, /\.vocabulary-widget-actions/);
});

test("Speaking JavaScript files pass syntax checks", () => {
  for (const path of [frontendPath, workerPath, routerPath, injectorPath, projectHubPath]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
