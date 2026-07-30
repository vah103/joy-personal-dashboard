import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const amountSourcePath = resolve(root, "src", "features", "finance", "finance-amount-core.js");
const financeSourcePath = resolve(root, "src", "features", "finance", "finance.js");
const financeBundlePath = resolve(root, "dist", "finance-demo.js");

const [amountSource, financeSource] = await Promise.all([
  readFile(amountSourcePath, "utf8"),
  readFile(financeSourcePath, "utf8"),
]);

if (!amountSource.includes("JoyFinanceAmount")) {
  throw new Error("Finance amount source does not register JoyFinanceAmount");
}
if (!financeSource.includes("window.JoyFinanceAmount")) {
  throw new Error("Finance core does not consume JoyFinanceAmount");
}

const bundle = `${amountSource.trim()}\n\n${financeSource.trim()}\n`;
await writeFile(financeBundlePath, bundle);

console.log("Finance source bundle built directly at v9");
