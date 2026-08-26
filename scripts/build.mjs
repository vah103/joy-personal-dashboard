import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const src = resolve(root, "src");
const dist = resolve(root, "dist");
const fonts = resolve(dist, "fonts");

const pages = resolve(src, "pages");
const dashboardPage = resolve(pages, "dashboard");
const loginPage = resolve(pages, "login");
const salePage = resolve(pages, "sale");
const features = resolve(src, "features");
const salesFeatures = resolve(features, "sales");
const ieltsFeature = resolve(features, "ielts");
const assets = resolve(src, "assets");
const icons = resolve(assets, "icons");
const nunitoFonts = resolve(assets, "fonts", "nunito");
const pwa = resolve(src, "pwa");
const ieltsPublicDir = resolve(dist, "project-data", "ielts");

const desktopFaviconLink = '    <link rel="icon" href="/joy-web-favicon.svg?v=joy-desktop-wolf-v2" type="image/svg+xml">';
const blueFaviconLink = '    <link rel="icon" href="/joy-blue-icon.png?v=joy-topographic-blue-v1" type="image/png">';
const legacySaleFaviconLink = '    <link rel="icon" href="app-icon-64.png?v=joy-original-wolf-v2" type="image/png" sizes="64x64">';
const dashboardBackendAnchor = "    <!-- JOY_CLOUDFLARE_BACKEND -->";
const buildVersionToken = "__JOY_BUILD_VERSION__";

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

  const normalized = String(candidate || "development")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 16);
  return `joy-build-${normalized || "development"}`;
}

const buildVersion = resolveBuildVersion();
const cloudflareBackendMeta = [
  '    <meta name="joy-backend" content="cloudflare">',
  `    <meta name="joy-build-version" content="${buildVersion}">`,
].join("\n");

const fontFiles = [
  ...[400, 500, 600, 700].flatMap((weight) => [
    `instrument-sans-latin-${weight}-normal.woff2`,
    `instrument-sans-latin-ext-${weight}-normal.woff2`,
  ]).map((file) => ["instrument-sans", file, file.includes("-400-") ? 400 : file.includes("-700-") ? 700 : 600]),
  ...[400, 500].flatMap((weight) => [
    `newsreader-latin-${weight}-normal.woff2`,
    `newsreader-latin-ext-${weight}-normal.woff2`,
  ]).map((file) => ["newsreader", file, file.includes("-400-") ? 400 : 600]),
  ...[
    "quicksand-latin-600-normal.woff2",
    "quicksand-latin-ext-600-normal.woff2",
  ].map((file) => ["quicksand", file, 600]),
];

function replaceRequired(source, search, replacement, label) {
  const firstIndex = source.indexOf(search);
  if (firstIndex === -1) {
    throw new Error(`Missing required build anchor: ${label}`);
  }
  if (source.indexOf(search, firstIndex + search.length) !== -1) {
    throw new Error(`Duplicate required build anchor: ${label}`);
  }
  return source.replace(search, replacement);
}

function assertBuildTokenRemoved(source, token, label) {
  if (source.includes(token)) {
    throw new Error(`Unresolved build token: ${label}`);
  }
}

function versionAssetReference(source, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(["'])${escaped}(?:\\?v=[^"']*)?\\1`, "g");
  let matches = 0;
  const versioned = source.replace(pattern, (match, quote) => {
    matches += 1;
    return `${quote}${asset}?v=${buildVersion}${quote}`;
  });
  if (matches !== 1) {
    throw new Error(`Expected exactly one dashboard asset reference for ${asset}; found ${matches}`);
  }
  return versioned;
}

async function copyFontWithNunitoFallback(family, file, weight) {
  const source = resolve(root, "node_modules", "@fontsource", family, "files", file);
  const fallback = resolve(nunitoFonts, `nunito-latin-${weight}-normal.woff2`);
  try {
    await cp(source, resolve(fonts, file));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await cp(fallback, resolve(fonts, file));
  }
}

const dashboardAppSourceFiles = [
  "app-config.js",
  "app-helpers.js",
  "app-state.js",
  "app-communication.js",
  "app-render.js",
  "app-integrations.js",
  "app-actions.js",
  "app-sync.js",
  "app-bootstrap.js",
];

const ieltsCoreSourceFiles = [
  "core-model.js",
  "core-ui.js",
  "core-actions.js",
  "source-assignment.js",
  "course-sync.js",
  "course-prompt-bridge.js",
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(fonts, { recursive: true });

const sourceHtml = await readFile(resolve(dashboardPage, "index.html"), "utf8");
let cloudflareHtml = replaceRequired(
  sourceHtml,
  dashboardBackendAnchor,
  cloudflareBackendMeta,
  "dashboard Cloudflare backend metadata",
);
cloudflareHtml = versionAssetReference(cloudflareHtml, "/site.webmanifest");
cloudflareHtml = versionAssetReference(cloudflareHtml, "styles.css");
cloudflareHtml = versionAssetReference(cloudflareHtml, "app.js");
assertBuildTokenRemoved(cloudflareHtml, dashboardBackendAnchor, "dashboard Cloudflare backend metadata");

const sourceLoginHtml = await readFile(resolve(loginPage, "index.html"), "utf8");
const cloudflareLoginHtml = replaceRequired(
  sourceLoginHtml,
  blueFaviconLink,
  desktopFaviconLink,
  "login favicon",
);

const sourceSaleHtml = await readFile(resolve(salePage, "index.html"), "utf8");
let cloudflareSaleHtml = replaceRequired(
  sourceSaleHtml,
  legacySaleFaviconLink,
  desktopFaviconLink,
  "sale favicon",
);
cloudflareSaleHtml = replaceRequired(
  cloudflareSaleHtml,
  '<meta name="description" content="Joy\'s private 2026 room sale workspace.">',
  '<meta name="description" content="Hey Joy! private 2026 room sale workspace.">',
  "sale description",
);
cloudflareSaleHtml = replaceRequired(
  cloudflareSaleHtml,
  "<title>Sale 2026 — Joy</title>",
  "<title>Sale 2026 — Hey Joy!</title>",
  "sale title",
);
cloudflareSaleHtml = replaceRequired(
  cloudflareSaleHtml,
  "</head>",
  '    <meta name="joy-backend" content="cloudflare">\n  </head>',
  "sale Cloudflare backend metadata",
);

const sourceServiceWorker = await readFile(resolve(pwa, "sw.js"), "utf8");
const cloudflareServiceWorker = replaceRequired(
  sourceServiceWorker,
  buildVersionToken,
  buildVersion,
  "service worker build version",
);
assertBuildTokenRemoved(cloudflareServiceWorker, buildVersionToken, "service worker build version");

await writeFile(resolve(dist, "index.html"), cloudflareHtml);
await writeFile(resolve(dist, "login.html"), cloudflareLoginHtml);
await writeFile(resolve(dist, "sale-manager.html"), cloudflareSaleHtml);
await writeFile(resolve(dist, "sw.js"), cloudflareServiceWorker);

const dashboardAppParts = await Promise.all(
  dashboardAppSourceFiles.map((file) => readFile(resolve(dashboardPage, file), "utf8")),
);
await writeFile(resolve(dist, "app.js"), `${dashboardAppParts.join("\n\n")}\n`);

const copies = [
  [resolve(dashboardPage, "styles.css"), "styles.css"],
  [resolve(loginPage, "login.css"), "login.css"],
  [resolve(salePage, "sale-manager.js"), "sale-manager.js"],
  [resolve(salePage, "sale-manager.css"), "sale-manager.css"],
  [resolve(salePage, "room-summary.js"), "room-summary.js"],
  [resolve(salePage, "room-summary.css"), "room-summary.css"],
  [resolve(salesFeatures, "sales-assistant.js"), "sales-assistant.js"],
  [resolve(salesFeatures, "sales-assistant.css"), "sales-assistant.css"],
  [resolve(salesFeatures, "sale-english-ui.js"), "sale-english-ui.js"],
  [resolve(salesFeatures, "sale-appointment.js"), "sale-appointment.js"],
  [resolve(salesFeatures, "sale-history-row-edit.js"), "sale-history-row-edit.js"],
  [resolve(salesFeatures, "sale-history-row-edit.css"), "sale-history-row-edit.css"],
  [resolve(features, "project-details", "project-details.js"), "project-details.js"],
  [resolve(features, "project-details", "project-details.css"), "project-details.css"],
  [resolve(features, "project-details", "turtlebot-roadmap.js"), "turtlebot-roadmap.js"],
  [resolve(features, "project-details", "turtlebot-roadmap-language.js"), "turtlebot-roadmap-language.js"],
  [resolve(features, "project-details", "turtlebot-roadmap-font.css"), "turtlebot-roadmap-font.css"],
  [resolve(features, "project-details", "turtlebot4-art.webp"), "turtlebot4-art.webp"],
  [resolve(features, "finance", "finance.js"), "finance-demo.js"],
  [resolve(features, "finance", "finance.css"), "finance-demo.css"],
  [resolve(features, "motion", "dashboard-entry.js"), "dashboard-entry.js"],
  [resolve(features, "motion", "dashboard-entry.css"), "dashboard-entry.css"],
  [resolve(features, "weather", "weather-rain.js"), "weather-rain.js"],
  [resolve(features, "tasks", "todo-visibility.js"), "todo-visibility.js"],
  [resolve(features, "tasks", "todo-display-policy.js"), "todo-display-policy.js"],
  [resolve(features, "tasks", "task-english.js"), "task-english.js"],
  [resolve(features, "tasks", "task-reminders-events.js"), "task-reminders-events.js"],
  [resolve(features, "tasks", "task-reminders.js"), "task-reminders.js"],
  [resolve(features, "tasks", "task-natural-input.js"), "task-natural-input.js"],
  [resolve(features, "tasks", "task-reminders.css"), "task-reminders.css"],
  [resolve(features, "auth", "auth-ui.js"), "auth-ui.js"],
  [resolve(features, "auth", "auth-ui.css"), "auth-ui.css"],
  [resolve(features, "notifications", "push-notifications.js"), "push-notifications.js"],
  [resolve(features, "notifications", "mobile-notifications.css"), "mobile-notifications.css"],
  [resolve(features, "notifications", "weather-status-ui.js"), "weather-status-ui.js"],
  [resolve(features, "greeting", "greeting-layout.js"), "greeting-layout.js"],
  [resolve(features, "greeting", "greeting-layout.css"), "greeting-layout.css"],
  [resolve(features, "greeting", "daily-brief.css"), "daily-brief.css"],
  [resolve(features, "vocabulary", "vocabulary-loader.js"), "vocabulary-loader.js"],
  [resolve(features, "project-hub", "project-hub-performance.js"), "project-hub-performance.js"],
  [resolve(features, "project-hub", "project-hub-core.js"), "project-hub-core.js"],
  [resolve(features, "project-hub", "project-hub-render.js"), "project-hub-render.js"],
  [resolve(features, "project-hub", "project-hub-actions.js"), "project-hub-actions.js"],
  [resolve(features, "project-hub", "project-hub-extension-api.js"), "project-hub-extension-api.js"],
  [resolve(features, "project-hub", "turtlebot-plan-loader.js"), "turtlebot-plan-loader.js"],
  [resolve(features, "project-hub", "project-hub.css"), "project-hub.css"],
  [resolve(features, "project-hub", "turtlebot-card-art.css"), "turtlebot-card-art.css"],
  [resolve(features, "project-hub", "turtlebot4-card-background.webp"), "turtlebot4-card-background.webp"],
  [resolve(features, "theme", "dashboard-openai-headings.css"), "dashboard-openai-headings.css"],
  [resolve(ieltsFeature, "card.js"), "project-data/ielts/ielts-card.js"],
  [resolve(icons, "app-icon-64.png"), "app-icon-64.png"],
  [resolve(icons, "app-icon-192.png"), "app-icon-192.png"],
  [resolve(icons, "wolf-mark.svg"), "wolf-mark.svg"],
  [resolve(icons, "joy-blue-icon.png"), "joy-blue-icon.png"],
  [resolve(icons, "joy-web-favicon.svg"), "joy-web-favicon.svg"],
  [resolve(pwa, "site.webmanifest"), "site.webmanifest"],
];

await cp(resolve(root, "project-data"), resolve(dist, "project-data"), { recursive: true });
await Promise.all([
  ...copies.map(([source, destination]) => cp(source, resolve(dist, destination))),
  ...[
    "nunito-latin-400-normal.woff2",
    "nunito-vietnamese-400-normal.woff2",
    "nunito-latin-600-normal.woff2",
    "nunito-vietnamese-600-normal.woff2",
    "nunito-latin-700-normal.woff2",
    "nunito-vietnamese-700-normal.woff2",
  ].map((file) => cp(resolve(nunitoFonts, file), resolve(fonts, file))),
  ...fontFiles.map(([family, file, weight]) => copyFontWithNunitoFallback(family, file, weight)),
]);

const ieltsCoreParts = await Promise.all(
  ieltsCoreSourceFiles.map((file) => readFile(resolve(ieltsFeature, file), "utf8")),
);
const ieltsCoreBundle = [
  "(function registerIeltsAugustCore() {",
  '  if (window.JoyIELTS?.version === "journey-v4") return;',
  '  document.querySelector("#ielts-modal")?.remove();',
  ...ieltsCoreParts,
  "})();",
  "",
].join("\n");
await writeFile(resolve(ieltsPublicDir, "ielts-core-bundle.js"), ieltsCoreBundle);

console.log(`Hey Joy! frontend built for Cloudflare (${buildVersion})`);
