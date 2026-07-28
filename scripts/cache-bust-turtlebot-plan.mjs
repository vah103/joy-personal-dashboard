import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(root, "dist", "index.html");
const replacements = [
  ["project-hub-performance.js?v=turtlebot-hub-v5", "project-hub-performance.js?v=turtlebot-read-only-plan-v1"],
  ["finance-amount-shortcut-v1.js?v=joy-finance-amount-shortcut-v1", "finance-amount-shortcut-v1.js?v=joy-finance-amount-shortcut-v2"],
];

let html = await readFile(indexPath, "utf8");
for (const [oldReference, newReference] of replacements) {
  if (!html.includes(oldReference) && !html.includes(newReference)) {
    throw new Error(`Build asset reference was not found in dist/index.html: ${oldReference}`);
  }
  html = html.replaceAll(oldReference, newReference);
}

await writeFile(indexPath, html);
