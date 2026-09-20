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

// Sunday must mirror the user's Daily day document instead of the generic
// placeholder schedule. Keep the original Vietnamese wording from the doc.
const oldSunday = `    sunday: [
      ["08:30", "dailyDay.block.morningRoutine", ["dailyDay.item.hygiene", "dailyDay.item.breakfast", "dailyDay.item.prepareDay"]],
      ["09:00", "dailyDay.block.work", ["dailyDay.item.mainWork", "dailyDay.item.progressNote"]],
      ["10:00", "dailyDay.block.lunch", ["dailyDay.item.lunch", "dailyDay.item.prepareTomorrow"]],
      ["11:00", "dailyDay.block.work", ["dailyDay.item.mainWork", "dailyDay.item.checkLog"]],
      ["14:00", "dailyDay.block.exercise", ["dailyDay.item.warmup", "dailyDay.item.workout", "dailyDay.item.stretch"]],
      ["18:00", "dailyDay.block.english", ["dailyDay.item.englishReview", "dailyDay.item.shadowing"]],
      ["19:00", "dailyDay.block.evening", ["dailyDay.item.planTomorrow"]],
      ["22:00", "dailyDay.block.rest", ["dailyDay.item.relax"]],
    ],`;
const sundayFromDocs = `    sunday: [
      ["08:30", "dậy", ["luộc trứng", "đánh răng", "ăn trứng", "pha trà", "cho quần áo giặt", "ngâm nồi cơm", "chuẩn bị thức ăn định nấu"]],
      ["09:00", "", ["uống trà", "cắm cơm", "nghiên cứu phòng"]],
      ["10:00", "", ["nấu thức ăn", "ăn", "phơi quần áo"]],
      ["11:00", "làm đồ án", ["ngâm nồi cơm", "uống dht"]],
      ["12:00", "làm đồ án", []],
      ["13:00", "làm đồ án", []],
      ["14:00", "đi tập", ["Chest-day", "Warmup : bec deck + đẩy tạ đơn 17.5", "Đẩy tạ đơn 22.5x2 (7)", "Đẩy máy smith 25x3 (6)", "Bec deck 130x3 (8)", "Đẩy vai trước 60x3 (8)", "Bay vai 12.5x3 (10)", "Back day", "Warm-up : kéo xà x2 (6)", "Kéo dây 36x2 (10)", "Kéo lat 110x4 (8)", "Kéo trap 120x4 (8)", "Vai sau 100x3 (8)", "Leg day", "Calf raise 40x4", "Tập bụng 90x4", "Hack Squad …x3", "Leg Extension 120x3 (8)", "Leg Curl 90x3 (7)"]],
      ["15:30", "đi về", ["cắm cơm", "tắm gội", "rửa mặt", "uống finas"]],
      ["16:30", "", ["đi mua rau", "đi bộ", "nấu rau", "nấu thức ăn", "ăn"]],
      ["18:00", "học tiếng anh qua AI", []],
      ["19:00", "làm đồ án", ["soạn schedule", "xịt minoxidil", "rã đông thịt"]],
      ["20:00", "làm đồ án", []],
      ["21:00", "làm đồ án", []],
      ["22:00", "giải trí", []],
      ["23:00", "đi ngủ", []],
    ],`;
builtScript = builtScript.replace(oldSunday, sundayFromDocs);

// Literal schedule content from the document must stay literal even when the
// rest of Joy is using another UI locale. Translation keys still use JoyI18n.
builtScript = builtScript.replace(
  'const t = (key, values = {}) => window.JoyI18n?.t?.(key, values) || key;',
  'const t = (key, values = {}) => window.JoyI18n?.t?.(key, values) || key;\n  const scheduleText = (value) => String(value).startsWith("dailyDay.") ? t(value) : value;',
);
builtScript = builtScript.replaceAll('esc(t(block[1]))', 'esc(scheduleText(block[1]))');
builtScript = builtScript.replaceAll('esc(t(item))', 'esc(scheduleText(item))');

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
if (!builtScript.includes('["23:00", "đi ngủ", []]') || builtScript.includes('["08:30", "dailyDay.block.morningRoutine"')) {
  throw new Error("Daily Day Sunday document template transform did not apply");
}
if (!builtScript.includes("const scheduleText =")) {
  throw new Error("Daily Day literal schedule text transform did not apply");
}
if (builtScript.includes('<div class="dd-info">• ${esc(t("dailyDay.noteFuture"))}')) {
  throw new Error("Daily Day template info banner removal did not apply");
}
if (builtScript.includes('<div class="dd-note"><strong>${esc(t("dailyDay.templateNote"))}')) {
  throw new Error("Daily Day template note removal did not apply");
}

await writeFile(scriptTarget, builtScript);
await cp(styleSource, styleTarget);

// Let Template schedule use the vertical space freed by the removed cards,
// and present every checklist item on its own line like the Daily day doc.
await appendFile(styleTarget, `
#daily-day-templates-modal .dd-detail > .dd-section {
  margin-top: 10px !important;
  margin-bottom: 10px !important;
}

#daily-day-templates-modal .dd-timeline {
  flex: 1 1 auto;
  min-height: 0;
  gap: 10px;
}

#daily-day-templates-modal .dd-timeline-row {
  min-height: 64px;
  padding: 12px 14px;
  grid-template-columns: 68px minmax(150px, 220px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

#daily-day-templates-modal .dd-timeline-row::before {
  top: 24px;
  transform: none;
}

#daily-day-templates-modal .dd-timeline-row > strong:first-child {
  margin-top: 0;
}

#daily-day-templates-modal .dd-timeline-row > strong:nth-child(2) {
  padding-top: 5px;
  line-height: 1.35;
}

#daily-day-templates-modal .dd-template-items {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  color: #60757d;
  font-size: 10px;
  line-height: 1.4;
  font-weight: 600;
}

#daily-day-templates-modal .dd-template-items span {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  white-space: normal;
}

#daily-day-templates-modal .dd-template-items span::before {
  flex: 0 0 auto;
  margin-top: 1px;
  margin-right: 6px;
}

@media (max-width: 980px) {
  #daily-day-templates-modal .dd-timeline-row {
    grid-template-columns: 62px minmax(125px, 180px) minmax(0, 1fr);
    gap: 12px;
  }
}

@media (max-width: 760px) {
  #daily-day-templates-modal .dd-timeline-row {
    grid-template-columns: 58px minmax(0, 1fr);
    padding: 12px;
    gap: 10px;
  }

  #daily-day-templates-modal .dd-template-items {
    grid-column: 1 / -1;
    padding-left: 68px;
  }
}
`);

await appendFile(scriptTarget, `
;(() => {
  if (typeof document === "undefined" || document.querySelector('link[data-joy-daily-day-design="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/daily-day-design.css?v=joy-daily-day-design-v5";
  link.dataset.joyDailyDayDesign = "true";
  document.head.append(link);
})();
`);

console.log("Joy Daily Day frontend, exact Sunday document template, expanded one-item-per-line schedule, and approved mockup styling copied to dist");
