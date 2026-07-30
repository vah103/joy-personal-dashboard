import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const indexPath = resolve(import.meta.dirname, "..", "dist", "index.html");
const source = await readFile(indexPath, "utf8");
const next = source
  .replaceAll(
    "finance-p1008-shopping-tables-v1.css?v=joy-finance-p1008-shopping-tables-v1",
    "finance-p1008-shopping-tables-v1.css?v=joy-finance-p1008-shopping-tables-v3",
  )
  .replaceAll(
    "finance-p1008-shopping-tables-v1.js?v=joy-finance-p1008-shopping-tables-v2",
    "finance-p1008-shopping-tables-v1.js?v=joy-finance-p1008-shopping-tables-v3",
  );

if (next === source) {
  throw new Error("P1008 shopping table asset references were not found in dist/index.html");
}

await writeFile(indexPath, next);
console.log("P1008 shopping table assets refreshed to v3");
