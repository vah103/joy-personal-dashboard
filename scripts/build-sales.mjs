import { execFileSync } from "node:child_process";
import { cp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const salesSource = resolve(root, "src", "features", "sales");
const publicSales = resolve(dist, "sales");

function buildVersion() {
  const candidates = [process.env.GITHUB_SHA, process.env.CF_PAGES_COMMIT_SHA, process.env.COMMIT_SHA]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (candidates.length) return candidates[0].slice(0, 12);
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

const version = buildVersion();

async function listJsFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listJsFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

function versionRelativeModuleImports(source) {
  return source.replace(
    /(["'])(\.\.?\/[^"'?]+\.js)(?:\?v=[^"']*)?\1/g,
    (_match, quote, path) => `${quote}${path}?v=${version}${quote}`,
  );
}

async function copyCanonicalSalesTree() {
  await rm(publicSales, { recursive: true, force: true });
  await cp(salesSource, publicSales, { recursive: true, force: true });
  for (const path of await listJsFiles(publicSales)) {
    const source = await readFile(path, "utf8");
    await writeFile(path, versionRelativeModuleImports(source));
  }
}

const publicEntries = Object.freeze({
  "sales-assistant.js": "./sales/assistant/sales-assistant.js",
  "sale-history-row-edit.js": "./sales/appointments/history.js",
  "sale-manager.js": "./sales/manager/sale-manager.js",
  "room-summary.js": "./sales/room-summary/room-summary.js",
  "sale-english-ui.js": "./sales/shared/i18n.js",
});

async function writeCompatibilityEntries() {
  await Promise.all(Object.entries(publicEntries).map(([filename, target]) => (
    writeFile(resolve(dist, filename), `export * from "${target}?v=${version}";\n`)
  )));
}

function versionAssetReference(html, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`${escaped}\\?v=[^"']+`, "g"), `${asset}?v=${version}`);
}

async function versionPageAssets(filename, assets) {
  const path = resolve(dist, filename);
  let html = await readFile(path, "utf8");
  for (const asset of assets) html = versionAssetReference(html, asset);
  await writeFile(path, html);
}

await copyCanonicalSalesTree();
await writeCompatibilityEntries();

await versionPageAssets("index.html", [
  "room-summary.css",
  "sales-assistant.css",
  "sale-history-row-edit.css",
  "sales-assistant.js",
  "sale-history-row-edit.js",
]);

await versionPageAssets("sale-manager.html", [
  "sale-manager.css",
  "sale-manager.js",
  "sale-english-ui.js",
]);

console.log(`Built Sale module tree and compatibility entries (v=${version}).`);
