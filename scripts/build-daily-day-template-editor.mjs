import { execFileSync } from "node:child_process";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const styleTarget = resolve(root, "dist", "daily-day-design.css");
const appTarget = resolve(root, "dist", "app.js");

let script = await readFile(scriptTarget, "utf8");

const blocksAnchor = '  const blocks = (id) => templates[id] || templates.no_workout || [];';
const blocksReplacement = `  const cloneTemplateBlocks = (value) => Array.isArray(value)
    ? value.map((block) => [String(block?.[0] ?? ""), String(block?.[1] ?? ""), Array.isArray(block?.[2]) ? block[2].map((item) => String(item)) : []])
    : [];
  const baseBlocks = (id) => templates[id] || templates.no_workout || [];
  const effectiveTemplateBlocks = (id, dateKey = view.date) => {
    const versions = Array.isArray(load().templateVersions?.[id]) ? load().templateVersions[id] : [];
    let selectedVersion = null;
    versions.forEach((version) => {
      const effectiveFrom = String(version?.effectiveFrom || "");
      if (effectiveFrom && effectiveFrom <= dateKey && (!selectedVersion || effectiveFrom >= selectedVersion.effectiveFrom)) {
        selectedVersion = version;
      }
    });
    return cloneTemplateBlocks(selectedVersion?.blocks || baseBlocks(id));
  };
  const blocks = (id) => effectiveTemplateBlocks(id, view.date);`;
if (!script.includes(blocksAnchor)) throw new Error("Daily Day template editor: blocks anchor missing");
script = script.replace(blocksAnchor, blocksReplacement);

const statsBlocksAnchor = "    blocks(templateId).forEach((block, blockIndex) => visibleBlockItems(dateKey, templateId, block).forEach(({ index }) => { total += 1; if (checked(dateKey, itemId(templateId, blockIndex, index))) complete += 1; }));";
const statsBlocksReplacement = "    effectiveTemplateBlocks(templateId, dateKey).forEach((block, blockIndex) => visibleBlockItems(dateKey, templateId, block).forEach(({ index }) => { total += 1; if (checked(dateKey, itemId(templateId, blockIndex, index))) complete += 1; }));";
if (!script.includes(statsBlocksAnchor)) throw new Error("Daily Day template editor: date-aware stats anchor missing");
script = script.replace(statsBlocksAnchor, statsBlocksReplacement);

const loadAnchor = 'return data && typeof data === "object" ? { overrides: data.overrides || {}, checks: data.checks || {}, workouts: data.workouts || {} } : { overrides: {}, checks: {}, workouts: {} };';
const loadReplacement = 'return data && typeof data === "object" ? { overrides: data.overrides || {}, checks: data.checks || {}, workouts: data.workouts || {}, templateVersions: data.templateVersions || {} } : { overrides: {}, checks: {}, workouts: {}, templateVersions: {} };';
if (!script.includes(loadAnchor)) throw new Error("Daily Day template editor: load anchor missing");
script = script.replace(loadAnchor, loadReplacement);
script = script.replace(
  'catch { return { overrides: {}, checks: {}, workouts: {} }; }',
  'catch { return { overrides: {}, checks: {}, workouts: {}, templateVersions: {} }; }',
);

const timelineStart = script.indexOf('    const timeline = selectedBlocks.map((block) => {');
const timelineEnd = script.indexOf('\n    root.innerHTML =', timelineStart);
if (timelineStart < 0 || timelineEnd < 0) throw new Error("Daily Day template editor: library timeline anchor missing");
const newTimeline = `    const timeline = selectedBlocks.map((block, blockIndex) => { const workout = isWorkoutBlock(selected, block); const visibleItems = visibleBlockItems(view.date, selected, block); return \`<div class="dd-timeline-row \${workout ? "dd-workout-row" : ""}" data-dd-template-block="\${blockIndex}"><strong>\${esc(block[0])}</strong><strong>\${esc(scheduleText(block[1]))}</strong><div class="dd-template-items" data-dd-template-cell data-dd-template-id="\${esc(selected)}" data-dd-template-date="\${esc(view.date)}" data-dd-template-block-index="\${blockIndex}" data-dd-template-workout="\${workout ? esc(workoutChoice(view.date)) : ""}">\${workout ? workoutSwitch(view.date, true) : ""}\${visibleItems.map(({ item, index }) => \`<span data-dd-template-item="\${index}">\${esc(scheduleText(item))}</span>\`).join("")}</div></div>\`; }).join("");`;
script = `${script.slice(0, timelineStart)}${newTimeline}${script.slice(timelineEnd)}`;

const helperAnchor = '  function openMain() {';
const helperSource = `  const templateEditEffectiveDate = (requestedDate) => requestedDate < todayKey() ? todayKey() : requestedDate;
  const syncTemplateVersion = (templateId, effectiveFrom, nextBlocks) => {
    const mutation = { type: "template-version", date: effectiveFrom, templateId, blocks: nextBlocks };
    const sharedSync = window.JoyDailyDaySync;
    if (!sharedSync?.patch) {
      console.warn("Daily Day template sync unavailable");
      return Promise.resolve();
    }
    return sharedSync.patch(mutation);
  };
  const persistTemplateVersion = (templateId, requestedDate, nextBlocks) => {
    const effectiveFrom = templateEditEffectiveDate(requestedDate);
    const data = load();
    data.templateVersions ||= {};
    const existing = Array.isArray(data.templateVersions[templateId]) ? data.templateVersions[templateId] : [];
    data.templateVersions[templateId] = [
      ...existing.filter((entry) => String(entry?.effectiveFrom || "") !== effectiveFrom),
      { effectiveFrom, blocks: cloneTemplateBlocks(nextBlocks) },
    ].sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)));
    save(data);
    syncTemplateVersion(templateId, effectiveFrom, nextBlocks);
    return effectiveFrom;
  };
  const clearWorkoutOverridesForTemplateEdit = ({ dateKey, templateId, blockIndex, itemIndex, structural }) => {
    if (dateKey !== todayKey()) return;
    const storageKey = "joy-daily-day-workout-values-v1";
    let values = {};
    try {
      values = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (!values || typeof values !== "object" || Array.isArray(values)) values = {};
    } catch {
      values = {};
    }
    const dayValues = values[dateKey];
    if (!dayValues || typeof dayValues !== "object" || Array.isArray(dayValues)) return;
    const prefix = String(templateId) + ":" + blockIndex + ":";
    const keys = structural
      ? Object.keys(dayValues).filter((key) => key.startsWith(prefix))
      : [itemId(templateId, blockIndex, itemIndex)].filter((key) => Object.hasOwn(dayValues, key));
    if (!keys.length) return;
    const sharedSync = window.JoyDailyDaySync;
    keys.forEach((key) => {
      delete dayValues[key];
      sharedSync?.patch?.({ type: "workout-value", date: dateKey, itemId: key, value: null });
    });
    if (!Object.keys(dayValues).length) delete values[dateKey];
    localStorage.setItem(storageKey, JSON.stringify(values));
  };
  const mutateTemplateItem = ({ templateId, requestedDate, blockIndex, itemIndex, value, workoutVariant, add }) => {
    const effectiveFrom = templateEditEffectiveDate(requestedDate);
    const nextBlocks = effectiveTemplateBlocks(templateId, effectiveFrom);
    const block = nextBlocks[blockIndex];
    if (!block || !Array.isArray(block[2])) return;
    const items = block[2];
    const text = String(value || "").trim();
    const workoutEdit = Boolean(workoutVariant && WORKOUT_LABELS[workoutVariant]);
    const structuralWorkoutEdit = Boolean(workoutEdit && (add || !text));
    if (add) {
      if (!text) return;
      let insertAt = items.length;
      if (workoutVariant && WORKOUT_LABELS[workoutVariant]) {
        const markerIndex = items.indexOf(WORKOUT_LABELS[workoutVariant]);
        if (markerIndex >= 0) {
          insertAt = items.length;
          for (let index = markerIndex + 1; index < items.length; index += 1) {
            if (WORKOUT_MARKERS[items[index]]) { insertAt = index; break; }
          }
        }
      }
      items.splice(insertAt, 0, text);
    } else if (Number.isInteger(itemIndex) && itemIndex >= 0 && itemIndex < items.length) {
      if (text) items[itemIndex] = text;
      else items.splice(itemIndex, 1);
    }
    persistTemplateVersion(templateId, effectiveFrom, nextBlocks);
    if (workoutEdit) {
      clearWorkoutOverridesForTemplateEdit({
        dateKey: effectiveFrom,
        templateId,
        blockIndex,
        itemIndex,
        structural: structuralWorkoutEdit,
      });
    }
    if (view.date < effectiveFrom) view.date = effectiveFrom;
    renderMain();
    renderLibrary();
  };
  const beginTemplateInlineEdit = (cell, itemNode = null) => {
    if (!cell || cell.querySelector(".dd-template-inline")) return;
    const templateId = String(cell.dataset.ddTemplateId || "");
    const requestedDate = String(cell.dataset.ddTemplateDate || view.date);
    const blockIndex = Number(cell.dataset.ddTemplateBlockIndex);
    const itemIndex = itemNode ? Number(itemNode.dataset.ddTemplateItem) : null;
    if (!TEMPLATE_IDS.includes(templateId) || !Number.isInteger(blockIndex)) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "dd-template-inline";
    input.value = itemNode?.textContent?.trim() || "";
    input.autocomplete = "off";
    if (itemNode) itemNode.hidden = true;
    cell.append(input);
    input.focus();
    input.select();
    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      const value = input.value;
      if (!commit || (!value.trim() && !itemNode)) {
        renderLibrary();
        return;
      }
      mutateTemplateItem({
        templateId,
        requestedDate,
        blockIndex,
        itemIndex,
        value,
        workoutVariant: String(cell.dataset.ddTemplateWorkout || ""),
        add: !itemNode,
      });
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); finish(true); }
      if (event.key === "Escape") { event.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", () => finish(true), { once: true });
  };

`;
if (!script.includes(helperAnchor)) throw new Error("Daily Day template editor: helper anchor missing");
script = script.replace(helperAnchor, `${helperSource}${helperAnchor}`);

const changeAnchor = '  document.addEventListener("change", (event) => {';
const dblClickHandler = `  document.addEventListener("dblclick", (event) => {
    const cell = event.target.closest?.("#daily-day-templates-modal [data-dd-template-cell]");
    if (!cell || event.target.closest?.("button,input")) return;
    const item = event.target.closest?.("[data-dd-template-item]");
    event.preventDefault();
    event.stopPropagation();
    beginTemplateInlineEdit(cell, item || null);
  }, true);
`;
if (!script.includes(changeAnchor)) throw new Error("Daily Day template editor: change listener anchor missing");
script = script.replace(changeAnchor, `${dblClickHandler}${changeAnchor}`);

script = script.replace(
  'if (document.querySelector("#daily-day-modal .dd-exercise-line.editing")) return;',
  'if (document.querySelector("#daily-day-modal .dd-exercise-line.editing, #daily-day-templates-modal .dd-template-inline")) return;',
);

// Cloud sync no longer simulates an active-date click. Refresh only the
// template library when effective template versions actually changed remotely.
script += `
;(() => {
  window.addEventListener("joy:daily-day-cloud-applied", (event) => {
    if (!event.detail?.templateVersionsChanged) return;
    const library = document.querySelector("#daily-day-templates-modal");
    if (library && !library.hidden && !library.querySelector(".dd-template-inline")) {
      library.querySelector(".dd-template-row.active[data-dd-template]")?.click();
    }
  });
})();
`;

for (const required of [
  "templateVersions",
  "effectiveTemplateBlocks",
  "effectiveTemplateBlocks(templateId, dateKey)",
  "data-dd-template-cell",
  "beginTemplateInlineEdit",
  'type: "template-version"',
  "window.JoyDailyDaySync",
]) {
  if (!script.includes(required)) throw new Error(`Daily Day template editor transform missing: ${required}`);
}

await writeFile(scriptTarget, script);
execFileSync(process.execPath, ["--check", scriptTarget], { stdio: "inherit" });

await appendFile(styleTarget, `
/* Effective-dated template editing */
#daily-day-templates-modal .dd-template-items[data-dd-template-cell]{min-height:34px;border-radius:10px;cursor:text;transition:background .14s ease,box-shadow .14s ease}
#daily-day-templates-modal .dd-template-items[data-dd-template-cell]:hover{background:rgba(94,132,130,.055);box-shadow:inset 0 0 0 1px rgba(94,132,130,.10)}
#daily-day-templates-modal [data-dd-template-item]{cursor:text}
#daily-day-templates-modal .dd-template-inline{min-width:150px;max-width:100%;height:31px;padding:5px 9px;border:1px solid #8eaaa7;border-radius:8px;background:#fffdf9;color:#34484e;font:inherit;font-size:14px;font-weight:700;outline:none;box-shadow:0 0 0 3px rgba(94,132,130,.10)}
#daily-day-templates-modal .dd-template-inline:focus{border-color:#628c89}
`);

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v30").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v36").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day template editor: v30 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day template cells use shared sync from their effective date forward; cache bumped to v36");
