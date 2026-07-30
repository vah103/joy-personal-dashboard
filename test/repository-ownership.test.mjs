import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");

async function listJavaScriptFiles(directory) {
  const base = resolve(root, directory);
  const entries = await readdir(base, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => resolve(entry.parentPath || entry.path, entry.name));
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("TurtleBot current progress has one stable canonical owner", async () => {
  const loader = await read("src/features/project-hub/turtlebot-plan-loader.js");
  const currentState = JSON.parse(await read("project-data/turtlebot4/current-state.json"));
  const merger = await read("project-data/turtlebot4/project-current-state.js");

  assert.equal(currentState.project.currentStageId, "stage-4");
  assert.match(loader, /project-current-state\.js/);
  assert.doesNotMatch(loader, /progress-\d{8}\.js/);
  assert.doesNotMatch(merger, /setTimeout|pageshow|localStorage/);
  await assert.rejects(access(resolve(root, "project-data/turtlebot4/progress-20260730.js")));
});

test("public dashboard source contains no private Google Sheet identifier", async () => {
  const html = await read("src/pages/dashboard/index.html");
  assert.doesNotMatch(html, /docs\.google\.com\/spreadsheets|13rVL8-vBNpwOTntCTjNhU31TzxCAFRujRH0X4AfqNx4/);
  assert.match(html, /data-finance-open/);
});

test("Daily Brief stylesheet is owned directly by dashboard HTML", async () => {
  const html = await read("src/pages/dashboard/index.html");
  const build = await read("scripts/build.mjs");

  assert.match(html, /<link rel="stylesheet" href="daily-brief\.css\?v=joy-daily-brief-v5">/);
  assert.doesNotMatch(html, /daily-brief-polish\.js/);
  assert.doesNotMatch(build, /daily-brief-polish\.js/);
  await assert.rejects(access(resolve(root, "src/features/greeting/daily-brief-polish.js")));
});

test("D1 table ownership stays in migrations instead of Worker requests", async () => {
  const migration = await read("migrations/20260731_canonical_runtime_schema.sql");
  for (const table of [
    "task_deletions",
    "task_reminders",
    "focus_reminders",
    "daily_brief_meta",
    "daily_brief_stories",
    "finance_p1008",
    "finance_p1008_shopping",
    "google_integrations",
    "ielts_core_states",
    "ielts_notification_state",
    "project_hubs",
    "vocabulary_words",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }

  for (const path of await listJavaScriptFiles("worker")) {
    const source = stripComments(await readFile(path, "utf8"));
    assert.doesNotMatch(source, /CREATE\s+(?:TABLE|INDEX)\s+IF\s+NOT\s+EXISTS/i, path);
  }
});

test("dashboard data routes have a dedicated runtime owner", async () => {
  const router = await read("worker/router.js");
  const module = await read("worker/dashboard-data.js");

  assert.match(router, /from "\.\/dashboard-data\.js"/);
  assert.match(router, /isDashboardDataRoute\(pathname\)/);
  for (const route of [
    "/api/projects",
    "/api/scratchpad",
    "/api/tasks",
  ]) {
    assert.match(module, new RegExp(route.replaceAll("/", "\\/")));
  }
});
