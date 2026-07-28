import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cleanupPath = resolve(root, "project-data/turtlebot4/project-hub-tabs-cleanup.js");
const loaderPath = resolve(root, "src/features/project-hub/project-hub-performance.js");
const cacheBustPath = resolve(root, "scripts/cache-bust-turtlebot-plan.mjs");

test("TurtleBot tabs remove Lab Journal and keep Commands empty after the plan", async () => {
  const [cleanup, loader, cacheBust] = await Promise.all([
    readFile(cleanupPath, "utf8"),
    readFile(loaderPath, "utf8"),
    readFile(cacheBustPath, "utf8"),
  ]);

  assert.doesNotThrow(() => new Function(cleanup));
  assert.match(cleanup, /journalButton\.remove\(\)/);
  assert.match(cleanup, /HUB_TABS\.splice\(journalTabIndex, 1\)/);
  assert.match(cleanup, /const order = \["plan", "roadmap", "schedule", "commands"\]/);
  assert.match(cleanup, /schedule: "12-Week Plan"/);
  assert.match(cleanup, /commands: "Commands"/);
  assert.match(cleanup, /hubElements\.body\.innerHTML = ""/);
  assert.doesNotMatch(cleanup, /renderCommands\(\)/);
  assert.match(loader, /project-hub-tabs-cleanup\.js\?v=turtlebot-tabs-cleanup-v1/);
  assert.match(cacheBust, /turtlebot-tabs-cleanup-v3/);
});
