import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const modulePaths = [
  "src/pages/dashboard/app-config.js",
  "src/pages/dashboard/app-helpers.js",
  "src/pages/dashboard/app-state.js",
  "src/pages/dashboard/app-scratchpad.js",
  "src/pages/dashboard/app-communication.js",
  "src/pages/dashboard/app-render.js",
  "src/pages/dashboard/app-integrations.js",
  "src/pages/dashboard/app-actions.js",
  "src/pages/dashboard/app-sync.js",
  "src/pages/dashboard/app-bootstrap.js",
];

const read = (path) => readFile(resolve(root, path), "utf8");

test("dashboard app source is owned by ordered modules", async () => {
  const [html, build, runner, ...modules] = await Promise.all([
    read("src/pages/dashboard/index.html"),
    read("scripts/build.mjs"),
    read("scripts/run-tests.mjs"),
    ...modulePaths.map(read),
  ]);

  assert.match(html, /<script src="app\.js\?v=joy-dashboard-combined-v1" defer><\/script>/);
  assert.match(build, /dashboardAppSourceFiles/);
  assert.match(build, /writeFile\(resolve\(dist, "app\.js"\)/);
  assert.doesNotMatch(build, /resolve\(dashboardPage, "app\.js"\), "app\.js"/);
  assert.match(runner, /operating-system temp directory/);
  assert.doesNotMatch(runner, /resolve\(root, "src\/pages\/dashboard\/app\.js"\)/);
  await assert.rejects(access(resolve(root, "src/pages/dashboard/app.js")));

  let previousBuildIndex = -1;
  let previousRunnerIndex = -1;
  for (const path of modulePaths) {
    const filename = path.split("/").at(-1);
    const buildIndex = build.indexOf(`"${filename}"`);
    const runnerIndex = runner.indexOf(`"${path}"`);
    assert.ok(buildIndex > previousBuildIndex, `${filename} is out of build order`);
    assert.ok(runnerIndex > previousRunnerIndex, `${filename} is out of test order`);
    previousBuildIndex = buildIndex;
    previousRunnerIndex = runnerIndex;
  }

  modules.forEach((source, index) => {
    const lines = source.trimEnd().split("\n").length;
    assert.ok(lines <= 400, `${modulePaths[index]} is too large at ${lines} lines`);
  });
});

test("dashboard settings have one explicit owner", async () => {
  const sources = Object.fromEntries(await Promise.all(
    modulePaths.map(async (path) => [path, await read(path)]),
  ));
  const config = sources["src/pages/dashboard/app-config.js"];
  const state = sources["src/pages/dashboard/app-state.js"];

  assert.match(config, /window\.JoyDashboardConfig/);
  assert.match(state, /const DASHBOARD_CONFIG = window\.JoyDashboardConfig/);
  assert.doesNotMatch(state, /apps\.googleusercontent\.com|latitude=21\.0285|longitude=105\.8542/);
  for (const [path, source] of Object.entries(sources)) {
    if (path.endsWith("app-config.js")) continue;
    assert.doesNotMatch(source, /profileName:\s*"Vanh"|weather:\s*Object\.freeze/, `configuration leaked into ${path}`);
  }
});

test("Scratchpad lifecycle has one frontend owner", async () => {
  const sources = Object.fromEntries(await Promise.all(
    modulePaths.map(async (path) => [path, await read(path)]),
  ));
  const scratchpad = sources["src/pages/dashboard/app-scratchpad.js"];

  for (const functionName of [
    "loadScratchpadMeta",
    "saveScratchpadMeta",
    "loadScratchpad",
    "saveCloudScratchpad",
    "queueScratchpadSave",
    "syncCloudScratchpad",
  ]) {
    assert.match(scratchpad, new RegExp(`function ${functionName}\\b`));
    for (const [path, source] of Object.entries(sources)) {
      if (path.endsWith("app-scratchpad.js")) continue;
      assert.doesNotMatch(source, new RegExp(`function ${functionName}\\b`), `${functionName} leaked into ${path}`);
    }
  }
});

test("generated dashboard bundle retains key runtime contracts", async () => {
  const bundle = (await Promise.all(modulePaths.map(read))).join("\n\n");
  for (const contract of [
    "function render()",
    "async function backendRequest",
    "async function syncCloudProjects",
    "elements.quickAddForm.addEventListener",
    "document.addEventListener(\"visibilitychange\"",
  ]) {
    assert.ok(bundle.includes(contract), `Missing dashboard contract: ${contract}`);
  }
});
