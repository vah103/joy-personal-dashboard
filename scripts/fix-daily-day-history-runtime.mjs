import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const appTarget = resolve(root, "dist", "app.js");

const script = await readFile(scriptTarget, "utf8");
if (script.includes("history:" + "$" + "{dateKey}:")) {
  throw new Error("Legacy Daily Day history runtime IDs unexpectedly remain");
}
execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v25").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v27").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day runtime validation: v25 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day three-template runtime validated and cache bumped to v27");
