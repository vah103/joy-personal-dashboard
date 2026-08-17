import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const sales = resolve(root, "src", "features", "sales");

function resolveBuildVersion() {
  const candidate = process.env.JOY_BUILD_VERSION
    || process.env.GITHUB_SHA
    || (() => {
      try {
        return execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        return "development";
      }
    })();
  return `joy-build-${String(candidate || "development").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 16)}`;
}

const buildVersion = resolveBuildVersion();

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing Sale build anchor: ${label}`);
  return source.replace(search, replacement);
}

async function writePublicModule(sourcePath, destination, replacements) {
  let source = await readFile(sourcePath, "utf8");
  for (const [search, replacement, label] of replacements) {
    source = replaceRequired(source, search, replacement, label);
  }
  await writeFile(resolve(dist, destination), source);
}

function versionAssetReference(source, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(["'])${escaped}(?:\\?v=[^"']*)?\\1`, "g");
  let count = 0;
  const output = source.replace(pattern, (_match, quote) => {
    count += 1;
    return `${quote}${asset}?v=${buildVersion}${quote}`;
  });
  if (count !== 1) throw new Error(`Expected one Sale asset reference for ${asset}; found ${count}`);
  return output;
}

await Promise.all([
  writePublicModule(resolve(sales, "assistant", "sales-assistant.js"), "sales-assistant.js", [
    ['from "../appointments/appointment.js";', `from "./sale-appointment.js?v=${buildVersion}";`, "assistant appointment import"],
    ['from "../shared/format.js";', `from "./sale-format.js?v=${buildVersion}";`, "assistant format import"],
    ['import("../room-summary/room-summary.js?v=joy-room-summary-v1")', `import("./room-summary.js?v=${buildVersion}")`, "assistant room-summary import"],
  ]),
  writePublicModule(resolve(sales, "appointments", "history.js"), "sale-history-row-edit.js", [
    ['from "./appointment.js";', `from "./sale-appointment.js?v=${buildVersion}";`, "history appointment import"],
    ['from "../shared/format.js";', `from "./sale-format.js?v=${buildVersion}";`, "history format import"],
  ]),
  writePublicModule(resolve(sales, "manager", "sale-manager.js"), "sale-manager.js", [
    ['from "../shared/format.js";', `from "./sale-format.js?v=${buildVersion}";`, "manager format import"],
  ]),
]);

const dashboardAssets = [
  "room-summary.css",
  "sales-assistant.css",
  "sale-history-row-edit.css",
  "sales-assistant.js",
  "sale-history-row-edit.js",
];
let dashboard = await readFile(resolve(dist, "index.html"), "utf8");
for (const asset of dashboardAssets) dashboard = versionAssetReference(dashboard, asset);
await writeFile(resolve(dist, "index.html"), dashboard);

const managerAssets = ["sale-manager.css", "sale-manager.js", "sale-english-ui.js"];
let manager = await readFile(resolve(dist, "sale-manager.html"), "utf8");
for (const asset of managerAssets) manager = versionAssetReference(manager, asset);
await writeFile(resolve(dist, "sale-manager.html"), manager);

console.log(`Sale frontend built with canonical imports (${buildVersion})`);
