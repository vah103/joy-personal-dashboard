import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const indexPath = resolve(import.meta.dirname, "..", "dist", "index.html");
const source = await readFile(indexPath, "utf8");
const previous = [
  "task-english.js?v=joy-task-english-v5",
  "task-english.js?v=joy-task-english-v6",
];
const next = "task-english.js?v=joy-task-english-v7";

if (!previous.some((reference) => source.includes(reference)) && !source.includes(next)) {
  throw new Error("Task English script reference was not found in dist/index.html");
}

let output = source;
previous.forEach((reference) => {
  output = output.replaceAll(reference, next);
});
await writeFile(indexPath, output);
console.log("Task English cache-busted to v7");
