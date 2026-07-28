import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(root, "dist", "index.html");
const loaderPath = resolve(root, "dist", "project-hub-performance.js");
const oldIndexReferences = [
  "project-hub-performance.js?v=turtlebot-hub-v5",
  "project-hub-performance.js?v=turtlebot-read-only-plan-v1",
];
const newIndexReference = "project-hub-performance.js?v=turtlebot-reference-no-progress-v2";

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
const nextLoader = loader
  .replaceAll(
    "project-plan-v3-reference-ui.js?v=turtlebot-read-only-plan-v1",
    "project-plan-v3-reference-ui.js?v=turtlebot-reference-no-progress-v2",
  )
  .replaceAll("loadFlexiblePeriods();", "loadReferencePlan();")
  .replaceAll(
    'script.addEventListener("load", loadFlexiblePeriods, { once: true });',
    'script.addEventListener("load", loadReferencePlan, { once: true });',
  );

if (nextLoader === loader) {
  throw new Error("TurtleBot Project Hub loader was not updated for the no-progress plan");
}
await writeFile(loaderPath, nextLoader);