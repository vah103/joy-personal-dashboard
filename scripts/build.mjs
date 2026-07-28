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

const fontFiles = [
  ...[400, 500, 600, 700].flatMap((weight) => [
    `instrument-sans-latin-${weight}-normal.woff2`,
    `instrument-sans-latin-ext-${weight}-normal.woff2`,
  ]).map((file) => ["instrument-sans", file]),
  ...[400, 500].flatMap((weight) => [
    `newsreader-latin-${weight}-normal.woff2`,
    `newsreader-latin-ext-${weight}-normal.woff2`,
  ]).map((file) => ["newsreader", file]),
  ...[
    "quicksand-latin-600-normal.woff2",
    "quicksand-latin-ext-600-normal.woff2",
  ].map((file) => ["quicksand", file]),
];

const ieltsCoreSourceFiles = [
  "core-model.js",
  "core-ui.js",
  "core-actions.js",
  "core-diagnostic.js",
  "core-writing-review.js",
  "core-writing-rewrite.js",
  "i18n-vi-base.js",
  "i18n-vi-days-01-09.js",
  "i18n-vi-days-10-16.js",
  "i18n-vi-days-17-23.js",
  "i18n-vi-days-24-31.js",
  "i18n-vi-plan-runtime.js",
  "i18n-vi-ui-text.js",
  "i18n-vi-hooks.js",
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(fonts, { recursive: true });

const projectHubHead = [
  '    <link rel="stylesheet" href="project-hub.css?v=turtlebot-hub-v4">\n',
  '    <link rel="stylesheet" href="turtlebot-roadmap-font.css?v=turtlebot-roadmap-nunito-v2">\n',
  '    <link rel="stylesheet" href="turtlebot-card-art.css?v=restored-card-v6">\n',
  '    <link rel="stylesheet" href="project-data/ielts/ielts-card.css?v=ielts-card-v2">\n',
  '    <link rel="stylesheet" href="project-data/ielts/ielts-core.css?v=ielts-august-core-v3">\n',
  '    <link rel="stylesheet" href="project-data/ielts/ielts-core-polish.css?v=ielts-august-core-v3">\n',
  '    <link rel="stylesheet" href="project-data/ielts/ielts-diagnostic.css?v=ielts-baseline-v2">\n',
  '    <link rel="stylesheet" href="mobile-notifications.css?v=iphone-rain-bell-v1">\n',
  '    <link rel="stylesheet" href="auth-ui.css?v=joy-google-account-v3">\n',
  '    <link rel="stylesheet" href="greeting-layout.css?v=joy-daily-brief-v4">\n',
  '    <link rel="stylesheet" href="dashboard-entry.css?v=joy-entry-motion-v1">\n',
  '    <link rel="stylesheet" href="task-reminders.css?v=joy-tasks-v1">\n',
  '    <link rel="stylesheet" href="room-summary.css?v=joy-room-summary-v1">\n',
  '    <link rel="stylesheet" href="sales-assistant.css?v=joy-dashboard-sales-assistant-v4">\n',
  '    <link rel="stylesheet" href="project-data/finance/finance-layout-v2.css?v=joy-finance-ledger-v4">\n',
].join("");

const projectHubScripts = [
  '    <script src="project-hub-performance.js?v=turtlebot-hub-v5" defer></script>\n',
  '    <script src="project-hub-core.js?v=turtlebot-hub-v4" defer></script>\n',
  '    <script src="project-hub-render.js?v=turtlebot-hub-v4" defer></script>\n',
  '    <script src="project-hub-actions.js?v=turtlebot-hub-v4" defer></script>\n',
  '    <script src="project-data/turtlebot4/project-state-v2.js?v=turtlebot-project-state-v3-english" defer></script>\n',
  '    <script src="turtlebot-roadmap.js?v=turtlebot-roadmap-v2" defer></script>\n',
  '    <script src="turtlebot-roadmap-language.js?v=turtlebot-roadmap-english-v1" defer></script>\n',
  '    <script id="joy-ielts-core-bundle" data-loaded="true" src="project-data/ielts/ielts-core-bundle.js?v=ielts-august-core-v7" defer></script>\n',
  '    <script src="project-data/ielts/ielts-card.js?v=ielts-card-v8" defer></script>\n',
  '    <script src="weather-status-ui.js?v=rain-threshold-90-v1" defer></script>\n',
  '    <script src="push-notifications.js?v=joy-current-device-v1" defer></script>\n',
  '    <script src="auth-ui.js?v=joy-google-account-v3" defer></script>\n',
  '    <script src="dashboard-entry.js?v=joy-entry-motion-v1" defer></script>\n',
  '    <script src="greeting-layout.js?v=joy-daily-brief-v4" defer></script>\n',
  '    <script src="daily-brief-polish.js?v=joy-daily-brief-polish-v2" defer></script>\n',
  '    <script src="task-english.js?v=joy-task-english-v5" defer></script>\n',
  '    <script src="task-reminders-events.js?v=joy-task-checkbox-v2" defer></script>\n',
  '    <script src="task-reminders.js?v=joy-tasks-v1" defer></script>\n',
  '    <script src="task-natural-input.js?v=joy-natural-reminders-v1" defer></script>\n',
  '    <script type="module" src="sales-assistant.js?v=joy-dashboard-sales-assistant-v4"></script>\n',
  '    <script src="project-data/finance/finance-layout-v2.js?v=joy-finance-month-layout-v4" defer></script>\n',
  '    <script src="project-data/finance/finance-dashboard-v1.js?v=joy-finance-dashboard-v3" defer></script>\n',
  '    <script src="project-data/finance/finance-breakdown-v1.js?v=joy-finance-breakdown-v1" defer></script>\n',
  '    <script src="project-data/finance/finance-amount-shortcut-v1.js?v=joy-finance-amount-shortcut-v1" defer></script>\n',
].join("");

const sourceHtml = await readFile(resolve(dashboardPage, "index.html"), "utf8");
const cloudflareHtml = sourceHtml
  .replace(blueFaviconLink, desktopFaviconLink)
  .replace('finance-demo.css?v=joy-character-motion-v5', 'finance-demo.css?v=joy-finance-core-v4')
  .replace('finance-demo.js?v=joy-character-motion-v4', 'finance-demo.js?v=joy-finance-core-v4')
  .replace('<meta name="application-name" content="Joy">', '<meta name="application-name" content="Hey Joy!">')
  .replace('<title>Joy — Personal Dashboard</title>', '<title>Hey Joy! — Personal Dashboard</title>')
  .replace('aria-label="Joy overview"', 'aria-label="Hey Joy! overview"')
  .replace('<p class="section-kicker" id="brief-title">Joy</p>', '<p class="section-kicker" id="brief-title">Hey Joy!</p>')
  .replace('site.webmanifest?v=joy-original-wolf-v2', 'site.webmanifest?v=joy-blue-wolf-v4')
  .replace('weather-rain.js?v=joy-rain-notice-v2', 'weather-rain.js?v=joy-rain-notice-v5')
  .replace(
    '<script src="app.js?v=joy-dashboard-combined-v1" defer></script>',
    '<script src="todo-display-policy.js?v=joy-task-window-v1" defer></script>\n    <script src="app.js?v=joy-dashboard-combined-v1" defer></script>',
  )
  .replace(
    "</head>",
    `${projectHubHead}    <meta name="joy-backend" content="cloudflare">\n  </head>`,
  )
  .replace("</body>", `${projectHubScripts}  </body>`);

const sourceLoginHtml = await readFile(resolve(loginPage, "index.html"), "utf8");
const cloudflareLoginHtml = sourceLoginHtml.replace(blueFaviconLink, desktopFaviconLink);

const sourceSaleHtml = await readFile(resolve(salePage, "index.html"), "utf8");
const cloudflareSaleHtml = sourceSaleHtml
  .replace(legacySaleFaviconLink, desktopFaviconLink)
  .replace('<meta name="description" content="Joy\'s private 2026 room sale workspace.">', '<meta name="description" content="Hey Joy! private 2026 room sale workspace.">')
  .replace('<title>Sale 2026 — Joy</title>', '<title>Sale 2026 — Hey Joy!</title>')
  .replace(
    "</head>",
    '    <meta name="joy-backend" content="cloudflare">\n  </head>',
  );

await writeFile(resolve(dist, "index.html"), cloudflareHtml);
await writeFile(resolve(dist, "login.html"), cloudflareLoginHtml);
await writeFile(resolve(dist, "sale-manager.html"), cloudflareSaleHtml);

const copies = [
  [resolve(dashboardPage, "app.js"), "app.js"],
  [resolve(dashboardPage, "styles.css"), "styles.css"],
  [resolve(loginPage, "login.css"), "login.css"],
  [resolve(salePage, "sale-manager.js"), "sale-manager.js"],
  [resolve(salePage, "sale-manager.css"), "sale-manager.css"],
  [resolve(salePage, "room-summary.js"), "room-summary.js"],
  [resolve(salePage, "room-summary.css"), "room-summary.css"],
  [resolve(salesFeatures, "sales-assistant.js"), "sales-assistant.js"],
  [resolve(salesFeatures, "sales-assistant.css"), "sales-assistant.css"],
  [resolve(salesFeatures, "sale-appointment.js"), "sale-appointment.js"],
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
  [resolve(features, "greeting", "daily-brief-polish.js"), "daily-brief-polish.js"],
  [resolve(features, "project-hub", "project-hub-performance.js"), "project-hub-performance.js"],
  [resolve(features, "project-hub", "project-hub-core.js"), "project-hub-core.js"],
  [resolve(features, "project-hub", "project-hub-render.js"), "project-hub-render.js"],
  [resolve(features, "project-hub", "project-hub-actions.js"), "project-hub-actions.js"],
  [resolve(features, "project-hub", "project-hub.css"), "project-hub.css"],
  [resolve(features, "project-hub", "turtlebot-card-art.css"), "turtlebot-card-art.css"],
  [resolve(features, "project-hub", "turtlebot4-card-background.webp"), "turtlebot4-card-background.webp"],
  [resolve(ieltsFeature, "card.js"), "project-data/ielts/ielts-card.js"],
  [resolve(icons, "app-icon-64.png"), "app-icon-64.png"],
  [resolve(icons, "app-icon-192.png"), "app-icon-192.png"],
  [resolve(icons, "wolf-mark.svg"), "wolf-mark.svg"],
  [resolve(icons, "joy-blue-icon.png"), "joy-blue-icon.png"],
  [resolve(icons, "joy-web-favicon.svg"), "joy-web-favicon.svg"],
  [resolve(pwa, "sw.js"), "sw.js"],
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
  ...fontFiles.map(([family, file]) => cp(
    resolve(root, "node_modules", "@fontsource", family, "files", file),
    resolve(fonts, file),
  )),
]);

const ieltsCoreParts = await Promise.all(
  ieltsCoreSourceFiles.map((file) => readFile(resolve(ieltsFeature, file), "utf8")),
);
const ieltsCoreBundle = [
  "(function registerIeltsAugustCore() {",
  "  if (window.JoyIELTS) return;",
  ...ieltsCoreParts,
  "})();",
  "",
].join("\n");
await writeFile(resolve(ieltsPublicDir, "ielts-core-bundle.js"), ieltsCoreBundle);

console.log("Hey Joy! frontend built for Cloudflare");
