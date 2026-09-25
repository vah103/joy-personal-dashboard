import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("one-time repair copies today's morning workout into afternoon", async () => {
  const editor = await source("scripts/build-daily-day-template-editor.mjs");

  assert.match(editor, /MANUAL_WORKOUT_SYNC_KEY = "joy-daily-day-manual-workout-sync-20260925-v1"/);
  assert.match(editor, /const morningBlocks = effectiveTemplateBlocks\("morning", effectiveFrom\)/);
  assert.match(editor, /const afternoonBlocks = effectiveTemplateBlocks\("afternoon", effectiveFrom\)/);
  assert.match(editor, /afternoonBlocks\[afternoonWorkoutIndex\]\[2\] = morningItems\.map\(\(item\) => String\(item\)\)/);
  assert.match(editor, /persistTemplateVersion\("afternoon", effectiveFrom, afternoonBlocks\)/);
  assert.match(editor, /templateId: "afternoon"/);
  assert.match(editor, /structural: true/);
  assert.match(editor, /localStorage\.setItem\(MANUAL_WORKOUT_SYNC_KEY, "1"\)/);
  assert.match(editor, /setTimeout\(syncAfternoonWorkoutFromMorningOnce, 1500\)/);
});
