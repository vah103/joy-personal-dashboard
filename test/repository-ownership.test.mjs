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

  assert.equal(currentState.project.currentStageId, "stage-5");
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

test("private project documents are removed from deploy artifacts", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const sanitizer = await read("scripts/sanitize-public-project-data.mjs");
  const runbook = await read("docs/privacy-history-rewrite.md");

  assert.match(packageJson.scripts.build, /sanitize-public-project-data\.mjs/);
  assert.match(sanitizer, /docs\\\.google\\\.com|PRIVATE_DOCUMENT_PATTERN/);
  assert.match(sanitizer, /googleDocUrl/);
  assert.match(runbook, /git filter-repo/);
  assert.match(runbook, /must not be performed as part of a normal feature PR/i);
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

test("verification smoke-tests migrations and deployment blocks pending remote schema", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const localCheck = await read("scripts/validate-d1-migrations.mjs");
  const remoteGate = await read("scripts/check-remote-d1-migrations.mjs");

  assert.match(packageJson.scripts.verify, /db:migrate:smoke/);
  assert.match(packageJson.scripts["deploy:current"], /db:migrate:check:remote/);
  assert.match(localCheck, /migrations[",\s]+"apply"/);
  assert.match(localCheck, /--local/);
  assert.match(remoteGate, /migrations[",\s]+"list"/);
  assert.match(remoteGate, /--remote/);
  assert.match(remoteGate, /Deployment has been stopped/);
});

test("dashboard data routes have one runtime owner", async () => {
  const router = await read("worker/router.js");
  const module = await read("worker/dashboard-data.js");
  const legacy = await read("worker/index.js");

  assert.match(router, /from "\.\/dashboard-data\.js"/);
  assert.match(router, /isDashboardDataRoute\(pathname\)/);
  for (const route of [
    "/api/projects",
    "/api/scratchpad",
    "/api/tasks",
  ]) {
    const pattern = new RegExp(route.replaceAll("/", "\\/"));
    assert.match(module, pattern);
    assert.doesNotMatch(legacy, pattern);
  }
  assert.doesNotMatch(legacy, /function (?:list|add|import|archive)Project|function (?:get|update)Scratchpad|function (?:list|add|complete)Task/);
  assert.doesNotMatch(legacy, /from "\.\/todos\.js"|from "\.\/account-sync\.js"/);
});

test("app shell cache version is derived from the deployed build", async () => {
  const build = await read("scripts/build.mjs");
  const serviceWorker = await read("src/pwa/sw.js");

  assert.match(build, /GITHUB_SHA|git", \["rev-parse", "HEAD"\]/);
  assert.match(build, /joy-build-/);
  assert.match(build, /joy-build-version/);
  assert.match(build, /versionAssetReference\(cloudflareHtml, "app\.js"\)/);
  assert.match(build, /service worker build version/);
  assert.match(serviceWorker, /__JOY_BUILD_VERSION__/);
  assert.doesNotMatch(serviceWorker, /joy-mobile-vocabulary-v2/);
});
