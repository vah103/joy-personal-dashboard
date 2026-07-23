import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");

test("worker exposes authenticated task API routes", () => {
  for (const route of [
    'pathname === "/api/tasks"',
    'pathname === "/api/tasks/import"',
    'pathname === "/api/tasks/complete"',
  ]) {
    assert.match(source, new RegExp(route.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&")));
  }
});

test("worker includes task API handlers", () => {
  for (const handler of [
    "async function listTasks",
    "async function addTask",
    "async function importTasks",
    "async function completeTask",
  ]) {
    assert.ok(source.includes(handler), `Missing ${handler}`);
  }
});
