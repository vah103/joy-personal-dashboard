import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("workout edits are shared between morning and afternoon templates", async () => {
  const editor = await source("scripts/build-daily-day-template-editor.mjs");

  assert.match(editor, /const SHARED_WORKOUT_TEMPLATE_IDS = Object\.freeze\(\["morning", "afternoon"\]\)/);
  assert.match(editor, /return templateId === "morning" \? "afternoon" : "morning"/);
  assert.match(editor, /const workoutBlockIndexFor =/);
  assert.match(editor, /peerBlocks\[peerBlockIndex\]\[2\] = items\.map\(\(item\) => String\(item\)\)/);
  assert.match(editor, /persistTemplateVersion\(peerId, effectiveFrom, peerBlocks\)/);
  assert.match(editor, /syncSharedWorkoutTemplate\(\{/);
  assert.match(editor, /clearWorkoutOverridesForTemplateEdit\(\{\s*dateKey: effectiveFrom,\s*templateId: peerId/);
  assert.doesNotMatch(editor, /SHARED_WORKOUT_TEMPLATE_IDS = Object\.freeze\(\["morning", "afternoon", "no_workout"\]\)/);
});
