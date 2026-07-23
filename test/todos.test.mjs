import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTaskInput, taskRowToApi, vietnamDateKey } from "../worker/todos.js";

test("normalizes a valid local task for D1", () => {
  const result = normalizeTaskInput({ id: "task-1", title: "  Buy milk  ", createdAt: "2026-07-23T01:00:00.000Z" });
  assert.equal(result.ok, true);
  assert.equal(result.task.title, "Buy milk");
  assert.equal(result.task.done, false);
});

test("rejects an empty task title", () => {
  assert.deepEqual(normalizeTaskInput({ id: "task-1", title: "   " }), { ok: false, error: "TASK_TITLE_REQUIRED" });
});

test("uses Vietnam date for task history", () => {
  assert.equal(vietnamDateKey(Date.parse("2026-07-22T18:30:00.000Z")), "2026-07-23");
});

test("maps a completed D1 row to the browser task shape", () => {
  const task = taskRowToApi({ id: "task-1", title: "Done", done: 1, created_at: 1784768400000, updated_at: 1784772000000 });
  assert.equal(task.done, true);
  assert.match(task.createdAt, /^2026-/);
  assert.match(task.completedAt, /^2026-/);
});
