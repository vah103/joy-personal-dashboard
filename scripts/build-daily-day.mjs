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

// Keep the current template-library iteration focused on the schedule itself.
// Remove the two secondary explanatory cards requested from the mockup review:
// the history/future info banner and the optional template note card.
builtScript = builtScript.replace(
  '<div class="dd-info">• ${esc(t("dailyDay.noteFuture"))}<br>• ${esc(t("dailyDay.noteHistory"))}</div>',
  '',
);
builtScript = builtScript.replace(
  '<div class="dd-note"><strong>${esc(t("dailyDay.templateNote"))}</strong><p>${esc(t("dailyDay.templateNoteCopy"))}</p></div>',
  '',
);

if (!builtScript.includes("data-dd-library-root") || !builtScript.includes("data-dd-open-library")) {
  throw new Error("Daily Day library wiring transform did not apply");
}
if (builtScript.includes('<div class="dd-info">• ${esc(t("dailyDay.noteFuture"))}')) {
  throw new Error("Daily Day template info banner removal did not apply");
}
if (builtScript.includes('<div class="dd-note"><strong>${esc(t("dailyDay.templateNote"))}')) {
  throw new Error("Daily Day template note removal did not apply");
}

await writeFile(scriptTarget, builtScript);
await cp(styleSource, styleTarget);

// Let Template schedule use the vertical space freed by the removed cards.
await appendFile(styleTarget, `
#daily-day-templates-modal .dd-detail > .dd-section {
  margin-top: 10px !important;
  margin-bottom: 8px !important;
}

#daily-day-templates-modal .dd-timeline {
  flex: 1 1 auto;
  min-height: 0;
}
`);

await appendFile(scriptTarget, `
;(() => {
  if (typeof document === "undefined" || document.querySelector('link[data-joy-daily-day-design="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/daily-day-design.css?v=joy-daily-day-design-v4";
  link.dataset.joyDailyDayDesign = "true";
  document.head.append(link);
})();
`);

console.log("Joy Daily Day frontend, focused template schedule, and approved mockup styling copied to dist");
