import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const appTarget = resolve(root, "dist", "app.js");

let script = await readFile(scriptTarget, "utf8");

const footer = '<footer class="dd-footer"><button class="dd-button" type="button" data-dd-today>${esc(t("dailyDay.today"))}</button><button class="dd-button primary" type="button" data-dd-save>${esc(t("dailyDay.saveChanges"))}</button></footer>';
const footerCount = script.split(footer).length - 1;
if (footerCount !== 1) {
  throw new Error(`Expected exactly one Daily Day footer; found ${footerCount}`);
}
script = script.replace(footer, "");

if (script.includes('<footer class="dd-footer">') || script.includes('type="button" data-dd-save')) {
  throw new Error("Daily Day bottom Today / Save changes controls were not removed");
}

await writeFile(scriptTarget, script);
execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v29").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v30").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day footer cleanup: v29 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day bottom Today / Save changes controls removed and cache bumped to v30");
