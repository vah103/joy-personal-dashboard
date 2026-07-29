import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");
const routerSource = fs.readFileSync(new URL("../worker/router.js", import.meta.url), "utf8");
const syncSource = fs.readFileSync(new URL("../worker/task-sync.js", import.meta.url), "utf8");

test("worker exposes authenticated task API routes", () => {
  for (const route of [
    'pathname === "/api/tasks"',
    'pathname === "/api/tasks/complete"',
  ]) {
    assert.match(appSource, new RegExp(route.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&")));
  }
});

test("worker includes task API handlers", () => {
  for (const handler of [
    "async function listTasks",
    "async function addTask",
    "async function completeTask",
  ]) {
    assert.ok(appSource.includes(handler), `Missing ${handler}`);
  }
});

test("task imports use the deletion-aware sync route", () => {
  assert.ok(routerSource.includes('from "./task-sync.js"'));
  assert.ok(routerSource.includes("isTaskImportRoute(pathname)"));
  assert.ok(routerSource.includes("handleTaskImportRequest(request, env)"));
  assert.ok(syncSource.includes('const TASK_IMPORT_PATH = "/api/tasks/import"'));
  assert.ok(syncSource.includes("task_deletions"));
  assert.ok(!appSource.includes('pathname === "/api/tasks/import"'));
  assert.ok(!appSource.includes("async function importTasks"));
});
