import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(root, "dist", "index.html");
const financePath = resolve(root, "dist", "finance-demo.js");
const turtleBotTabsScript = '    <script src="project-data/turtlebot4/project-hub-tabs-v1.js?v=turtlebot-hub-tabs-v1" defer></script>\n';

let html = await readFile(indexPath, "utf8");
html = html
  .replaceAll("project-hub-performance.js?v=turtlebot-hub-v5", "project-hub-performance.js?v=turtlebot-read-only-plan-v1")
  .replaceAll("finance-demo.js?v=joy-finance-core-v4", "finance-demo.js?v=joy-finance-core-v5")
  .replaceAll("finance-amount-shortcut-v1.js?v=joy-finance-amount-shortcut-v1", "finance-amount-shortcut-v1.js?v=joy-finance-amount-shortcut-v3")
  .replaceAll("finance-amount-shortcut-v1.js?v=joy-finance-amount-shortcut-v2", "finance-amount-shortcut-v1.js?v=joy-finance-amount-shortcut-v3");

if (!html.includes("project-hub-performance.js?v=turtlebot-read-only-plan-v1")) {
  throw new Error("TurtleBot Project Hub script reference was not found in dist/index.html");
}
if (!html.includes("finance-demo.js?v=joy-finance-core-v5")) {
  throw new Error("Finance core script reference was not cache-busted in dist/index.html");
}
if (!html.includes("finance-amount-shortcut-v1.js?v=joy-finance-amount-shortcut-v3")) {
  throw new Error("Finance amount shortcut script reference was not found in dist/index.html");
}

if (!html.includes("project-hub-tabs-v1.js?v=turtlebot-hub-tabs-v1")) {
  if (!html.includes("</body>")) throw new Error("Closing body tag was not found in dist/index.html");
  html = html.replace("</body>", `${turtleBotTabsScript}  </body>`);
}

let finance = await readFile(financePath, "utf8");
if (!finance.includes('step="1000"') && !finance.includes('step="1"')) {
  throw new Error("Finance amount input step was not found in dist/finance-demo.js");
}
finance = finance.replaceAll('step="1000"', 'step="1"');

await Promise.all([
  writeFile(indexPath, html),
  writeFile(financePath, finance),
]);