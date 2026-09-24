import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("editing today workout template clears stale per-day workout values", async () => {
  const editor = await source("scripts/build-daily-day-template-editor.mjs");

  assert.match(editor, /const clearWorkoutOverridesForTemplateEdit =/);
  assert.match(editor, /if \(dateKey !== todayKey\(\)\) return/);
  assert.match(editor, /const storageKey = "joy-daily-day-workout-values-v1"/);
  assert.match(editor, /const prefix = `\$\{templateId\}:\$\{blockIndex\}:`/);
  assert.match(editor, /sharedSync\?\.patch\?\.\(\{ type: "workout-value", date: dateKey, itemId: key, value: null \}\)/);
  assert.match(editor, /const structuralWorkoutEdit = Boolean\(workoutEdit && \(add \|\| !text\)\)/);
  assert.match(editor, /clearWorkoutOverridesForTemplateEdit\(\{/);
  assert.match(editor, /dateKey: effectiveFrom/);
  assert.match(editor, /joy-daily-day-v36/);
});
