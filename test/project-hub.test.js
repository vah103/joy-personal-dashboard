import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("TurtleBot snapshot contains the complete roadmap", () => {
  const source = JSON.parse(read("project-data/turtlebot4/source.json"));
  assert.equal(source.project.id, "turtlebot4");
  assert.equal(source.roadmap.stages.length, 9);
  assert.ok(source.commands.commands.length >= 10);
  assert.ok(source.reports.length >= 1);
});

test("project hub exposes four working surfaces", () => {
  const core = read("project-hub-core.js");
  const render = read("project-hub-render.js");
  for (const tab of ["roadmap", "commands", "journal", "plan"]) {
    assert.ok(core.includes(`data-hub-tab=\"${tab}\"`));
  }
  for (const renderer of ["renderRoadmap", "renderCommands", "renderJournal", "renderPlan"]) {
    assert.ok(render.includes(`function ${renderer}`));
  }
});

test("worker router preserves the existing app and adds project hub APIs", () => {
  const router = read("worker/router.js");
  const worker = read("worker/project-hub.js");
  assert.ok(router.includes('import app from "./index.js"'));
  assert.ok(router.includes("app.fetch(request, env, ctx)"));
  assert.ok(worker.includes('pathname === "/api/turtlebot-source"'));
  assert.ok(worker.includes('pathname === "/api/project-hub"'));
  assert.ok(worker.includes("PROJECT_HUB_VERSION_CONFLICT"));
});

test("build includes project hub assets in order", () => {
  const build = read("scripts/build.mjs");
  const performanceIndex = build.indexOf("project-hub-performance.js");
  const coreIndex = build.indexOf("project-hub-core.js");
  const renderIndex = build.indexOf("project-hub-render.js");
  const actionsIndex = build.indexOf("project-hub-actions.js");
  assert.ok(performanceIndex >= 0 && coreIndex > performanceIndex);
  assert.ok(renderIndex > coreIndex && actionsIndex > renderIndex);
  assert.ok(build.includes("project-hub.css"));
  assert.ok(build.includes("project-data"));
});

test("project list observer cannot recurse through card text updates", () => {
  const guard = read("project-hub-performance.js");
  assert.ok(guard.includes('target.id === "project-list"'));
  assert.ok(guard.includes("subtree: false"));
  assert.ok(guard.includes("childList: true"));
});
