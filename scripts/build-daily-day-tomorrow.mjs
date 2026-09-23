import { execFileSync } from "node:child_process";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const styleTarget = resolve(root, "dist", "daily-day-design.css");
const appTarget = resolve(root, "dist", "app.js");

const script = await readFile(scriptTarget, "utf8");

// This build stage used to add Today / Tomorrow shortcuts. The approved compact
// layout now keeps a single control row: week tabs + template + calendar + edit.
for (const required of [
  "dd-toolbar-compact",
  "dd-template-select",
  "dd-calendar-icon",
  "dd-edit-icon",
]) {
  if (!script.includes(required)) throw new Error(`Daily Day compact toolbar missing: ${required}`);
}
if (script.includes('<div class="dd-templatebar">') || script.includes('data-dd-tomorrow>Tomorrow</button>')) {
  throw new Error("Legacy Daily Day second control row is still rendered");
}

execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

await appendFile(styleTarget, `
/* Daily Day compact single-row controls */
@media(max-width:900px){
  #daily-day-modal .dd-toolbar{grid-template-columns:minmax(0,1fr) 38px 38px!important}
  #daily-day-modal .dd-week{grid-column:1/-1}
  #daily-day-modal .dd-template-select{grid-column:1}
}
`);

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v27").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v29").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day compact toolbar: v27 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day compact single-row toolbar validated and cache bumped to v29");
