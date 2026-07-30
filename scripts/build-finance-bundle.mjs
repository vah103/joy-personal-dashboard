import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const amountSourcePath = resolve(root, "src", "features", "finance", "finance-amount-core.js");
const financeSourcePath = resolve(root, "src", "features", "finance", "finance.js");
const financeBundlePath = resolve(root, "dist", "finance-demo.js");
const indexPath = resolve(root, "dist", "index.html");
const previousAsset = "finance-demo.js?v=joy-finance-core-v4";
const currentAsset = "finance-demo.js?v=joy-finance-core-v9";

const [amountSource, financeSource, indexSource] = await Promise.all([
  readFile(amountSourcePath, "utf8"),
  readFile(financeSourcePath, "utf8"),
  readFile(indexPath, "utf8"),
]);

if (!amountSource.includes("JoyFinanceAmount")) {
  throw new Error("Finance amount source does not register JoyFinanceAmount");
}
if (!financeSource.includes("window.JoyFinanceAmount")) {
  throw new Error("Finance core does not consume JoyFinanceAmount");
}

const bundle = `${amountSource.trim()}\n\n${financeSource.trim()}\n`;
let index = indexSource;
if (index.includes(previousAsset)) {
  index = index.replaceAll(previousAsset, currentAsset);
} else if (!index.includes(currentAsset)) {
  throw new Error("Finance bundle reference was not found in dist/index.html");
}

await Promise.all([
  writeFile(financeBundlePath, bundle),
  writeFile(indexPath, index),
]);

console.log("Finance source bundle built directly at v9");
