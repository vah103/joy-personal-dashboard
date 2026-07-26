import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const taskEvents = fs.readFileSync(
  new URL("../src/features/tasks/task-reminders-events.js", import.meta.url),
  "utf8",
);
const build = fs.readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("the visible task checkbox toggles the real input", () => {
  assert.ok(taskEvents.includes('event.target.closest?.(".checkmark")'));
  assert.ok(taskEvents.includes("event.stopImmediatePropagation()"));
  assert.ok(taskEvents.includes("input.checked = !input.checked"));
  assert.ok(taskEvents.includes('input.dispatchEvent(new Event("change", { bubbles: true }))'));
});

test("the checkbox fix is cache-busted in the Cloudflare build", () => {
  assert.ok(build.includes('task-reminders-events.js?v=joy-task-checkbox-v2'));
});
