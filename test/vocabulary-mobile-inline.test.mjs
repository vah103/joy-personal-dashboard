import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobilePath = resolve(root, "project-data/vocabulary/vocabulary-mobile-inline.js");
const loaderPath = resolve(root, "src/features/project-hub/project-hub-performance.js");

const [mobile, loader] = await Promise.all([
  readFile(mobilePath, "utf8"),
  readFile(loaderPath, "utf8"),
]);

test("Vocabulary practice becomes an inline mobile card below the daily brief", () => {
  assert.match(mobile, /document\.querySelector\("\.top-widgets"\)/);
  assert.match(mobile, /insertAdjacentElement\("afterend", mobilePractice\)/);
  assert.match(mobile, /mobilePractice\.className = "vocabulary-mobile-inline"/);
  assert.match(mobile, /max-width: 760px/);
});

test("The Words navigation control scrolls to the inline card instead of opening a modal", () => {
  assert.match(mobile, /data-vocab-open-practice/);
  assert.match(mobile, /scrollIntoView/);
  assert.match(mobile, /stopImmediatePropagation/);
});

test("Vocabulary mobile enhancement loads before the Say it integration", () => {
  const mobileIndex = loader.indexOf("vocabulary-mobile-inline.js");
  const speakingIndex = loader.indexOf("loadSpeaking();", mobileIndex);
  assert.ok(mobileIndex >= 0);
  assert.ok(speakingIndex > mobileIndex);
});

test("Vocabulary mobile JavaScript files pass syntax checks", () => {
  for (const path of [mobilePath, loaderPath]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
