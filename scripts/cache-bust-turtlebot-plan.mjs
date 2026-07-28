import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(root, "dist", "index.html");
const loaderPath = resolve(root, "dist", "project-hub-performance.js");
const oldIndexReferences = [
  "project-hub-performance.js?v=turtlebot-hub-v5",
  "project-hub-performance.js?v=turtlebot-read-only-plan-v1",
  "project-hub-performance.js?v=turtlebot-reference-no-progress-v2",
];
const newIndexReference = "project-hub-performance.js?v=turtlebot-tabs-cleanup-v3";

const html = await readFile(indexPath, "utf8");
if (!oldIndexReferences.some((reference) => html.includes(reference)) && !html.includes(newIndexReference)) {
  throw new Error("TurtleBot Project Hub script reference was not found in dist/index.html");
}

let nextHtml = html;
oldIndexReferences.forEach((reference) => {
  nextHtml = nextHtml.replaceAll(reference, newIndexReference);
});
await writeFile(indexPath, nextHtml);

const loader = await readFile(loaderPath, "utf8");
if (!loader.includes("project-hub-tabs-cleanup.js?v=turtlebot-tabs-cleanup-v1")) {
  throw new Error("TurtleBot tab cleanup loader was not found in the built frontend");
}
