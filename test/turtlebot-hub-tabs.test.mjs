import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tabsPath = resolve(root, "project-data/turtlebot4/project-hub-tabs-v1.js");
const buildPatchPath = resolve(root, "scripts/cache-bust-turtlebot-plan.mjs");
const tabsSource = await readFile(tabsPath, "utf8");
const buildPatchSource = await readFile(buildPatchPath, "utf8");

test("TurtleBot hub removes the Lab Journal tab", () => {
  assert.match(tabsSource, /data-hub-tab=\\?"journal\\?"/);
  assert.match(tabsSource, /journalButton\.remove\(\)/);
  assert.match(tabsSource, /HUB_TABS\.splice\(journalIndex, 1\)/);
});

test("Commands are placed immediately after the 12-week schedule tab", () => {
  assert.match(tabsSource, /data-hub-tab=\\?"schedule\\?"/);
  assert.match(tabsSource, /scheduleButton\.after\(commandsButton\)/);
});

test("Commands tab renders no inner content", () => {
  assert.match(tabsSource, /renderCommands = function renderEmptyCommands/);
  assert.match(tabsSource, /hubElements\.body\.replaceChildren\(\)/);
});

test("Cloudflare build loads the TurtleBot hub tab policy last", () => {
  assert.match(buildPatchSource, /project-hub-tabs-v1\.js\?v=turtlebot-hub-tabs-v1/);
  assert.match(buildPatchSource, /html\.replace\("<\/body>"/);
});

test("TurtleBot hub tab policy passes JavaScript syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", tabsPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
