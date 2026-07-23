import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeProjectInput,
  projectRowToApi,
} from "../worker/account-sync.js";

test("normalizes an active project", () => {
  const result = normalizeProjectInput({
    id: "project-1",
    name: "TurtleBot 4",
    focus: "Localization",
    next: "Run Nav2 test",
    progress: 38,
    accent: "blue",
    createdAt: "2026-07-23T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.project.id, "project-1");
  assert.equal(result.project.progress, 38);
  assert.equal(result.project.accent, "blue");
});

test("rejects an incomplete project", () => {
  const result = normalizeProjectInput({
    id: "project-2",
    name: "",
    focus: "Focus",
    next: "Next",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "INVALID_PROJECT_NAME");
});

test("maps a D1 project row to the browser shape", () => {
  const project = projectRowToApi({
    id: "p3",
    name: "VNU Test",
    focus: "Reading",
    next_action: "Finish Part 2",
    progress: 60,
    accent: "slate",
    archived: 0,
    created_at: 1784764800000,
    updated_at: 1784764800000,
  });

  assert.equal(project.next, "Finish Part 2");
  assert.equal(project.archived, false);
});

test("worker exposes authenticated project routes", () => {
  const source = fs.readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");
  for (const route of [
    'pathname === "/api/projects"',
    'pathname === "/api/projects/import"',
    'pathname === "/api/projects/archive"',
  ]) {
    assert.ok(source.includes(route), `Missing ${route}`);
  }
  for (const handler of [
    "async function listProjects",
    "async function addProject",
    "async function importProjects",
    "async function archiveProject",
  ]) {
    assert.ok(source.includes(handler), `Missing ${handler}`);
  }
});

test("frontend syncs project create and archive operations", () => {
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(source.includes("async function syncCloudProjects"));
  assert.ok(source.includes('backendRequest("/api/projects"'));
  assert.ok(source.includes('backendRequest("/api/projects/archive"'));
  assert.ok(source.includes("clearProjectArchive(id)"));
});
