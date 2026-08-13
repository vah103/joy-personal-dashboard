import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "src", "i18n");
const dist = resolve(root, "dist");
const target = resolve(dist, "i18n");

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });

const STYLE = '    <link rel="stylesheet" href="/i18n/i18n.css?v=joy-i18n-v1">';
const SCRIPT = '    <script type="module" src="/i18n/index.js?v=joy-i18n-v1"></script>';

async function inject(file) {
  const path = resolve(dist, file);
  let html = await readFile(path, "utf8");
  if (!html.includes('/i18n/i18n.css')) {
    html = html.replace("</head>", `${STYLE}\n  </head>`);
  }
  if (!html.includes('/i18n/index.js')) {
    html = html.replace("</body>", `${SCRIPT}\n  </body>`);
  }
  await writeFile(path, html);
}

await Promise.all([
  inject("index.html"),
  inject("login.html"),
  inject("sale-manager.html"),
]);

console.log("Joy shared i18n bundled into dashboard, login and Sale workspace");
