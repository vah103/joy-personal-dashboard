import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cleanupPath = resolve(root, "project-data/turtlebot4/project-hub-tabs-cleanup.js");
const loaderPath = resolve(root, "src/features/project-hub/turtlebot-plan-loader.js");
const dashboardPath = resolve(root, "src/pages/dashboard/index.html");
const packagePath = resolve(root, "package.json");
const fontPath = resolve(root, "src/features/project-details/turtlebot-roadmap-font.css");

test("TurtleBot tabs sit in the header, remove Lab Journal and keep Commands empty", async () => {
  const [cleanup, loader, dashboard, packageSource, fontCss] = await Promise.all([
    readFile(cleanupPath, "utf8"),
    readFile(loaderPath, "utf8"),
    readFile(dashboardPath, "utf8"),
    readFile(packagePath, "utf8"),
    readFile(fontPath, "utf8"),
  ]);

  assert.doesNotThrow(() => new Function(cleanup));
  assert.match(cleanup, /journalButton\.remove\(\)/);
  assert.match(cleanup, /HUB_TABS\.splice\(journalTabIndex, 1\)/);
  assert.match(cleanup, /const order = \["plan", "roadmap", "schedule", "commands"\]/);
  assert.match(cleanup, /schedule: "12-Week Plan"/);
  assert.match(cleanup, /commands: "Commands"/);
  assert.match(cleanup, /header\.insertBefore\(nav, actions \|\| null\)/);
  assert.match(cleanup, /turtlebot-hub-header-with-tabs/);
  assert.match(cleanup, /hubElements\.body\.innerHTML = ""/);
  assert.doesNotMatch(cleanup, /renderCommands\(\)/);
  assert.match(loader, /project-hub-tabs-cleanup\.js\?v=turtlebot-inline-tabs-v2/);
  assert.match(dashboard, /turtlebot-plan-loader\.js\?v=turtlebot-plan-loader-v1/);
  assert.doesNotMatch(packageSource, /cache-bust-turtlebot-plan/);
  assert.match(fontCss, /grid-template-columns: max-content minmax\(0, 1fr\) max-content/);
  assert.match(fontCss, /grid-template-rows: auto minmax\(0, 1fr\)/);
});
