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

test("IELTS has one resource loader and one dashboard-card controller", () => {
  const build = read("scripts/build.mjs");
  const card = read("src/features/ielts/card.js");
  const actions = read("src/features/ielts/core-actions.js");
  const translations = read("src/features/ielts/i18n-vi-hooks.js");

  assert.match(build, /id="joy-ielts-core-bundle"/);
  assert.doesNotMatch(build, /data-loaded="true"/);
  assert.doesNotMatch(card, /createElement\("script"\)/);
  assert.doesNotMatch(card, /createElement\("link"\)/);
  assert.equal((card.match(/new MutationObserver/g) || []).length, 1);
  assert.doesNotMatch(actions, /new MutationObserver/);
  assert.doesNotMatch(actions, /project-card\.ielts-project-card/);
  assert.equal((translations.match(/new MutationObserver/g) || []).length, 1);
  for (const path of [
    "src/features/ielts/core-actions.js",
    "src/features/ielts/core-diagnostic.js",
    "src/features/ielts/core-writing-review.js",
    "src/features/ielts/core-writing-rewrite.js",
    "src/features/ielts/i18n-vi-hooks.js",
  ]) {
    assert.doesNotMatch(
      read(path),
      /(?:^|\n)[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*function/,
      `${path} must extend IELTS through named functions, not renderer replacement`,
    );
  }
});

test("IELTS card and coach styles have non-overlapping ownership", () => {
  const cardStyles = read("project-data/ielts/ielts-card.css");
  const coreStyles = read("project-data/ielts/ielts-core.css");

  assert.equal(
    fs.existsSync(new URL("../project-data/ielts/ielts-core-polish.css", import.meta.url)),
    false,
  );
  assert.match(cardStyles, /\.ielts-project-source[\s\S]*bottom: 46px/);
  assert.doesNotMatch(coreStyles, /\.ielts-project-source\{bottom:/);
  assert.match(coreStyles, /\.logs form button\{border-color:#4f7884/);
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
