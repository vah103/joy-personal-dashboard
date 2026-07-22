import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const sourceHtml = await readFile(resolve(root, "index.html"), "utf8");
const cloudflareHtml = sourceHtml.replace(
  "</head>",
  '    <meta name="joy-backend" content="cloudflare">\n  </head>',
);

await writeFile(resolve(dist, "index.html"), cloudflareHtml);
await Promise.all([
  cp(resolve(root, "app.js"), resolve(dist, "app.js")),
  cp(resolve(root, "styles.css"), resolve(dist, "styles.css")),
  cp(resolve(root, "favicon.svg"), resolve(dist, "favicon.svg")),
]);

console.log("Joy frontend built for Cloudflare");
