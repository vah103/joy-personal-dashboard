import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(root, "dist", "index.html");
const oldReference = "project-hub-performance.js?v=turtlebot-hub-v5";
const newReference = "project-hub-performance.js?v=turtlebot-read-only-plan-v1";

const html = await readFile(indexPath, "utf8");
if (!html.includes(oldReference) && !html.includes(newReference)) {
  throw new Error("TurtleBot Project Hub script reference was not found in dist/index.html");
}

await writeFile(indexPath, html.replaceAll(oldReference, newReference));
