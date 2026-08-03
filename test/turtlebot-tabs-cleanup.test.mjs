import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cleanupPath = resolve(root, "project-data/turtlebot4/project-hub-tabs-cleanup.js");
const commandsPath = resolve(root, "project-data/turtlebot4/commands-docs.json");
const loaderPath = resolve(root, "src/features/project-hub/turtlebot-plan-loader.js");
const dashboardPath = resolve(root, "src/pages/dashboard/index.html");
const packagePath = resolve(root, "package.json");
const fontPath = resolve(root, "src/features/project-details/turtlebot-roadmap-font.css");

const expectedCommandIds = [
  "connect-lab",
  "connect-remote",
  "preflight-check",
  "dock",
  "undock",
  "slam",
  "slam-rviz",
  "teleop",
  "save-map",
  "localization",
  "navigation-rviz",
  "nav2",
];

test("TurtleBot tabs show only commands synchronized from the Google Docs Command tab", async () => {
  const [cleanup, commandsSource, loader, dashboard, packageSource, fontCss] = await Promise.all([
    readFile(cleanupPath, "utf8"),
    readFile(commandsPath, "utf8"),
    readFile(loaderPath, "utf8"),
    readFile(dashboardPath, "utf8"),
    readFile(packagePath, "utf8"),
    readFile(fontPath, "utf8"),
  ]);
  const commands = JSON.parse(commandsSource);

  assert.doesNotThrow(() => new Function(cleanup));
  assert.match(cleanup, /journalButton\.remove\(\)/);
  assert.match(cleanup, /HUB_TABS\.splice\(journalTabIndex, 1\)/);
  assert.match(cleanup, /const order = \["plan", "roadmap", "schedule", "commands"\]/);
  assert.match(cleanup, /schedule: "12-Week Plan"/);
  assert.match(cleanup, /commands: "Commands"/);
  assert.match(cleanup, /header\.insertBefore\(nav, actions \|\| null\)/);
  assert.match(cleanup, /turtlebot-hub-header-with-tabs/);
  assert.match(cleanup, /mergedCommands = docsOnlyCommands/);
  assert.match(cleanup, /commands-docs\.json\?v=turtlebot-doc-commands-v1/);
  assert.match(cleanup, /data-hub-action="add-command"/);
  assert.match(cleanup, /data-hub-action="edit-command"/);
  assert.doesNotMatch(cleanup, /renderEmptyCommands/);
  assert.doesNotMatch(cleanup, /hubElements\.body\.innerHTML = ""/);

  assert.equal(commands.source, "google-doc-command-tab");
  assert.deepEqual(commands.commands.map((command) => command.id), expectedCommandIds);
  assert.equal(commands.commands.length, 12);
  assert.ok(commands.commands.every((command) => ["Dell laptop", "TurtleBot Raspberry Pi"].includes(command.runOn)));
  assert.match(commands.commands.find((command) => command.id === "preflight-check").code, /ros2 topic hz \/bot1\/scan/);
  assert.doesNotMatch(commandsSource, /start-lidar|lifecycle-reset|run-stage3-benchmark/);

  assert.match(loader, /project-hub-tabs-cleanup\.js\?v=turtlebot-doc-commands-v1/);
  assert.match(dashboard, /turtlebot-plan-loader\.js\?v=turtlebot-plan-loader-v2/);
  assert.doesNotMatch(packageSource, /cache-bust-turtlebot-plan/);
  assert.match(fontCss, /grid-template-columns: max-content minmax\(0, 1fr\) max-content/);
  assert.match(fontCss, /grid-template-rows: auto minmax\(0, 1fr\)/);
});
