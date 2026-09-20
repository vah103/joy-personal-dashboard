import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");

const streakScript = String.raw`
;(() => {
  const STORAGE_KEY = "joy-daily-day-streak-v1";
  const STREAKS = Object.freeze([
    { id: "no-snacks", label: "No snacks", base: 0, target: 14 },
    { id: "no-masturbate", label: "No Masturbate", base: 0, target: 14 },
    { id: "finasteride", label: "Finasteride", base: 2, target: 100 },
  ]);

  const read = () => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return data && typeof data === "object" ? { days: data.days || {} } : { days: {} };
    } catch {
      return { days: {} };
    }
  };

  const write = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const selectedDate = () =>
    document.querySelector("#daily-day-modal .dd-week button.active[data-dd-date]")?.dataset.ddDate || "";

  const completedFor = (data, streakId, throughDate) =>
    Object.entries(data.days || {}).reduce(
      (total, [dateKey, day]) => total + Number(dateKey <= throughDate && Boolean(day && day[streakId])),
      0,
    );

  const isChecked = (data, dateKey, streakId) => Boolean(data.days?.[dateKey]?.[streakId]);

  const toggle = (dateKey, streakId) => {
    if (!dateKey || !STREAKS.some((item) => item.id === streakId)) return;
    const data = read();
    data.days[dateKey] ||= {};
    data.days[dateKey][streakId] = !Boolean(data.days[dateKey][streakId]);
    if (!Object.values(data.days[dateKey]).some(Boolean)) delete data.days[dateKey];
    write(data);
  };

  const ensureStyles = () => {
    if (document.querySelector("#joy-daily-day-streak-styles-v1")) return;
    const style = document.createElement("style");
    style.id = "joy-daily-day-streak-styles-v1";
    style.textContent = [
      "#daily-day-modal .dd-streak{grid-template-columns:22px minmax(0,1fr) auto 76px;gap:9px;align-items:center}",
      "#daily-day-modal .dd-streak-check{width:20px;height:20px;padding:0;display:grid;place-items:center;border:1.5px solid #83a4a3;border-radius:50%;background:#fffefa;color:transparent;font:800 12px/1 Nunito,system-ui,sans-serif;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease}",
      "#daily-day-modal .dd-streak-check:hover{transform:translateY(-1px);border-color:#5f8d8c}",
      "#daily-day-modal .dd-streak-check.checked{border-color:#648f8e;background:#648f8e;color:#fff}",
      "#daily-day-modal .dd-streak-check:focus-visible{outline:3px solid rgba(100,143,142,.22);outline-offset:2px}",
      "#daily-day-modal .dd-streak strong{min-width:0}",
      "#daily-day-modal .dd-streak small{min-width:46px;text-align:right;font-variant-numeric:tabular-nums}",
    ].join("");
    document.head.append(style);
  };

  const enhance = () => {
    ensureStyles();
    const dateKey = selectedDate();
    if (!dateKey) return;
    const rows = [...document.querySelectorAll("#daily-day-modal .dd-streak")];
    if (rows.length < STREAKS.length) return;
    const data = read();

    STREAKS.forEach((streak, index) => {
      const row = rows[index];
      if (!row) return;
      const checked = isChecked(data, dateKey, streak.id);
      const current = streak.base + completedFor(data, streak.id, dateKey);
      const percent = streak.target ? Math.min(100, Math.round(current / streak.target * 100)) : 0;
      const signature = [dateKey, streak.id, checked ? 1 : 0, current, streak.target].join("|");
      if (row.dataset.ddStreakSignature === signature) return;
      row.dataset.ddStreakSignature = signature;
      row.innerHTML = '<button type="button" class="dd-streak-check ' + (checked ? "checked" : "") + '" data-dd-streak-check="' + streak.id + '" aria-pressed="' + checked + '" aria-label="' + (checked ? "Bỏ tích" : "Tích") + ' ' + streak.label + ' cho ' + dateKey + '">' + (checked ? "✓" : "") + '</button><strong>' + streak.label + '</strong><small>' + current + '/' + streak.target + '</small><span class="dd-track"><i style="width:' + percent + '%"></i></span>';
    });
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-dd-streak-check]");
    if (button) {
      const dateKey = selectedDate();
      toggle(dateKey, button.dataset.ddStreakCheck);
      enhance();
      return;
    }
    if (event.target.closest?.("#todo-title,[data-dd-date],[data-dd-today]")) {
      setTimeout(enhance, 0);
    }
  });

  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  requestAnimationFrame(enhance);
})();
`;

await appendFile(scriptTarget, streakScript);
console.log("Daily Day per-date streak check-ins appended with historical counts");
