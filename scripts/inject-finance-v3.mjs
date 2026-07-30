import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(root, "dist", "index.html");
const financeCorePath = resolve(root, "dist", "finance-demo.js");

const amountPolicyScript = '    <script src="project-data/finance/finance-amount-policy-v3.js?v=joy-finance-amount-policy-v5"></script>\n';
const financeStyles = '    <link rel="stylesheet" href="project-data/finance/finance-breakdown-v2.css?v=joy-finance-breakdown-v2">\n';
const breakdownScript = '    <script src="project-data/finance/finance-breakdown-v2.js?v=joy-finance-breakdown-v2" defer></script>\n';

let html = await readFile(indexPath, "utf8");
html = html
  .replace(/\s*<script src="project-data\/finance\/finance-amount-policy-v3\.js\?v=[^"']+"(?: defer)?><\/script>\n?/g, "")
  .replace(/finance-demo\.js\?v=[^"']+/g, "finance-demo.js?v=joy-finance-core-v8");

const coreScriptPattern = /([ \t]*<script src="finance-demo\.js\?v=joy-finance-core-v8" defer><\/script>\n?)/;
if (!coreScriptPattern.test(html)) {
  throw new Error("Finance core script reference was not found in dist/index.html");
}
html = html.replace(coreScriptPattern, `${amountPolicyScript}$1`);

if (!html.includes("finance-breakdown-v2.css?v=joy-finance-breakdown-v2")) {
  if (!html.includes("</head>")) throw new Error("Closing head tag was not found in dist/index.html");
  html = html.replace("</head>", `${financeStyles}  </head>`);
}
if (!html.includes("finance-breakdown-v2.js?v=joy-finance-breakdown-v2")) {
  if (!html.includes("</body>")) throw new Error("Closing body tag was not found in dist/index.html");
  html = html.replace("</body>", `${breakdownScript}  </body>`);
}

const amountIndex = html.indexOf("finance-amount-policy-v3.js?v=joy-finance-amount-policy-v5");
const coreIndex = html.indexOf("finance-demo.js?v=joy-finance-core-v8");
if (amountIndex < 0 || coreIndex < 0 || amountIndex > coreIndex) {
  throw new Error("Finance amount policy must load before Finance core");
}

let financeCore = await readFile(financeCorePath, "utf8");
const legacyInput = 'input name="amount" type="number" min="1" step="1000" inputmode="numeric"';
const safeInput = 'input name="amount" type="text" inputmode="numeric" autocomplete="off"';
if (!financeCore.includes(legacyInput) && !financeCore.includes(safeInput)) {
  throw new Error("Finance amount input markup was not found in dist/finance-demo.js");
}
financeCore = financeCore.replaceAll(legacyInput, safeInput);
if (financeCore.includes('name="amount" type="number"') || financeCore.includes('step="1000"')) {
  throw new Error("Finance production bundle still contains native number-step validation");
}

await Promise.all([
  writeFile(indexPath, html),
  writeFile(financeCorePath, financeCore),
]);