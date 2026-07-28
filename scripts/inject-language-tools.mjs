import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(root, "dist", "index.html");

const STYLE_MARKER = "joy-language-tools-styles";
const SCRIPT_MARKER = "joy-language-tools-scripts";

const styles = `    <!-- ${STYLE_MARKER} -->
    <link rel="stylesheet" href="/project-data/vocabulary/vocabulary.css?v=joy-vocabulary-v2">
    <link rel="stylesheet" href="/project-data/speaking/speaking.css?v=joy-speaking-v2">
`;

const scripts = `    <!-- ${SCRIPT_MARKER} -->
    <script src="/project-data/vocabulary/vocabulary.js?v=joy-vocabulary-v2" defer></script>
    <script src="/project-data/speaking/speaking.js?v=joy-speaking-v2" defer></script>
`;

let html = await readFile(indexPath, "utf8");

if (!html.includes(STYLE_MARKER)) {
  if (!html.includes("</head>")) throw new Error("Dashboard build is missing </head>");
  html = html.replace("</head>", `${styles}  </head>`);
}

if (!html.includes(SCRIPT_MARKER)) {
  if (!html.includes("</body>")) throw new Error("Dashboard build is missing </body>");
  html = html.replace("</body>", `${scripts}  </body>`);
}

await writeFile(indexPath, html);
console.log("Hey Joy! language tools attached to the dashboard build");
