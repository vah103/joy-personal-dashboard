import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const appTarget = resolve(root, "dist", "app.js");

let script = await readFile(scriptTarget, "utf8");

// The built Daily Day bundle contains more than one rendered surface with the
// same footer class. Remove every actual footer element; the approved main
// toolbar is the compact week/template/calendar/edit row above the schedule.
const footerPattern = /<footer class="dd-footer">[\s\S]*?<\/footer>/g;
const footers = script.match(footerPattern) || [];
if (!footers.length) {
  throw new Error("Daily Day bottom footer markup was not found");
}
script = script.replace(footerPattern, "");

if (script.includes('<footer class="dd-footer">')) {
  throw new Error("Daily Day bottom Today / Save changes footer was not fully removed");
}
if (!script.includes("dd-toolbar-compact") || !script.includes("dd-template-select") || !script.includes("dd-calendar-icon") || !script.includes("dd-edit-icon")) {
  throw new Error("Daily Day compact toolbar was removed unexpectedly");
}
if (script.includes('<div class="dd-templatebar">') || script.includes('data-dd-tomorrow>Tomorrow</button>')) {
  throw new Error("Legacy Daily Day second control row survived footer cleanup");
}

await writeFile(scriptTarget, script);
execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v29").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v30").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day footer cleanup: v29 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log(`Daily Day removed ${footers.length} bottom footer(s), preserved compact toolbar, and bumped cache to v30`);
