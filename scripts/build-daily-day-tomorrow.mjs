import { execFileSync } from "node:child_process";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const styleTarget = resolve(root, "dist", "daily-day-design.css");
const appTarget = resolve(root, "dist", "app.js");

let script = await readFile(scriptTarget, "utf8");

const templateBarAnchor = '<div class="dd-templatebar"><label>${esc(t("dailyDay.defaultDay"))}</label><select class="dd-select" data-dd-select>';
const templateBarReplacement = '<div class="dd-templatebar"><label>${esc(t("dailyDay.defaultDay"))}</label><div class="dd-day-shortcuts" role="group" aria-label="Quick day navigation"><button class="dd-button dd-day-shortcut" type="button" data-dd-today>Today</button><button class="dd-button dd-day-shortcut" type="button" data-dd-tomorrow>Tomorrow</button></div><select class="dd-select" data-dd-select>';
if (!script.includes(templateBarAnchor)) throw new Error("Daily Day Today/Tomorrow: template bar anchor missing");
script = script.replace(templateBarAnchor, templateBarReplacement);

const todayHandler = 'if (event.target.closest?.("[data-dd-today]")) { view.date = todayKey(); renderMain(); return; }';
const tomorrowHandler = 'if (event.target.closest?.("[data-dd-tomorrow]")) { view.date = addDays(todayKey(), 1); renderMain(); return; }\n    ' + todayHandler;
if (!script.includes(todayHandler)) throw new Error("Daily Day Today/Tomorrow: Today handler anchor missing");
script = script.replace(todayHandler, tomorrowHandler);

// Treat Tomorrow like Today for account-sync refreshes and UI enhancers.
script = script.replaceAll('#todo-title,[data-dd-today]', '#todo-title,[data-dd-today],[data-dd-tomorrow]');
script = script.replaceAll('#todo-title,[data-dd-date],[data-dd-today]', '#todo-title,[data-dd-date],[data-dd-today],[data-dd-tomorrow]');
script = script.replaceAll('#todo-title,[data-dd-date],[data-dd-workout],[data-dd-today]', '#todo-title,[data-dd-date],[data-dd-workout],[data-dd-today],[data-dd-tomorrow]');

if (!script.includes('data-dd-today>Today</button><button') || !script.includes('data-dd-tomorrow') || !script.includes('addDays(todayKey(), 1)')) {
  throw new Error("Daily Day Today/Tomorrow: shortcut transform did not apply");
}
await writeFile(scriptTarget, script);
execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

await appendFile(styleTarget, `
/* Daily Day Today / Tomorrow shortcuts */
#daily-day-modal .dd-templatebar{grid-template-columns:auto auto minmax(190px,1fr) auto auto!important}
#daily-day-modal .dd-day-shortcuts{display:inline-grid;grid-template-columns:repeat(2,auto);gap:6px;align-items:center}
#daily-day-modal .dd-day-shortcut{white-space:nowrap;padding-inline:13px;background:#eef4f2;color:#4f7378;border-color:#d2dfdc}
#daily-day-modal .dd-day-shortcut:hover{background:#e4efec;border-color:#bcd1cc}
@media(max-width:760px){
  #daily-day-modal .dd-templatebar{grid-template-columns:1fr auto!important}
  #daily-day-modal .dd-templatebar>label{grid-column:1!important;align-self:center}
  #daily-day-modal .dd-day-shortcuts{grid-column:2!important}
  #daily-day-modal .dd-templatebar>.dd-select{grid-column:1/-1!important}
  #daily-day-modal .dd-day-shortcut{padding-inline:10px}
}
`);

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v27").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v29").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day Today/Tomorrow: v27 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day Today/Tomorrow shortcuts added and cache bumped to v29");
