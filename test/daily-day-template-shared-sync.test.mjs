import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Default day edits share the Daily Day mutation queue and apply from today forward", async () => {
  const [sync, editor] = await Promise.all([
    source("scripts/build-daily-day-sync.mjs"),
    source("scripts/build-daily-day-template-editor.mjs"),
  ]);

  assert.match(sync, /window\.JoyDailyDaySync = Object\.freeze\(\{ patch \}\)/);
  assert.match(editor, /const templateEditEffectiveDate = \(requestedDate\) => requestedDate < todayKey\(\) \? todayKey\(\) : requestedDate/);
  assert.match(editor, /const sharedSync = window\.JoyDailyDaySync/);
  assert.match(editor, /return sharedSync\.patch\(mutation\)/);
  assert.doesNotMatch(editor, /fetch\("\/api\/daily-day"/);
  assert.match(editor, /save\(data\);\s*syncTemplateVersion\(templateId, effectiveFrom, nextBlocks\)/);
  assert.match(editor, /renderMain\(\);\s*renderLibrary\(\);/);
  assert.match(editor, /joy-daily-day-v34/);
});
