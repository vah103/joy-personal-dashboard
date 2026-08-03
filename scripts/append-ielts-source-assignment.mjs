import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "src", "features", "ielts", "source-assignment.js");
const bundlePath = resolve(root, "dist", "project-data", "ielts", "ielts-core-bundle.js");
const source = await readFile(sourcePath, "utf8");
const bundle = await readFile(bundlePath, "utf8");

new Function(source);

const anchor = "\n})();\n";
const index = bundle.lastIndexOf(anchor);
if (index === -1) {
  throw new Error("IELTS bundle closing anchor was not found.");
}
if (bundle.includes("IELTS_SOURCE_LIBRARY_URL")) {
  throw new Error("IELTS source assignment was already appended.");
}

const output = `${bundle.slice(0, index)}\n\n${source.trim()}\n${bundle.slice(index)}`;
await writeFile(bundlePath, output);
console.log("IELTS random source assignment appended to frontend bundle");
