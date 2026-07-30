import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const indexPath = resolve(import.meta.dirname, "..", "dist", "index.html");
const source = await readFile(indexPath, "utf8");
const previous = "joy-finance-p1008-v1";
const next = "joy-finance-p1008-v2";

if (!source.includes(previous) && !source.includes(next)) {
  throw new Error("P1008 asset references were not found in dist/index.html");
}

await writeFile(indexPath, source.replaceAll(previous, next));
console.log("P1008 assets cache-busted to v2");
