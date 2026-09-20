import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const styleTarget = resolve(root, "dist", "daily-day-design.css");

const editorScript = String.raw`
;(() => {
  const STORAGE_KEY = "joy-daily-day-workout-values-v1";
  const read = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
  const write = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const dateKey = () => document.querySelector("#daily-day-modal .dd-week button.active")?.dataset.ddDate || "";
  const parseExercise = (text) => {
    const original = String(text || "").trim();
    let core = original; let reps = ""; let weight = ""; let sets = "";
    const repsMatch = core.match(/\s*\(([^)]+)\)\s*$/);
    if (repsMatch) { reps = repsMatch[1].trim(); core = core.slice(0, repsMatch.index).trim(); }
    const setsMatch = core.match(/^(.*?)(?:\s+([0-9]+(?:\.[0-9]+)?|…))?\s*x(\d+)\s*$/i);
    if (setsMatch) { core = setsMatch[1].trim(); weight = (setsMatch[2] || "").trim(); sets = setsMatch[3]; }
    else {
      const weightOnly = core.match(/^(.*\D)\s+([0-9]+(?:\.[0-9]+)?)\s*$/);
      if (weightOnly) { core = weightOnly[1].trim(); weight = weightOnly[2]; }
    }
    return { original, name: core, weight, sets, reps };
  };
  const formatExercise = (meta, values) => {
    const weight = Object.hasOwn(values, "weight") ? String(values.weight).trim() : meta.weight;
    const reps = Object.hasOwn(values, "reps") ? String(values.reps).trim() : meta.reps;
    let output = meta.name;
    if (meta.sets) output += weight ? " " + weight + "x" + meta.sets : " x" + meta.sets;
    else if (weight) output += " " + weight;
    if (reps) output += " (" + reps + ")";
    return output;
  };
  const saveValues = (itemId, values) => {
    const day = dateKey(); if (!day) return;
    const data = read(); data[day] ||= {}; data[day][itemId] = values; write(data);
  };
  const clearValues = (itemId) => {
    const day = dateKey(); const data = read(); if (!data[day]) return;
    delete data[day][itemId]; if (!Object.keys(data[day]).length) delete data[day]; write(data);
  };
  const toast = (message) => window.showToast?.(message);
  const enhance = () => {
    const day = dateKey(); const savedForDay = read()[day] || {};
    document.querySelectorAll("#daily-day-modal .dd-workout-items > .dd-check:not([data-dd-exercise-enhanced])").forEach((label) => {
      const checkbox = label.querySelector("input[data-dd-check]"); const text = label.querySelector("span");
      if (!checkbox || !text) return;
      const itemId = checkbox.dataset.ddCheck; const meta = parseExercise(text.textContent); const saved = savedForDay[itemId] || {};
      text.textContent = formatExercise(meta, saved); label.dataset.ddExerciseEnhanced = "true";
      const line = document.createElement("div"); line.className = "dd-exercise-line"; label.before(line); line.append(label);
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "dd-exercise-edit"; edit.textContent = "✎"; edit.title = "Sửa mức tạ / rep"; line.append(edit);
      const editor = document.createElement("div"); editor.className = "dd-exercise-editor"; editor.hidden = true;
      const weightValue = Object.hasOwn(saved, "weight") ? saved.weight : meta.weight;
      const repsValue = Object.hasOwn(saved, "reps") ? saved.reps : meta.reps;
      editor.innerHTML = '<label class="dd-exercise-field">Tạ<input data-dd-exercise-weight inputmode="decimal"></label><label class="dd-exercise-field">Rep<input data-dd-exercise-reps inputmode="numeric"></label><button type="button" class="dd-exercise-save">Lưu</button><button type="button" class="dd-exercise-reset">Mặc định</button>';
      editor.querySelector("[data-dd-exercise-weight]").value = weightValue;
      editor.querySelector("[data-dd-exercise-reps]").value = repsValue;
      line.append(editor);
      edit.addEventListener("click", () => {
        editor.hidden = !editor.hidden; line.classList.toggle("editing", !editor.hidden);
        if (!editor.hidden) editor.querySelector("input")?.focus();
      });
      editor.querySelector(".dd-exercise-save").addEventListener("click", () => {
        const values = { weight: editor.querySelector("[data-dd-exercise-weight]").value.trim(), reps: editor.querySelector("[data-dd-exercise-reps]").value.trim() };
        saveValues(itemId, values); text.textContent = formatExercise(meta, values); editor.hidden = true; line.classList.remove("editing"); toast("Đã lưu mức tạ và rep cho ngày này");
      });
      editor.querySelector(".dd-exercise-reset").addEventListener("click", () => {
        clearValues(itemId); text.textContent = meta.original; editor.querySelector("[data-dd-exercise-weight]").value = meta.weight; editor.querySelector("[data-dd-exercise-reps]").value = meta.reps; editor.hidden = true; line.classList.remove("editing"); toast("Đã khôi phục mức tạ và rep mặc định");
      });
    });
  };
  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.("#todo-title,[data-dd-date],[data-dd-workout],[data-dd-today]")) setTimeout(enhance, 0);
  });
})();
`;

const editorStyles = String.raw`
#daily-day-modal .dd-exercise-line{position:relative;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 26px;gap:6px;align-items:center;padding:5px 7px;border:1px solid #e2e7e3;border-radius:10px;background:#fff}
#daily-day-modal .dd-exercise-line.editing{grid-column:1/-1}
#daily-day-modal .dd-exercise-line .dd-check{min-width:0}
#daily-day-modal .dd-exercise-line .dd-check span{white-space:normal}
#daily-day-modal .dd-exercise-edit{width:26px;height:26px;padding:0;border:0;border-radius:8px;background:#edf3f1;color:#56787f;font:700 12px Nunito,system-ui;cursor:pointer}
#daily-day-modal .dd-exercise-editor{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr auto auto;gap:7px;align-items:end;padding-top:7px;border-top:1px solid #e1e7e4}
#daily-day-modal .dd-exercise-editor[hidden]{display:none}
#daily-day-modal .dd-exercise-field{display:grid;gap:3px;color:#688087;font:700 9px Nunito,system-ui}
#daily-day-modal .dd-exercise-field input{min-width:0;height:29px;padding:0 8px;border:1px solid #d5dfdc;border-radius:8px;background:#fff;color:#314e59;font:700 11px Nunito,system-ui;outline:none}
#daily-day-modal .dd-exercise-field input:focus{border-color:#6e9999;box-shadow:0 0 0 2px rgba(110,153,153,.14)}
#daily-day-modal .dd-exercise-save,#daily-day-modal .dd-exercise-reset{height:29px;padding:0 9px;border:1px solid #d5dfdc;border-radius:8px;font:800 10px Nunito,system-ui;cursor:pointer}
#daily-day-modal .dd-exercise-save{border-color:#648d8d;background:#648d8d;color:#fff}
#daily-day-modal .dd-exercise-reset{background:#f6f8f6;color:#64777e}
@media(max-width:760px){#daily-day-modal .dd-exercise-editor{grid-template-columns:1fr 1fr}#daily-day-modal .dd-exercise-save,#daily-day-modal .dd-exercise-reset{width:100%}}
`;

await appendFile(scriptTarget, editorScript);
await appendFile(styleTarget, editorStyles);
console.log("Daily Day per-date workout weight/reps editor appended");
