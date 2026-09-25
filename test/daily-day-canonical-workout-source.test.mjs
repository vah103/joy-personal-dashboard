import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Afternoon always renders the canonical Morning workout for the same effective date", async () => {
  const editor = await source("scripts/build-daily-day-template-editor.mjs");

  assert.match(editor, /const rawEffectiveTemplateBlocks =/);
  assert.match(editor, /if \(id !== "afternoon"\) return ownBlocks/);
  assert.match(editor, /const morningBlocks = rawEffectiveTemplateBlocks\("morning", dateKey\)/);
  assert.match(editor, /const morningWorkoutIndex = morningBlocks\.findIndex/);
  assert.match(editor, /const afternoonWorkoutIndex = ownBlocks\.findIndex/);
  assert.match(editor, /ownBlocks\[afternoonWorkoutIndex\]\[2\] = morningBlocks\[morningWorkoutIndex\]\[2\]\.map\(\(item\) => String\(item\)\)/);
});

test("Morning and Afternoon keep independent schedule blocks", async () => {
  const editor = await source("scripts/build-daily-day-template-editor.mjs");
  assert.match(editor, /const ownBlocks = rawEffectiveTemplateBlocks\(id, dateKey\)/);
  assert.match(editor, /ownBlocks\[afternoonWorkoutIndex\]\[2\] =/);
  assert.doesNotMatch(editor, /ownBlocks\s*=\s*morningBlocks/);
});
