import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const appTarget = resolve(root, "dist", "app.js");

const script = await readFile(scriptTarget, "utf8");
if (!script.includes('const TEMPLATE_IDS = ["morning", "afternoon", "no_workout"]')) {
  throw new Error("Daily Day three-template contract missing before history cleanup");
}
if (script.includes("HISTORICAL_DAYS") || script.includes("__JOY_DAILY_DAY_HISTORY_BACKFILL__")) {
  throw new Error("Legacy Daily Day historical exceptions are still present");
}
execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v24").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v25").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day history cleanup: v24 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day legacy 16-19 Sep history exceptions disabled; cache bumped to v25");
