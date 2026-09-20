import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const appTarget = resolve(root, "dist", "app.js");

let script = await readFile(scriptTarget, "utf8");

// build-daily-day-history.mjs uses String.raw around generated source. The two
// nested template literals therefore reached dist with literal backslashes
// before the backticks / ${...}, which makes daily-day.js fail to parse and
// prevents the To-do List click handler from ever being installed.
const brokenHistoryId = "\\`history:\\${dateKey}:\\${blockIndex}:\\${itemIndex}\\`";
const fixedHistoryId = "`history:${dateKey}:${blockIndex}:${itemIndex}`";
const occurrences = script.split(brokenHistoryId).length - 1;
if (occurrences !== 2) {
  throw new Error(`Expected 2 broken Daily Day history template literals; found ${occurrences}`);
}
script = script.replaceAll(brokenHistoryId, fixedHistoryId);
await writeFile(scriptTarget, script);

// Validate the final generated module so a broken Daily Day bundle cannot be
// deployed silently again (the dashboard import intentionally catches errors).
execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v25").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v26").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day runtime fix: v25 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day history runtime syntax fixed, validated, and cache bumped to v26");
