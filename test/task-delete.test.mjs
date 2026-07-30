import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browserSource = fs.readFileSync(new URL("../todo-visibility.js", import.meta.url), "utf8");
const dashboardSource = fs.readFileSync(new URL("../src/pages/dashboard/app.js", import.meta.url), "utf8");
const routerSource = fs.readFileSync(new URL("../worker/router.js", import.meta.url), "utf8");
const deleteSource = fs.readFileSync(new URL("../worker/task-delete.js", import.meta.url), "utf8");
const syncSource = fs.readFileSync(new URL("../worker/task-sync.js", import.meta.url), "utf8");
const schemaSource = fs.readFileSync(new URL("../worker/shared/schema.js", import.meta.url), "utf8");

test("to-do history exposes a confirmed delete control", () => {
  assert.ok(browserSource.includes('className = "task-delete-button"'));
  assert.ok(browserSource.includes("root.confirm"));
  assert.ok(browserSource.includes('TASK_DELETE_ENDPOINT = "/api/tasks/delete"'));
  assert.ok(browserSource.includes("removeTaskFromLocalStorage(id)"));
  assert.ok(browserSource.includes('button.closest("#task-history-modal")'));
});

test("task history decoration cannot trigger an infinite mutation loop", () => {
  assert.ok(browserSource.includes('if (row.querySelector(".task-delete-button")) return;'));
  assert.ok(!browserSource.includes(
    'history.querySelectorAll(".task-delete-button").forEach((button) => button.remove())',
  ));
});

test("pending task deletions cannot be re-imported by the same browser", () => {
  assert.ok(browserSource.includes("TODO_PENDING_DELETIONS_KEY"));
  assert.ok(browserSource.includes("filteredTaskPayload"));
  assert.ok(browserSource.includes("withoutPendingTaskDeletions"));
  assert.ok(dashboardSource.includes("withoutPendingDeletions(state.tasks)"));
  assert.ok(dashboardSource.includes("withoutPendingDeletions(cloudTasks)"));
  assert.doesNotMatch(browserSource, /root\.fetch\s*=/);
});

test("router protects imports and deletion with dedicated task sync handlers", () => {
  assert.ok(routerSource.includes('from "./task-delete.js"'));
  assert.ok(routerSource.includes('from "./task-sync.js"'));
  assert.ok(routerSource.includes("isTaskDeleteRoute(pathname)"));
  assert.ok(routerSource.includes("isTaskImportRoute(pathname)"));
});

test("deleted task ids are tombstoned so stale devices cannot restore them", () => {
  assert.ok(schemaSource.includes("CREATE TABLE IF NOT EXISTS task_deletions"));
  assert.ok(deleteSource.includes("CREATE_TASK_DELETIONS_TABLE"));
  assert.ok(deleteSource.includes("INSERT INTO task_deletions"));
  assert.ok(deleteSource.includes("DELETE FROM tasks"));
  assert.ok(deleteSource.includes("WHERE id = ? AND user_email = ?"));

  assert.ok(syncSource.includes("CREATE_TASK_DELETIONS_TABLE"));
  assert.ok(syncSource.includes("WHERE NOT EXISTS"));
  assert.ok(syncSource.includes("FROM task_deletions"));
  assert.ok(syncSource.includes("WHERE user_email = ? AND task_id = ?"));
});

test("task deletion and protected import remain authenticated", () => {
  for (const source of [deleteSource, syncSource]) {
    assert.ok(source.includes("AUTH_REQUIRED"));
    assert.ok(source.includes("INVALID_ORIGIN"));
  }
});
