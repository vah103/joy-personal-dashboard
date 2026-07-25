import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browserSource = fs.readFileSync(new URL("../todo-visibility.js", import.meta.url), "utf8");
const routerSource = fs.readFileSync(new URL("../worker/router.js", import.meta.url), "utf8");
const workerSource = fs.readFileSync(new URL("../worker/task-delete.js", import.meta.url), "utf8");

test("to-do rows expose a confirmed delete control", () => {
  assert.ok(browserSource.includes('className = "task-delete-button"'));
  assert.ok(browserSource.includes("root.confirm"));
  assert.ok(browserSource.includes('TASK_DELETE_ENDPOINT = "/api/tasks/delete"'));
  assert.ok(browserSource.includes("removeTaskFromLocalStorage(id)"));
});

test("pending task deletions cannot be re-imported during sync", () => {
  assert.ok(browserSource.includes('url.pathname === "/api/tasks/import"'));
  assert.ok(browserSource.includes('url.pathname === "/api/tasks"'));
  assert.ok(browserSource.includes("TODO_PENDING_DELETIONS_KEY"));
  assert.ok(browserSource.includes("filteredTaskPayload"));
});

test("router handles authenticated permanent task deletion", () => {
  assert.ok(routerSource.includes('from "./task-delete.js"'));
  assert.ok(routerSource.includes("isTaskDeleteRoute(pathname)"));
  assert.ok(workerSource.includes("DELETE FROM tasks"));
  assert.ok(workerSource.includes("WHERE id = ? AND user_email = ?"));
  assert.ok(workerSource.includes("AUTH_REQUIRED"));
  assert.ok(workerSource.includes("INVALID_ORIGIN"));
});
