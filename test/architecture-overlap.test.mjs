import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

function resourcePaths(source, attribute) {
  const pattern = new RegExp(`${attribute}="([^"]+)"`, "g");
  return [...source.matchAll(pattern)].map((match) => match[1].split("?")[0]);
}

test("dashboard build declares every static resource once", () => {
  const build = read("scripts/build.mjs");
  const resourceDeclarations = [
    build.match(/const projectHubHead = \[[\s\S]*?\]\.join\(""\);/)?.[0] || "",
    build.match(/const projectHubScripts = \[[\s\S]*?\]\.join\(""\);/)?.[0] || "",
  ].join("\n");
  const paths = [
    ...resourcePaths(resourceDeclarations, "href"),
    ...resourcePaths(resourceDeclarations, "src"),
  ];
  const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);

  assert.deepEqual([...new Set(duplicates)], []);
});

test("IELTS Journey has one built resource and one dashboard-card controller", () => {
  const build = read("scripts/build.mjs");
  const card = read("src/features/ielts/card.js");
  const actions = read("src/features/ielts/core-actions.js");
  const scriptDeclarations =
    build.match(/const projectHubScripts = \[[\s\S]*?\]\.join\(""\);/)?.[0] || "";

  assert.equal(
    (scriptDeclarations.match(/project-data\/ielts\/ielts-core-bundle\.js/g) || []).length,
    1,
  );
  assert.equal(
    (scriptDeclarations.match(/project-data\/ielts\/ielts-card\.js/g) || []).length,
    1,
  );

  assert.match(build, /id="joy-ielts-core-bundle-v4"/);
  assert.match(build, /data-loaded="true"/);

  // card.js may provide one fallback loader, but it must first reuse
  // the script that the normal Cloudflare build already declared.
  assert.match(card, /const CORE_SCRIPT = \[/);
  assert.match(card, /document\.querySelector\(`#\$\{id\}`\)/);
  assert.equal(
    (card.match(/document\.createElement\("script"\)/g) || []).length,
    1,
  );
  assert.doesNotMatch(card, /document\.createElement\("link"\)/);

  assert.equal((card.match(/new MutationObserver/g) || []).length, 1);
  assert.doesNotMatch(actions, /new MutationObserver/);
  assert.doesNotMatch(actions, /project-card\.ielts-project-card/);

  for (const removedPath of [
    "src/features/ielts/core-diagnostic.js",
    "src/features/ielts/core-writing-review.js",
    "src/features/ielts/core-writing-rewrite.js",
    "src/features/ielts/i18n-vi-hooks.js",
  ]) {
    assert.equal(
      fs.existsSync(new URL(`../${removedPath}`, import.meta.url)),
      false,
      `${removedPath} must remain removed from IELTS Journey`,
    );
  }
});

test("IELTS card and Journey styles have non-overlapping ownership", () => {
  const cardStyles = read("project-data/ielts/ielts-card.css");
  const coreStyles = read("project-data/ielts/ielts-core.css");

  assert.equal(
    fs.existsSync(
      new URL("../project-data/ielts/ielts-core-polish.css", import.meta.url),
    ),
    false,
  );

  assert.match(cardStyles, /\.ielts-project-source[\s\S]*bottom: 46px/);
  assert.doesNotMatch(coreStyles, /\.ielts-project-source\s*\{/);

  assert.match(coreStyles, /\.ielts-core\s*\{/);
  assert.doesNotMatch(coreStyles, /\.logs form button/);
});

test("Finance extensions register explicit hooks instead of replacing core renderers", () => {
  const core = read("src/features/finance/finance.js");
  const layout = read("project-data/finance/finance-layout-v2.js");
  const dashboard = read("project-data/finance/finance-dashboard-v1.js");

  assert.match(core, /window\.JoyFinanceLayout\?\.renderMonthView/);
  assert.match(layout, /window\.JoyFinanceLayout = Object\.freeze/);
  assert.doesNotMatch(layout, /render(?:Month|Year)View\s*=/);
  assert.doesNotMatch(dashboard, /renderFinance(?:Chart|Dashboard)\s*=/);
  assert.doesNotMatch(dashboard, /new MutationObserver/);
});

test("feature modules do not replace browser platform methods", () => {
  const projectPerformance = read("src/features/project-hub/project-hub-performance.js");
  const todoVisibility = read("src/features/tasks/todo-visibility.js");
  const reminderEvents = read("src/features/tasks/task-reminders-events.js");

  assert.doesNotMatch(projectPerformance, /MutationObserver\.prototype\.observe\s*=/);
  assert.doesNotMatch(todoVisibility, /root\.fetch\s*=/);
  assert.doesNotMatch(reminderEvents, /root\.fetch\s*=/);
});

test("Worker HTTP and session primitives have one source of truth", () => {
  const workerDirectory = new URL("../worker/", import.meta.url);
  const sharedFiles = new Set(["shared/http.js", "shared/session.js"]);
  const duplicates = [];

  function visit(directory, prefix = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        visit(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      const path = `${prefix}${entry.name}`;
      if (sharedFiles.has(path)) continue;
      const source = fs.readFileSync(new URL(entry.name, directory), "utf8");
      if (/(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+(?:json|readJson|isSameOrigin|sha256Hex|readCookies|getSession)\b/.test(source)) {
        duplicates.push(path);
      }
    }
  }

  visit(workerDirectory);
  assert.deepEqual(duplicates, []);
});

test("each runtime database table has one schema owner", () => {
  const workerDirectory = new URL("../worker/", import.meta.url);
  const owners = new Map();

  function visit(directory, prefix = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        visit(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      const path = `${prefix}${entry.name}`;
      const source = fs.readFileSync(new URL(entry.name, directory), "utf8");
      for (const match of source.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z0-9_]+)/gi)) {
        const table = match[1].toLowerCase();
        const files = owners.get(table) || [];
        files.push(path);
        owners.set(table, files);
      }
    }
  }

  visit(workerDirectory);
  const overlaps = [...owners].filter(([, files]) => files.length > 1);
  assert.deepEqual(overlaps, []);
});
