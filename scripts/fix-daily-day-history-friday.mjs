import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const script = await readFile(scriptTarget, "utf8");

if (script.includes('    "2026-09-18": {') || script.includes("HISTORICAL_DAYS")) {
  throw new Error("Legacy Daily Day Friday history unexpectedly remains");
}

console.log("Daily Day Friday history compatibility step skipped: legacy history is disabled");
