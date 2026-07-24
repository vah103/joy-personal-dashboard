import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const fonts = resolve(dist, "fonts");

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

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(fonts, { recursive: true });

const projectHubHead = [
  '    <link rel="stylesheet" href="project-hub.css?v=turtlebot-hub-v3">\n',
  '    <link rel="stylesheet" href="turtlebot-card-art.css?v=restored-card-v1">\n',
].join("");
const projectHubScripts = [
  '    <script src="project-hub-performance.js?v=turtlebot-hub-v3" defer></script>\n',
  '    <script src="project-hub-core.js?v=turtlebot-hub-v3" defer></script>\n',
  '    <script src="project-hub-render.js?v=turtlebot-hub-v3" defer></script>\n',
  '    <script src="project-hub-actions.js?v=turtlebot-hub-v3" defer></script>\n',
].join("");

const sourceHtml = await readFile(resolve(root, "index.html"), "utf8");
const cloudflareHtml = sourceHtml
  .replace(
    "</head>",
    `${projectHubHead}    <meta name="joy-backend" content="cloudflare">\n  </head>`,
  )
  .replace("</body>", `${projectHubScripts}  </body>`);

const sourceSaleHtml = await readFile(resolve(root, "sale-manager.html"), "utf8");
const cloudflareSaleHtml = sourceSaleHtml.replace(
  "</head>",
  '    <meta name="joy-backend" content="cloudflare">\n  </head>',
);

await writeFile(resolve(dist, "index.html"), cloudflareHtml);
await writeFile(resolve(dist, "sale-manager.html"), cloudflareSaleHtml);
await Promise.all([
  cp(resolve(root, "app.js"), resolve(dist, "app.js")),
  cp(resolve(root, "styles.css"), resolve(dist, "styles.css")),
  cp(resolve(root, "project-hub-performance.js"), resolve(dist, "project-hub-performance.js")),
  cp(resolve(root, "project-hub-core.js"), resolve(dist, "project-hub-core.js")),
  cp(resolve(root, "project-hub-render.js"), resolve(dist, "project-hub-render.js")),
  cp(resolve(root, "project-hub-actions.js"), resolve(dist, "project-hub-actions.js")),
  cp(resolve(root, "project-hub.css"), resolve(dist, "project-hub.css")),
  cp(resolve(root, "turtlebot-card-art.css"), resolve(dist, "turtlebot-card-art.css")),
  cp(resolve(root, "turtlebot4-card-background.webp"), resolve(dist, "turtlebot4-card-background.webp")),
  cp(resolve(root, "project-data"), resolve(dist, "project-data"), { recursive: true }),
  cp(resolve(root, "sale-fonts", "nunito-latin-400-normal.woff2"), resolve(fonts, "nunito-latin-400-normal.woff2")),
  cp(resolve(root, "sale-fonts", "nunito-vietnamese-400-normal.woff2"), resolve(fonts, "nunito-vietnamese-400-normal.woff2")),
  cp(resolve(root, "sale-fonts", "nunito-latin-600-normal.woff2"), resolve(fonts, "nunito-latin-600-normal.woff2")),
  cp(resolve(root, "sale-fonts", "nunito-vietnamese-600-normal.woff2"), resolve(fonts, "nunito-vietnamese-600-normal.woff2")),
  cp(resolve(root, "sale-fonts", "nunito-latin-700-normal.woff2"), resolve(fonts, "nunito-latin-700-normal.woff2")),
  cp(resolve(root, "sale-fonts", "nunito-vietnamese-700-normal.woff2"), resolve(fonts, "nunito-vietnamese-700-normal.woff2")),
  cp(resolve(root, "sale-manager.js"), resolve(dist, "sale-manager.js")),
  cp(resolve(root, "sale-manager.css"), resolve(dist, "sale-manager.css")),
  cp(resolve(root, "finance-demo.css"), resolve(dist, "finance-demo.css")),
  cp(resolve(root, "finance-demo.js"), resolve(dist, "finance-demo.js")),
  cp(resolve(root, "app-icon-64.png"), resolve(dist, "app-icon-64.png")),
  cp(resolve(root, "app-icon-192.png"), resolve(dist, "app-icon-192.png")),
  cp(resolve(root, "app-icon-512.png"), resolve(dist, "app-icon-512.png")),
  cp(resolve(root, "wolf-mark.svg"), resolve(dist, "wolf-mark.svg")),
  cp(resolve(root, "site.webmanifest"), resolve(dist, "site.webmanifest")),
  ...fontFiles.map(([family, file]) => cp(
    resolve(root, "node_modules", "@fontsource", family, "files", file),
    resolve(fonts, file),
  )),
]);

console.log("Joy frontend built for Cloudflare");