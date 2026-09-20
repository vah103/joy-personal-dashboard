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
  `const t = (key, values = {}) => window.JoyI18n?.t?.(key, values) || key;
  const scheduleText = (value) => String(value).startsWith("dailyDay.") ? t(value) : value;
  const WORKOUT_VARIANTS = Object.freeze(["chest", "back", "leg"]);
  const WORKOUT_MARKERS = Object.freeze({ "Chest-day": "chest", "Back day": "back", "Leg day": "leg" });
  const WORKOUT_LABELS = Object.freeze({ chest: "Chest-day", back: "Back day", leg: "Leg day" });
  const isWorkoutBlock = (templateId, block) => templateId === "sunday" && block?.[0] === "14:00";
  const workoutGroups = (items = []) => {
    const groups = { chest: [], back: [], leg: [] };
    let current = "";
    items.forEach((item, index) => {
      const marker = WORKOUT_MARKERS[item];
      if (marker) { current = marker; return; }
      if (current) groups[current].push({ item, index });
    });
    return groups;
  };
  const workoutChoice = (dateKey) => {
    const value = String(load().workouts?.[dateKey] || "chest");
    return WORKOUT_VARIANTS.includes(value) ? value : "chest";
  };
  const setWorkoutChoice = (dateKey, variant) => {
    if (!WORKOUT_VARIANTS.includes(variant)) return;
    const data = load();
    data.workouts ||= {};
    data.workouts[dateKey] = variant;
    save(data);
  };
  const visibleBlockItems = (dateKey, templateId, block) => {
    if (!isWorkoutBlock(templateId, block)) return block[2].map((item, index) => ({ item, index }));
    return workoutGroups(block[2])[workoutChoice(dateKey)] || [];
  };
  const workoutSwitch = (dateKey, compact = false) => {
    const active = workoutChoice(dateKey);
    return \`<div class="dd-workout-wrap \${compact ? "compact" : ""}"><div class="dd-workout-subheading">\${esc(WORKOUT_LABELS[active])}</div><div class="dd-workout-tabs" role="group" aria-label="Chọn buổi tập">\${WORKOUT_VARIANTS.map((variant) => \`<button type="button" class="\${variant === active ? "active" : ""}" data-dd-workout="\${variant}">\${esc(WORKOUT_LABELS[variant])}</button>\`).join("")}</div></div>\`;
  };`,
);
builtScript = builtScript.replaceAll('esc(t(block[1]))', 'esc(scheduleText(block[1]))');
builtScript = builtScript.replaceAll('esc(t(item))', 'esc(scheduleText(item))');

// Persist the selected workout split independently for every date.
builtScript = builtScript.replace(
  'return data && typeof data === "object" ? { overrides: data.overrides || {}, checks: data.checks || {} } : { overrides: {}, checks: {} };',
  'return data && typeof data === "object" ? { overrides: data.overrides || {}, checks: data.checks || {}, workouts: data.workouts || {} } : { overrides: {}, checks: {}, workouts: {} };',
);
builtScript = builtScript.replace(
  'catch { return { overrides: {}, checks: {} }; }',
  'catch { return { overrides: {}, checks: {}, workouts: {} }; }',
);

// Progress only counts the exercises for the workout selected for that day.
const oldStats = `  function stats(dateKey, templateId) {
    let total = 0; let complete = 0;
    blocks(templateId).forEach((block, blockIndex) => block[2].forEach((_, itemIndex) => { total += 1; if (checked(dateKey, itemId(templateId, blockIndex, itemIndex))) complete += 1; }));
    return { total, complete, remaining: total - complete };
  }`;
const newStats = `  function stats(dateKey, templateId) {
    let total = 0; let complete = 0;
    blocks(templateId).forEach((block, blockIndex) => visibleBlockItems(dateKey, templateId, block).forEach(({ index }) => { total += 1; if (checked(dateKey, itemId(templateId, blockIndex, index))) complete += 1; }));
    return { total, complete, remaining: total - complete };
  }`;
builtScript = builtScript.replace(oldStats, newStats);

// Main Daily Day: show Chest/Back/Leg as a sub-heading selector and render
// only the exercises for the selected workout.
const oldMainRows = '    const rows = dayBlocks.map((block, bi) => { const done = block[2].reduce((sum, _, ii) => sum + Number(checked(view.date, itemId(templateId, bi, ii))), 0); return `<article class="dd-block" style="animation-delay:${Math.min(bi * 45, 280)}ms"><time class="dd-time">${esc(block[0])}</time><div class="dd-body"><div class="dd-blockhead"><strong>${esc(scheduleText(block[1]))}</strong><small>${done}/${block[2].length}</small><span class="dd-track"><i style="width:${block[2].length ? Math.round(done / block[2].length * 100) : 0}%"></i></span></div><div class="dd-items">${block[2].map((item, ii) => { const id = itemId(templateId, bi, ii); return `<label class="dd-check"><input type="checkbox" data-dd-check="${id}" ${checked(view.date, id) ? "checked" : ""}><span>${esc(scheduleText(item))}</span></label>`; }).join("")}</div></div></article>`; }).join("");';
const newMainRows = '    const rows = dayBlocks.map((block, bi) => { const visibleItems = visibleBlockItems(view.date, templateId, block); const done = visibleItems.reduce((sum, entry) => sum + Number(checked(view.date, itemId(templateId, bi, entry.index))), 0); const workout = isWorkoutBlock(templateId, block); return `<article class="dd-block ${workout ? "dd-workout-block" : ""}" style="animation-delay:${Math.min(bi * 45, 280)}ms"><time class="dd-time">${esc(block[0])}</time><div class="dd-body"><div class="dd-blockhead"><strong>${esc(scheduleText(block[1]))}</strong><small>${done}/${visibleItems.length}</small><span class="dd-track"><i style="width:${visibleItems.length ? Math.round(done / visibleItems.length * 100) : 0}%"></i></span></div>${workout ? workoutSwitch(view.date) : ""}<div class="dd-items ${workout ? "dd-workout-items" : ""}">${visibleItems.map(({ item, index }) => { const id = itemId(templateId, bi, index); return `<label class="dd-check"><input type="checkbox" data-dd-check="${id}" ${checked(view.date, id) ? "checked" : ""}><span>${esc(scheduleText(item))}</span></label>`; }).join("")}</div></div></article>`; }).join("");';
builtScript = builtScript.replace(oldMainRows, newMainRows);

// Template preview: keep the same selector, but do not show the two unselected
// workout groups or their exercises.
const oldTimeline = '    const timeline = selectedBlocks.map((block) => `<div class="dd-timeline-row"><strong>${esc(block[0])}</strong><strong>${esc(scheduleText(block[1]))}</strong><div class="dd-template-items">${block[2].map((item) => `<span>${esc(scheduleText(item))}</span>`).join("")}</div></div>`).join("");';
const newTimeline = '    const timeline = selectedBlocks.map((block) => { const workout = isWorkoutBlock(selected, block); const visibleItems = visibleBlockItems(view.date, selected, block); return `<div class="dd-timeline-row ${workout ? "dd-workout-row" : ""}"><strong>${esc(block[0])}</strong><strong>${esc(scheduleText(block[1]))}</strong><div class="dd-template-items">${workout ? workoutSwitch(view.date, true) : ""}${visibleItems.map(({ item }) => `<span>${esc(scheduleText(item))}</span>`).join("")}</div></div>`; }).join("");';
builtScript = builtScript.replace(oldTimeline, newTimeline);

// A workout choice is a per-day setting, so switching it immediately rerenders
// both the Daily Day view and the open template preview.
builtScript = builtScript.replace(
  'const template = event.target.closest?.("[data-dd-template]"); if (template) { view.libraryTemplate = template.dataset.ddTemplate; renderLibrary(); return; }',
  'const workout = event.target.closest?.("[data-dd-workout]"); if (workout) { setWorkoutChoice(view.date, workout.dataset.ddWorkout); renderMain(); if (!document.querySelector(`#${LIBRARY_ID}`)?.hidden) renderLibrary(); return; }\n    const template = event.target.closest?.("[data-dd-template]"); if (template) { view.libraryTemplate = template.dataset.ddTemplate; renderLibrary(); return; }',
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
if (!builtScript.includes('["23:00", "đi ngủ", []]') || builtScript.includes('["08:30", "dailyDay.block.morningRoutine"')) {
  throw new Error("Daily Day Sunday document template transform did not apply");
}
if (!builtScript.includes("const scheduleText =") || !builtScript.includes("const workoutSwitch =")) {
  throw new Error("Daily Day literal text or workout selector transform did not apply");
}
if (!builtScript.includes("workouts: data.workouts || {}") || !builtScript.includes("visibleBlockItems(view.date")) {
  throw new Error("Daily Day per-day workout persistence/render transform did not apply");
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
// keep every checklist item on its own line, make each time block grow naturally,
// and present the workout split as one selectable sub-heading at a time.
await appendFile(styleTarget, `
#daily-day-templates-modal .dd-detail > .dd-section {
  margin-top: 10px !important;
  margin-bottom: 10px !important;
}

#daily-day-templates-modal .dd-timeline {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  overflow-y: auto;
}

#daily-day-templates-modal .dd-timeline-row {
  flex: 0 0 auto;
  width: 100%;
  box-sizing: border-box;
  min-height: 64px;
  height: auto;
  padding: 13px 14px;
  grid-template-columns: 68px minmax(150px, 220px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  overflow: visible;
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
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: max-content;
  align-content: start;
  align-self: start;
  gap: 7px;
  color: #60757d;
  font-size: 10px;
  line-height: 1.45;
  font-weight: 600;
}

#daily-day-templates-modal .dd-template-items span {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  white-space: normal;
  overflow: visible;
}

#daily-day-templates-modal .dd-template-items span::before {
  flex: 0 0 auto;
  margin-top: 1px;
  margin-right: 6px;
}

.dd-workout-wrap {
  margin: 9px 0 8px;
  padding: 10px 11px;
  border: 1px solid #d9e6e5;
  border-radius: 11px;
  background: #f1f7f6;
}

.dd-workout-subheading {
  margin-bottom: 8px;
  color: #294e59;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 900;
}

.dd-workout-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dd-workout-tabs button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid #cfdedd;
  border-radius: 999px;
  background: #ffffff;
  color: #587078;
  font: inherit;
  font-size: 9.5px;
  font-weight: 800;
  cursor: pointer;
}

.dd-workout-tabs button.active {
  border-color: #5e9291;
  background: #5e9291;
  color: #ffffff;
}

#daily-day-templates-modal .dd-workout-wrap.compact {
  margin: 0 0 4px;
  padding: 8px 9px;
}

#daily-day-templates-modal .dd-workout-wrap.compact + span {
  margin-top: 2px;
}

#daily-day-modal .dd-workout-items {
  display: grid;
  grid-template-columns: 1fr;
  gap: 7px;
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

  .dd-workout-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  .dd-workout-tabs button {
    padding: 0 6px;
  }
}
`);

await appendFile(scriptTarget, `
;(() => {
  if (typeof document === "undefined" || document.querySelector('link[data-joy-daily-day-design="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/daily-day-design.css?v=joy-daily-day-design-v7";
  link.dataset.joyDailyDayDesign = "true";
  document.head.append(link);
})();
`);

console.log("Joy Daily Day frontend, exact Sunday template, per-day workout sub-heading selector, and auto-growing rows copied to dist");
