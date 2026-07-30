import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const indexPath = resolve(import.meta.dirname, "..", "dist", "index.html");
const source = await readFile(indexPath, "utf8");
const previous = ["joy-finance-p1008-v1", "joy-finance-p1008-v2"];
const next = "joy-finance-p1008-v3";

if (!previous.some((reference) => source.includes(reference)) && !source.includes(next)) {
  throw new Error("P1008 asset references were not found in dist/index.html");
}

let output = source;
previous.forEach((reference) => {
  output = output.replaceAll(reference, next);
});

const refineStyles = '      <link rel="stylesheet" href="project-data/finance/finance-p1008-refine-v3.css?v=joy-finance-p1008-refine-v3">';
const refineScript = '      <script src="project-data/finance/finance-p1008-refine-v3.js?v=joy-finance-p1008-refine-v3" defer></script>';

if (!output.includes("finance-p1008-refine-v3.css")) {
  output = output.replace("</head>", `${refineStyles}\n${refineScript}\n  </head>`);
}

await writeFile(indexPath, output);
console.log("P1008 assets cache-busted and refined to v3");
