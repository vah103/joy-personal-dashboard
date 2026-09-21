import { execFileSync } from "node:child_process";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const appTarget = resolve(root, "dist", "app.js");

await appendFile(scriptTarget, `
;(() => {
  if (document.querySelector("#joy-daily-day-streak-font-v1")) return;
  const style = document.createElement("style");
  style.id = "joy-daily-day-streak-font-v1";
  style.textContent = "#daily-day-modal .dd-streak strong,#daily-day-modal .dd-streak small{font-size:10.5px!important}";
  document.head.append(style);
})();
`);

execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v31").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v32").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day streak font: v31 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day streak labels and counts increased by 1px; cache bumped to v32");
