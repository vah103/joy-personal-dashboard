import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");

function replaceExactlyOnce(source, pattern, replacement, label) {
  let matches = 0;
  const next = source.replace(pattern, (...args) => {
    matches += 1;
    return typeof replacement === "function" ? replacement(...args) : replacement;
  });
  if (matches !== 1) {
    throw new Error(`Expected exactly one ${label}; found ${matches}`);
  }
  return next;
}

function readBuildVersion(indexHtml) {
  const match = indexHtml.match(/<meta\s+name=["']joy-build-version["']\s+content=["']([^"']+)["']/i);
  if (!match?.[1]) throw new Error("Missing joy-build-version metadata in dist/index.html");
  return match[1];
}

function versionHtmlAsset(indexHtml, asset, buildVersion) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return replaceExactlyOnce(
    indexHtml,
    new RegExp(`(["'])${escaped}(?:\\?v=[^"']*)?\\1`),
    (_match, quote) => `${quote}${asset}?v=${buildVersion}${quote}`,
    `${asset} reference in dist/index.html`,
  );
}

function versionScriptAsset(source, asset, buildVersion) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return replaceExactlyOnce(
    source,
    new RegExp(`(["'])${escaped}(?:\\?v=[^"']*)?\\1`),
    (_match, quote) => `${quote}${asset}?v=${buildVersion}${quote}`,
    `${asset} reference in TurtleBot loader`,
  );
}

export async function versionTurtleBotAssets(publicRoot) {
  const indexPath = resolve(publicRoot, "index.html");
  const loaderPath = resolve(publicRoot, "turtlebot-plan-loader.js");
  const currentStatePath = resolve(publicRoot, "project-data", "turtlebot4", "project-current-state.js");

  const [indexSource, loaderSource, currentStateSource] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(loaderPath, "utf8"),
    readFile(currentStatePath, "utf8"),
  ]);

  const buildVersion = readBuildVersion(indexSource);

  let indexHtml = indexSource;
  for (const asset of [
    "project-data/turtlebot4/project-state-v2.js",
    "turtlebot-roadmap.js",
    "turtlebot-plan-loader.js",
  ]) {
    indexHtml = versionHtmlAsset(indexHtml, asset, buildVersion);
  }

  let loader = loaderSource;
  for (const asset of [
    "/project-data/turtlebot4/project-hub-tabs-cleanup.js",
    "/project-data/turtlebot4/project-plan-v3-reference-ui.js",
    "/project-data/turtlebot4/project-current-state.js",
    "/project-data/turtlebot4/project-plan-v3-ui.js",
  ]) {
    loader = versionScriptAsset(loader, asset, buildVersion);
  }

  let currentState = replaceExactlyOnce(
    currentStateSource,
    /const STATE_URL = ["']\/project-data\/turtlebot4\/current-state\.json(?:\?v=[^"']*)?["'];/,
    `const STATE_URL = "/project-data/turtlebot4/current-state.json?v=${buildVersion}";`,
    "current-state.json URL",
  );

  if (!/fetch\(STATE_URL,\s*\{[^}]*cache:\s*["']no-store["'][^}]*\}\)/s.test(currentState)) {
    currentState = replaceExactlyOnce(
      currentState,
      /fetch\(STATE_URL,\s*\{\s*credentials:\s*["']same-origin["']\s*\}\)/,
      'fetch(STATE_URL, { credentials: "same-origin", cache: "no-store" })',
      "no-store TurtleBot state fetch",
    );
  }

  await Promise.all([
    writeFile(indexPath, indexHtml),
    writeFile(loaderPath, loader),
    writeFile(currentStatePath, currentState),
  ]);

  return buildVersion;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const publicRoot = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "dist");
  const buildVersion = await versionTurtleBotAssets(publicRoot);
  console.log(`TurtleBot assets versioned with ${buildVersion}`);
}
