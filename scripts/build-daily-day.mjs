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
// the two buttons that open the template library. Keep source compatibility
// and correct the public build wiring here.
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

// Replace every generic template with the literal schedules from Daily day.
// These are the nine canonical Default day templates: tập sáng, tập chiều,
// Monday through Sunday.
const docsTemplateSource = `  const earlyRoutine = Object.freeze(["luộc trứng", "đánh răng", "ăn trứng", "pha trà", "cho quần áo giặt", "ngâm nồi cơm"]);
  const afterGym = Object.freeze(["uống trà", "cắm cơm", "tắm gội", "chuẩn bị thức ăn", "phơi quần áo"]);
  const eatingRoutine = Object.freeze(["không xem gì khi ăn", "uống dht", "đánh răng", "ngâm nồi cơm"]);
  const eveningReturn = Object.freeze(["cắm cơm", "đi bộ mua rau", "chuẩn bị đồ ăn", "tắm gội", "rửa mặt", "ăn"]);
  const projectEvening = Object.freeze(["soạn schedule", "xịt minoxidil", "rã đông thịt"]);
  const workoutItems = Object.freeze([
    "Chest-day",
    "Warmup : bec deck + đẩy tạ đơn 17.5",
    "Đẩy tạ đơn 22.5x2 (7)",
    "Đẩy máy smith 25x3 (6)",
    "Bec deck 130x3 (8)",
    "Đẩy vai trước 60x3 (8)",
    "Bay vai 12.5x3 (10)",
    "Back day",
    "Warm-up : kéo xà x2 (6)",
    "Kéo dây 36x2 (10)",
    "Kéo lat 110x4 (8)",
    "Kéo trap 120x4 (8)",
    "Vai sau 100x3 (8)",
    "Leg day",
    "Calf raise 40x4",
    "Tập bụng 90x4",
    "Hack Squad …x3",
    "Leg Extension 120x3 (8)",
    "Leg Curl 90x3 (7)",
  ]);
  const weekdayTemplate = (endTitle, endItems = [], includeSleep = true) => {
    const rows = [
      ["07:00", "dậy", [...earlyRoutine]],
      ["07:30", "đi tập", [...workoutItems]],
      ["09:00", "về", [...afterGym]],
      ["10:30", "ăn", [...eatingRoutine]],
      ["11:30", "làm đồ án", []],
      ["13:00", "", []],
      ["14:00", "", []],
      ["15:00", "", []],
      ["16:30", "về đến nhà", [...eveningReturn]],
      ["18:00", "học tiếng anh qua AI", []],
      ["19:00", "làm đồ án", [...projectEvening]],
      ["20:00", "làm đồ án", []],
      ["21:00", "làm đồ án", []],
      ["22:00", endTitle, [...endItems]],
    ];
    if (includeSleep) rows.push(["23:00", "đi ngủ", []]);
    return rows;
  };
  const templates = Object.freeze({
    morning: [
      ["07:00", "dậy", [...earlyRoutine]],
      ["07:30", "đi tập", [...workoutItems]],
      ["09:00", "về", [...afterGym]],
      ["10:30", "ăn", [...eatingRoutine]],
      ["11:30", "đến trường làm đồ án", []],
      ["13:00", "", []],
      ["14:00", "", []],
      ["15:00", "", []],
      ["16:30", "về đến nhà", [...eveningReturn]],
      ["18:00", "học tiếng anh qua AI", []],
      ["19:00", "học ngoại khoá (tuỳ chọn)", ["soạn timeline cho ngày mai", "Uống finas", "xịt minoxidil", "rã đông thịt"]],
      ["22:00", "giải trí", []],
    ],
    afternoon: [
      ["07:00", "dậy", [...earlyRoutine, "chuẩn bị thức ăn định nấu"]],
      ["08:30", "xem đồ án", ["uống trà", "cắm cơm"]],
      ["09:00", "về", [...afterGym]],
      ["10:30", "ăn", [...eatingRoutine]],
      ["11:00", "làm đồ án", []],
      ["12:00", "làm đồ án", []],
      ["13:00", "làm đồ án", []],
      ["14:00", "đi tập", [...workoutItems]],
      ["15:30", "đi về", ["cắm cơm", "tắm gội", "rửa mặt", "uống finas"]],
      ["16:30", "", ["đi mua rau", "đi bộ", "nấu rau", "nấu thức ăn", "ăn"]],
      ["18:00", "học tiếng anh qua AI", []],
      ["19:00", "làm đồ án", [...projectEvening]],
      ["20:00", "làm đồ án", []],
      ["21:00", "làm đồ án", []],
      ["22:00", "giải trí", []],
      ["23:00", "đi ngủ", []],
    ],
    monday: weekdayTemplate("học writing ielts"),
    tuesday: weekdayTemplate(""),
    wednesday: weekdayTemplate("học writing ielts"),
    thursday: weekdayTemplate("học writing ielts"),
    friday: weekdayTemplate("giải trí"),
    saturday: weekdayTemplate("giải trí", ["Xem THSH", "Ngủ muộn"], false),
    sunday: [
      ["08:30", "dậy", ["luộc trứng", "đánh răng", "ăn trứng", "pha trà", "cho quần áo giặt", "ngâm nồi cơm", "chuẩn bị thức ăn định nấu"]],
      ["09:00", "", ["uống trà", "cắm cơm", "nghiên cứu phòng"]],
      ["10:00", "", ["nấu thức ăn", "ăn", "phơi quần áo"]],
      ["11:00", "làm đồ án", ["ngâm nồi cơm", "uống dht"]],
      ["12:00", "làm đồ án", []],
      ["13:00", "làm đồ án", []],
      ["14:00", "đi tập", [...workoutItems]],
      ["15:30", "đi về", ["cắm cơm", "tắm gội", "rửa mặt", "uống finas"]],
      ["16:30", "", ["đi mua rau", "đi bộ", "nấu rau", "nấu thức ăn", "ăn"]],
      ["18:00", "học tiếng anh qua AI", []],
      ["19:00", "làm đồ án", [...projectEvening]],
      ["20:00", "làm đồ án", []],
      ["21:00", "làm đồ án", []],
      ["22:00", "giải trí", []],
      ["23:00", "đi ngủ", []],
    ],
  });
`;
const templateStart = builtScript.indexOf("  const weekdayBlocks = [");
const templateEnd = builtScript.indexOf("  const todayKey =", templateStart);
if (templateStart < 0 || templateEnd < 0) {
  throw new Error("Daily Day template source range could not be located");
}
builtScript = `${builtScript.slice(0, templateStart)}${docsTemplateSource}${builtScript.slice(templateEnd)}`;
builtScript = builtScript.replace(
  '  const blocks = (id) => templates[id] || (id === "saturday" ? weekdayBlocks.map((block, index) => index === 0 ? ["08:00", block[1], block[2]] : block) : weekdayBlocks);',
  '  const blocks = (id) => templates[id] || [];',
);

// Literal schedule content from the document must stay literal even when the
// rest of Joy is using another UI locale. Translation keys still use JoyI18n.
builtScript = builtScript.replace(
  'const t = (key, values = {}) => window.JoyI18n?.t?.(key, values) || key;',
  `const t = (key, values = {}) => window.JoyI18n?.t?.(key, values) || key;
  const scheduleText = (value) => String(value).startsWith("dailyDay.") ? t(value) : value;
  const WORKOUT_VARIANTS = Object.freeze(["chest", "back", "leg"]);
  const WORKOUT_MARKERS = Object.freeze({ "Chest-day": "chest", "Back day": "back", "Leg day": "leg" });
  const WORKOUT_LABELS = Object.freeze({ chest: "Chest-day", back: "Back day", leg: "Leg day" });
  const isWorkoutBlock = (_templateId, block) => Array.isArray(block?.[2]) && block[2].some((item) => Boolean(WORKOUT_MARKERS[item]));
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

// Main Daily Day: keep the document data, but present each block more like
// the approved mockup with a small contextual icon and balanced item layout.
const oldMainRows = '    const rows = dayBlocks.map((block, bi) => { const done = block[2].reduce((sum, _, ii) => sum + Number(checked(view.date, itemId(templateId, bi, ii))), 0); return `<article class="dd-block" style="animation-delay:${Math.min(bi * 45, 280)}ms"><time class="dd-time">${esc(block[0])}</time><div class="dd-body"><div class="dd-blockhead"><strong>${esc(scheduleText(block[1]))}</strong><small>${done}/${block[2].length}</small><span class="dd-track"><i style="width:${block[2].length ? Math.round(done / block[2].length * 100) : 0}%"></i></span></div><div class="dd-items">${block[2].map((item, ii) => { const id = itemId(templateId, bi, ii); return `<label class="dd-check"><input type="checkbox" data-dd-check="${id}" ${checked(view.date, id) ? "checked" : ""}><span>${esc(scheduleText(item))}</span></label>`; }).join("")}</div></div></article>`; }).join("");';
const newMainRows = '    const rows = dayBlocks.map((block, bi) => { const visibleItems = visibleBlockItems(view.date, templateId, block); const done = visibleItems.reduce((sum, entry) => sum + Number(checked(view.date, itemId(templateId, bi, entry.index))), 0); const workout = isWorkoutBlock(templateId, block); const label = scheduleText(block[1]); const text = String(label || "").toLocaleLowerCase(); const blockIcon = text.includes("dậy") ? "☀" : text.includes("tập") ? "◈" : text.includes("đồ án") || text.includes("xem đồ án") ? "▣" : text.includes("tiếng anh") || text.includes("writing") ? "◫" : text.includes("ăn") ? "◇" : text.includes("ngủ") ? "☾" : text.includes("giải trí") ? "♪" : "•"; const many = visibleItems.length >= 5; return `<article class="dd-block ${workout ? "dd-workout-block" : ""}" style="animation-delay:${Math.min(bi * 45, 280)}ms"><time class="dd-time">${esc(block[0])}</time><div class="dd-body"><div class="dd-blockhead"><div class="dd-block-title"><span class="dd-block-icon">${esc(blockIcon)}</span><strong>${esc(label)}</strong></div><small>${done}/${visibleItems.length}</small><span class="dd-track"><i style="width:${visibleItems.length ? Math.round(done / visibleItems.length * 100) : 0}%"></i></span></div>${workout ? workoutSwitch(view.date) : ""}<div class="dd-items ${workout ? "dd-workout-items " : ""}${many ? "is-many" : ""}">${visibleItems.map(({ item, index }) => { const id = itemId(templateId, bi, index); return `<label class="dd-check"><input type="checkbox" data-dd-check="${id}" ${checked(view.date, id) ? "checked" : ""}><span>${esc(scheduleText(item))}</span></label>`; }).join("")}</div></div></article>`; }).join("");';
builtScript = builtScript.replace(oldMainRows, newMainRows);

// Use the actual streak names from Daily day and add lightweight visual marks.
builtScript = builtScript.replace(
  '    const streaks = [[t("dailyDay.streak.one"), 0, 14], [t("dailyDay.streak.two"), 0, 14], [t("dailyDay.streak.three"), 0, 100]];',
  '    const streaks = [["No snacks", 0, 14, "◒"], ["No Masturbate", 0, 14, "⊘"], ["Finasteride", 0, 100, "◆"]];',
);

builtScript = builtScript.replace(
  '<div class="dd-summary"><div class="dd-stat"><span>${esc(t("dailyDay.done"))}</span><strong>${summary.complete} ${esc(t("dailyDay.items"))}</strong></div><div class="dd-stat"><span>${esc(t("dailyDay.remaining"))}</span><strong>${summary.remaining} ${esc(t("dailyDay.items"))}</strong></div><div class="dd-stat"><span>${esc(t("dailyDay.templateUsing"))}</span><strong>${esc(t(templateKey(templateId)))}</strong></div></div>',
  '<div class="dd-summary"><div class="dd-stat"><i class="dd-stat-icon">✓</i><span>${esc(t("dailyDay.done"))}</span><strong>${summary.complete} ${esc(t("dailyDay.items"))}</strong></div><div class="dd-stat"><i class="dd-stat-icon">◷</i><span>${esc(t("dailyDay.remaining"))}</span><strong>${summary.remaining} ${esc(t("dailyDay.items"))}</strong></div><div class="dd-stat"><i class="dd-stat-icon">▤</i><span>${esc(t("dailyDay.templateUsing"))}</span><strong>${esc(t(templateKey(templateId)))}</strong></div></div>',
);

builtScript = builtScript.replace(
  '${streaks.map(([label, current, target]) => `<div class="dd-streak"><strong>${esc(label)}</strong><small>${current}/${target}</small><span class="dd-track"><i style="width:${Math.round(current / target * 100)}%"></i></span></div>`).join("")}',
  '${streaks.map(([label, current, target, mark]) => `<div class="dd-streak"><i class="dd-streak-icon">${esc(mark)}</i><strong>${esc(label)}</strong><small>${current}/${target}</small><span class="dd-track"><i style="width:${Math.round(current / target * 100)}%"></i></span></div>`).join("")}',
);

// Template preview uses the same workout selector and hides unselected groups.
const oldTimeline = '    const timeline = selectedBlocks.map((block) => `<div class="dd-timeline-row"><strong>${esc(block[0])}</strong><strong>${esc(scheduleText(block[1]))}</strong><div class="dd-template-items">${block[2].map((item) => `<span>${esc(scheduleText(item))}</span>`).join("")}</div></div>`).join("");';
const newTimeline = '    const timeline = selectedBlocks.map((block) => { const workout = isWorkoutBlock(selected, block); const visibleItems = visibleBlockItems(view.date, selected, block); return `<div class="dd-timeline-row ${workout ? "dd-workout-row" : ""}"><strong>${esc(block[0])}</strong><strong>${esc(scheduleText(block[1]))}</strong><div class="dd-template-items">${workout ? workoutSwitch(view.date, true) : ""}${visibleItems.map(({ item }) => `<span>${esc(scheduleText(item))}</span>`).join("")}</div></div>`; }).join("");';
builtScript = builtScript.replace(oldTimeline, newTimeline);

// Workout selection is per date and rerenders both surfaces immediately.
builtScript = builtScript.replace(
  'const template = event.target.closest?.("[data-dd-template]"); if (template) { view.libraryTemplate = template.dataset.ddTemplate; renderLibrary(); return; }',
  'const workout = event.target.closest?.("[data-dd-workout]"); if (workout) { setWorkoutChoice(view.date, workout.dataset.ddWorkout); renderMain(); if (!document.querySelector(`#${LIBRARY_ID}`)?.hidden) renderLibrary(); return; }\n    const template = event.target.closest?.("[data-dd-template]"); if (template) { view.libraryTemplate = template.dataset.ddTemplate; renderLibrary(); return; }',
);

// Keep the template library focused on the schedule itself.
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
if (!builtScript.includes('monday: weekdayTemplate("học writing ielts")') || !builtScript.includes('saturday: weekdayTemplate("giải trí", ["Xem THSH", "Ngủ muộn"], false)')) {
  throw new Error("Daily Day weekday document templates did not apply");
}
if (!builtScript.includes('["08:30", "xem đồ án", ["uống trà", "cắm cơm"]]') || !builtScript.includes('["19:00", "học ngoại khoá (tuỳ chọn)"')) {
  throw new Error("Daily Day morning/afternoon document templates did not apply");
}
if (!builtScript.includes('["23:00", "đi ngủ", []]') || builtScript.includes('weekdayBlocks')) {
  throw new Error("Daily Day document template replacement is incomplete");
}
if (!builtScript.includes("const scheduleText =") || !builtScript.includes("const workoutSwitch =")) {
  throw new Error("Daily Day literal text or workout selector transform did not apply");
}
if (!builtScript.includes("workouts: data.workouts || {}") || !builtScript.includes("visibleBlockItems(view.date")) {
  throw new Error("Daily Day per-day workout persistence/render transform did not apply");
}
if (!builtScript.includes("dd-block-title") || !builtScript.includes("dd-stat-icon") || !builtScript.includes("No snacks")) {
  throw new Error("Daily Day main popup visual/content transform did not apply");
}
if (builtScript.includes('<div class="dd-info">• ${esc(t("dailyDay.noteFuture"))}')) {
  throw new Error("Daily Day template info banner removal did not apply");
}
if (builtScript.includes('<div class="dd-note"><strong>${esc(t("dailyDay.templateNote"))}')) {
  throw new Error("Daily Day template note removal did not apply");
}

await writeFile(scriptTarget, builtScript);
await cp(styleSource, styleTarget);

// Preserve the established auto-growing schedule rows and workout selector.
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
  line-height: 1.45;
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
  line-height: 1.2;
  font-weight: 700;
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
  font-weight: 700;
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

/* Main Daily Day popup: closer to the approved mockup while keeping current logic. */
#daily-day-modal.dd-backdrop {
  padding: 20px;
  background: rgba(28, 34, 35, 0.58);
  backdrop-filter: blur(13px);
}

#daily-day-modal .dd-shell {
  width: min(1080px, calc(100vw - 44px));
  max-height: min(760px, calc(100vh - 40px));
  border: 1px solid rgba(110, 132, 132, 0.18);
  border-radius: 24px;
  background: #f7f4ef;
  box-shadow: 0 28px 82px rgba(18, 27, 30, 0.34);
  font-family: "Nunito", ui-rounded, system-ui, sans-serif;
}

#daily-day-modal .dd-scroll {
  box-sizing: border-box;
  max-height: min(760px, calc(100vh - 40px));
  padding: 22px 24px 18px;
  scrollbar-width: thin;
}

#daily-day-modal .dd-head {
  align-items: flex-start;
}

#daily-day-modal .dd-title {
  color: #273947;
  font-size: clamp(34px, 3.2vw, 40px);
  line-height: 1;
  letter-spacing: -0.04em;
  font-weight: 800;
}

#daily-day-modal .dd-sub {
  margin-top: 8px;
  color: #70818a;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 700;
}

#daily-day-modal .dd-head-side {
  align-items: flex-start;
}

#daily-day-modal .dd-progress {
  min-width: 166px;
  padding: 11px 13px;
  border-color: #d9dfdc;
  border-radius: 14px;
  background: #fdfcf9;
}

#daily-day-modal .dd-progress strong {
  margin-bottom: 7px;
  color: #344b57;
  font-size: 11px;
  font-weight: 800;
}

#daily-day-modal .dd-icon {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background: #ebf1ef;
  color: #4e6b74;
}

#daily-day-modal .dd-toolbar {
  margin-top: 16px;
  gap: 10px;
}

#daily-day-modal .dd-week {
  gap: 8px;
}

#daily-day-modal .dd-week button,
#daily-day-modal .dd-button,
#daily-day-modal .dd-select {
  min-height: 38px;
  border-color: #d8dfdc;
  border-radius: 11px;
  background: #fbfcfa;
  color: #566b74;
  font-size: 10.5px;
  font-weight: 800;
}

#daily-day-modal .dd-week button.active,
#daily-day-modal .dd-button.primary {
  border-color: #648d8d;
  background: #648d8d;
  color: #ffffff;
}

#daily-day-modal .dd-templatebar {
  margin-top: 11px;
  padding: 9px 11px;
  grid-template-columns: auto minmax(190px, 1fr) auto auto;
  gap: 9px;
  border-color: #dce2de;
  border-radius: 13px;
  background: #fcfbf8;
}

#daily-day-modal .dd-templatebar label {
  color: #314954;
  font-size: 10.5px;
  font-weight: 800;
}

#daily-day-modal .dd-content {
  margin-top: 14px;
  grid-template-columns: minmax(0, 1.62fr) 352px;
  gap: 14px;
  align-items: start;
}

#daily-day-modal .dd-card {
  border-color: #dce2de;
  border-radius: 16px;
  background: #fdfcf9;
}

#daily-day-modal .dd-pad {
  padding: 15px;
}

#daily-day-modal .dd-section {
  margin-bottom: 13px;
  color: #2c4654;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 800;
}

#daily-day-modal .dd-list {
  gap: 10px;
}

#daily-day-modal .dd-list::before {
  left: 7px;
  top: 19px;
  bottom: 19px;
  background: #c7d8d5;
}

#daily-day-modal .dd-block {
  grid-template-columns: 62px minmax(0, 1fr);
  gap: 10px;
  padding-left: 18px;
  align-items: start;
}

#daily-day-modal .dd-block::before {
  left: 3px;
  top: 16px;
  width: 9px;
  height: 9px;
  background: #6e9999;
  box-shadow: 0 0 0 4px #f7f4ef;
}

#daily-day-modal .dd-time {
  align-self: start;
  width: auto;
  height: auto;
  min-height: 0;
  margin-top: 0;
  padding: 6px 7px;
  border-radius: 10px;
  background: #e7efee;
  color: #355a68;
  font-size: 10px;
  line-height: 1.2;
  font-weight: 800;
}

#daily-day-modal .dd-body {
  padding: 10px 12px;
  border-color: #dfe4df;
  border-radius: 13px;
  background: #fffefa;
}

#daily-day-modal .dd-blockhead {
  grid-template-columns: minmax(0, 1fr) auto 54px;
  gap: 9px;
  align-items: center;
}

#daily-day-modal .dd-block-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
}

#daily-day-modal .dd-block-icon {
  width: 29px;
  height: 29px;
  flex: 0 0 29px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #edf3f1;
  color: #527a82;
  font-size: 13px;
  line-height: 1;
  font-weight: 700;
}

#daily-day-modal .dd-block-title strong {
  min-width: 0;
  color: #294857;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
}

#daily-day-modal .dd-block-title strong:empty {
  display: none;
}

#daily-day-modal .dd-blockhead small {
  color: #708087;
  font-size: 9.5px;
  font-weight: 700;
}

#daily-day-modal .dd-blockhead .dd-track {
  height: 7px;
}

#daily-day-modal .dd-items {
  margin-top: 9px;
  display: flex !important;
  flex-wrap: wrap;
  column-count: auto !important;
  column-rule: 0 !important;
  gap: 8px 16px;
}

#daily-day-modal .dd-items.is-many,
#daily-day-modal .dd-workout-items {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-count: auto !important;
  column-rule: 0 !important;
  gap: 8px 16px;
}

#daily-day-modal .dd-items > .dd-check,
#daily-day-modal .dd-items:has(> .dd-check:nth-of-type(5)) > .dd-check {
  width: auto;
  margin: 0;
  break-inside: auto;
}

#daily-day-modal .dd-check {
  min-width: 0;
  gap: 6px;
  color: #62757d;
  font-size: 10.5px;
  line-height: 1.35;
  font-weight: 700;
}

#daily-day-modal .dd-check input {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
}

#daily-day-modal .dd-workout-wrap {
  margin: 9px 0 8px;
  padding: 9px 10px;
  border-radius: 11px;
  background: #eef5f4;
}

#daily-day-modal .dd-workout-subheading {
  margin-bottom: 7px;
  color: #2e5260;
  font-size: 11.5px;
}

#daily-day-modal .dd-workout-tabs {
  gap: 7px;
}

#daily-day-modal .dd-workout-tabs button {
  min-height: 28px;
  padding: 0 10px;
  font-size: 10.5px;
}

#daily-day-modal .dd-side {
  gap: 11px;
}

#daily-day-modal .dd-summary {
  gap: 7px;
}

#daily-day-modal .dd-stat {
  min-height: 94px;
  padding: 10px;
  border: 1px solid #e1e6e2;
  border-radius: 13px;
  background: #f0f4f1;
  align-content: start;
  gap: 5px;
}

#daily-day-modal .dd-stat-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  margin-bottom: 2px;
  border-radius: 999px;
  background: #e2ece9;
  color: #557f7f;
  font-size: 13px;
  font-style: normal;
  font-weight: 800;
}

#daily-day-modal .dd-stat span {
  color: #708087;
  font-size: 9px;
  font-weight: 700;
}

#daily-day-modal .dd-stat strong {
  margin-top: auto;
  color: #314854;
  font-size: 11.5px;
  line-height: 1.25;
  font-weight: 800;
}

#daily-day-modal .dd-streak {
  grid-template-columns: 22px minmax(0, 1fr) auto 70px;
  gap: 7px;
  margin-top: 9px;
}

#daily-day-modal .dd-streak-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  color: #668f8f;
  font-size: 13px;
  font-style: normal;
  font-weight: 800;
}

#daily-day-modal .dd-streak strong,
#daily-day-modal .dd-streak small {
  font-size: 9.5px;
}

#daily-day-modal .dd-streak strong {
  color: #334d59;
  font-weight: 700;
}

#daily-day-modal .dd-streak small {
  color: #718087;
  font-weight: 700;
}

#daily-day-modal .dd-note-card .dd-section::before {
  content: "▤";
  margin-right: 7px;
  color: #5d8588;
}

#daily-day-modal .dd-notes {
  color: #687980;
  font-size: 9.5px;
  line-height: 1.55;
  font-weight: 600;
}

#daily-day-modal .dd-footer {
  position: sticky;
  bottom: -18px;
  z-index: 4;
  margin: 13px -24px -18px;
  padding: 11px 24px 12px;
  border-top: 1px solid #dde3df;
  background: rgba(247, 244, 239, 0.96);
  backdrop-filter: blur(8px);
}

#daily-day-modal .dd-footer .dd-button {
  min-width: 104px;
}

#daily-day-modal .dd-footer .dd-button.primary {
  min-width: 134px;
}

@media (max-width: 980px) {
  #daily-day-modal .dd-content {
    grid-template-columns: minmax(0, 1fr) 310px;
  }
}

@media (max-width: 820px) {
  #daily-day-modal .dd-content {
    grid-template-columns: 1fr;
  }

  #daily-day-modal .dd-side {
    grid-template-columns: 1fr 1fr;
  }

  #daily-day-modal .dd-note-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  #daily-day-modal.dd-backdrop {
    padding: 0;
    align-items: stretch;
  }

  #daily-day-modal .dd-shell {
    width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  #daily-day-modal .dd-scroll {
    max-height: 100vh;
    padding: 16px;
  }

  #daily-day-modal .dd-toolbar,
  #daily-day-modal .dd-templatebar,
  #daily-day-modal .dd-side {
    grid-template-columns: 1fr;
  }

  #daily-day-modal .dd-templatebar {
    display: grid;
  }

  #daily-day-modal .dd-block {
    grid-template-columns: 56px minmax(0, 1fr);
  }

  #daily-day-modal .dd-items.is-many,
  #daily-day-modal .dd-workout-items {
    grid-template-columns: 1fr;
  }

  #daily-day-modal .dd-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  #daily-day-modal .dd-footer {
    bottom: -16px;
    margin: 12px -16px -16px;
    padding: 11px 16px;
  }
}
`);

await appendFile(scriptTarget, `
;(() => {
  if (typeof document === "undefined" || document.querySelector('link[data-joy-daily-day-design="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/daily-day-design.css?v=joy-daily-day-design-v10";
  link.dataset.joyDailyDayDesign = "true";
  document.head.append(link);
})();
`);

console.log("Joy Daily Day frontend, main popup visual refinement, and all nine exact document templates copied to dist");
