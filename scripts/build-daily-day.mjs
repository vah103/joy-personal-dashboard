import { appendFile, cp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceDir = resolve(root, "src", "features", "daily-day");
const scriptSource = resolve(sourceDir, "daily-day.js");
const styleSource = resolve(sourceDir, "daily-day-design.css");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const styleTarget = resolve(root, "dist", "daily-day-design.css");

const source = await readFile(scriptSource, "utf8");

// The v1 markup reused data-dd-library for both the modal render root and
// the two buttons that open the template library. document.querySelector()
// therefore selected the first button and rendered the whole library inside
// that button, which is why the UI looked like a small nested panel.
// Keep source compatibility for now and correct the public build wiring here.
let builtScript = source.replace(
  'data-dd-library></div></section>\'; document.body.append(modal);',
  'data-dd-library-root></div></section>\'; document.body.append(modal);',
);
builtScript = builtScript.replaceAll(" data-dd-library>", " data-dd-open-library>");
builtScript = builtScript.replace(
  'document.querySelector("[data-dd-library]")',
  'document.querySelector("[data-dd-library-root]")',
);
builtScript = builtScript.replace(
  'event.target.closest?.("[data-dd-library]")',
  'event.target.closest?.("[data-dd-open-library]")',
);

if (!builtScript.includes("data-dd-library-root") || !builtScript.includes("data-dd-open-library")) {
  throw new Error("Daily Day library wiring transform did not apply");
}

await writeFile(scriptTarget, builtScript);
await cp(styleSource, styleTarget);

await appendFile(scriptTarget, `
;(() => {
  if (typeof document === "undefined" || document.querySelector('link[data-joy-daily-day-design="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/daily-day-design.css?v=joy-daily-day-design-v3";
  link.dataset.joyDailyDayDesign = "true";
  document.head.append(link);
})();
`);

console.log("Joy Daily Day frontend, library wiring fix, and approved mockup styling copied to dist");
