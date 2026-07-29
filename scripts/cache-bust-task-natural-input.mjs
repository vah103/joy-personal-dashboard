import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const indexPath = resolve(import.meta.dirname, "..", "dist", "index.html");
const source = await readFile(indexPath, "utf8");
const current = "task-natural-input.js?v=joy-natural-reminders-v1";
const next = "task-natural-input.js?v=joy-natural-reminders-v2";

if (!source.includes(current) && !source.includes(next)) {
  throw new Error("Natural reminder script reference was not found in dist/index.html");
}

await writeFile(indexPath, source.replaceAll(current, next));
console.log("Natural reminder parser cache-busted to v2");
