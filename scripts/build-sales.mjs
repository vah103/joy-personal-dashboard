import { cp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "src", "features", "sales");
const destination = resolve(root, "dist", "sales");

await cp(source, destination, { recursive: true });

const wrappers = new Map([
  ["sales-assistant.js", 'import "./sales/assistant/sales-assistant.js";\n'],
  ["sale-history-row-edit.js", 'import "./sales/appointments/history.js";\n'],
  ["sale-manager.js", 'import "./sales/manager/sale-manager.js";\n'],
]);

await Promise.all(
  [...wrappers].map(([file, content]) => writeFile(resolve(root, "dist", file), content)),
);

console.log("Sale frontend tree copied with compatibility entrypoints");
