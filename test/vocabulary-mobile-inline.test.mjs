import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobilePath = resolve(root, "project-data/vocabulary/vocabulary-mobile-inline.js");
const frontendPath = resolve(root, "project-data/vocabulary/vocabulary.js");
const loaderPath = resolve(root, "src/features/vocabulary/vocabulary-loader.js");

const [mobile, frontend, loader] = await Promise.all([
  readFile(mobilePath, "utf8"),
  readFile(frontendPath, "utf8"),
  readFile(loaderPath, "utf8"),
]);

test("Narrow layouts place a compact Vocabulary launcher below the daily brief", () => {
  assert.match(mobile, /document\.querySelector\("\.top-widgets"\)/);
  assert.match(mobile, /insertAdjacentElement\("afterend", launcher\)/);
  assert.match(mobile, /data-vocab-mobile-launcher/);
  assert.match(mobile, /cloneNode\(true\)/);
  assert.match(mobile, /vocabulary-compact-card-mobile/);
  assert.match(mobile, /max-width: \$\{MOBILE_BREAKPOINT\}px/);
});

test("The compact Practice control opens the preserved modal instead of an inline form", () => {
  assert.match(frontend, /data-vocab-open-practice/);
  assert.match(frontend, /openPracticeModal\(\)/);
  assert.match(mobile, /practiceModal = document\.querySelector\("\[data-vocab-practice-modal\]"\)/);
  assert.doesNotMatch(mobile, /scrollIntoView/);
  assert.doesNotMatch(mobile, /stopImmediatePropagation/);
  assert.doesNotMatch(mobile, /removeAttribute\("role"\)/);
  assert.doesNotMatch(mobile, /data-vocab-practice-inline/);
});

test("Vocabulary mobile enhancement loads after the Saved Words tools", () => {
  const toolsIndex = loader.indexOf("vocabulary-library-tools.js");
  const mobileIndex = loader.indexOf("vocabulary-mobile-inline.js");
  assert.ok(toolsIndex >= 0);
  assert.ok(mobileIndex > toolsIndex);
  assert.match(loader, /loadScript\(SCRIPTS\.libraryTools, loadMobileInline/);
  assert.doesNotMatch(loader, /JoySpeakingLoader|loadSpeaking/);
});

test("Vocabulary mobile JavaScript files pass syntax checks", () => {
  for (const path of [mobilePath, frontendPath, loaderPath]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});