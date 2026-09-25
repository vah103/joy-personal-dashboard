import { execFileSync } from "node:child_process";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const appTarget = resolve(root, "dist", "app.js");

// The main Daily Day typography already raises streak labels/counts to 12.5px.
// Increase only those two text elements by exactly 1px, without touching the
// check circle, progress bar, spacing, or row geometry.
await appendFile(scriptTarget, `
;(() => {
  if (document.querySelector("#joy-daily-day-streak-font-v2")) return;
  const style = document.createElement("style");
  style.id = "joy-daily-day-streak-font-v2";
  style.textContent = "#daily-day-modal .dd-streak strong,#daily-day-modal .dd-streak small{font-size:13.5px!important}";
  document.head.append(style);
})();
`);

execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v36").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v41").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day streak font: v36 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day streak labels/counts corrected from 12.5px to 13.5px; cache bumped to v41");
