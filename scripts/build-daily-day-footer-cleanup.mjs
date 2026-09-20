import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const appTarget = resolve(root, "dist", "app.js");

let script = await readFile(scriptTarget, "utf8");

// The built Daily Day bundle contains more than one rendered surface with the
// same footer class. Remove every actual footer element while leaving the
// top-bar Today / Tomorrow shortcuts and their event handlers intact.
const footerPattern = /<footer class="dd-footer">[\s\S]*?<\/footer>/g;
const footers = script.match(footerPattern) || [];
if (!footers.length) {
  throw new Error("Daily Day bottom footer markup was not found");
}
script = script.replace(footerPattern, "");

if (script.includes('<footer class="dd-footer">')) {
  throw new Error("Daily Day bottom Today / Save changes footer was not fully removed");
}
if (!script.includes('data-dd-today') || !script.includes('data-dd-tomorrow')) {
  throw new Error("Daily Day top Today / Tomorrow shortcuts were removed unexpectedly");
}

await writeFile(scriptTarget, script);
execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v29").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v30").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day footer cleanup: v29 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log(`Daily Day removed ${footers.length} bottom footer(s) and bumped cache to v30`);
