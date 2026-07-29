import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const indexPath = resolve(import.meta.dirname, "..", "dist", "index.html");
const source = await readFile(indexPath, "utf8");
const current = "task-english.js?v=joy-task-english-v5";
const next = "task-english.js?v=joy-task-english-v6";

if (!source.includes(current) && !source.includes(next)) {
  throw new Error("Task English script reference was not found in dist/index.html");
}

await writeFile(indexPath, source.replaceAll(current, next));
console.log("Task English cache-busted to v6");
