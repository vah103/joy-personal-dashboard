import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");

const streakScript = String.raw`
;(() => {
  const STORAGE_KEY = "joy-daily-day-streak-v1";
  const MIGRATION_DATE = "2026-09-25";
  const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const LEGACY = Object.freeze([
    { id: "no-snacks", name: "No snacks", targetDays: 14, baseCarry: 0 },
    { id: "no-masturbate", name: "No Masturbate", targetDays: 14, baseCarry: 0 },
    { id: "finasteride", name: "Finasteride", targetDays: 100, baseCarry: 2 },
  ]);

  const t = (key, values = {}) => window.JoyI18n?.t?.(key, values) || key;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const todayKey = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return parts.year + "-" + parts.month + "-" + parts.day;
  };
  const addDays = (dateKey, amount) => {
    const value = new Date(dateKey + "T12:00:00Z");
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0, 10);
  };
  const formatDate = (dateKey) => window.JoyI18n?.formatDate?.(
    new Date(dateKey + "T12:00:00Z"),
    { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" },
  ) || dateKey;
  const selectedDate = () =>
    document.querySelector("#daily-day-modal .dd-week button.active[data-dd-date]")?.dataset.ddDate || todayKey();

  const legacyToV2 = (input) => {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    if (Number(source.schemaVersion) === 2) {
      return {
        ...source,
        schemaVersion: 2,
        runs: source.runs && typeof source.runs === "object" && !Array.isArray(source.runs) ? source.runs : {},
        suggestions: source.suggestions && typeof source.suggestions === "object" && !Array.isArray(source.suggestions) ? source.suggestions : {},
      };
    }
    const days = source.days && typeof source.days === "object" && !Array.isArray(source.days) ? source.days : {};
    const runs = {};
    LEGACY.forEach((legacy) => {
      const checkedDates = Object.entries(days)
        .filter(([dateKey, day]) => DATE_KEY_RE.test(dateKey) && Boolean(day && day[legacy.id]))
        .map(([dateKey]) => dateKey)
        .sort();
      const checkins = Object.fromEntries(checkedDates.map((dateKey) => [dateKey, true]));
      const id = "legacy-" + legacy.id;
      runs[id] = {
        id,
        name: legacy.name,
        targetDays: legacy.targetDays,
        startDate: checkedDates[0] || MIGRATION_DATE,
        enforceFrom: MIGRATION_DATE,
        status: "active",
        checkins,
        endDate: null,
        endReason: "",
        completedDate: null,
        sourceRunId: null,
        legacyImported: true,
        baseCarry: legacy.baseCarry,
      };
    });
    return { schemaVersion: 2, runs, suggestions: {}, legacyDays: days, migratedAt: MIGRATION_DATE };
  };

  const read = () => {
    try {
      return legacyToV2(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch {
      return legacyToV2({});
    }
  };
  const write = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const patch = (mutation) => window.JoyDailyDaySync?.patch?.(mutation) || Promise.resolve();

  const runProgress = (run, throughDate = "9999-12-31") =>
    Number(run?.baseCarry || 0) + Object.entries(run?.checkins || {}).reduce(
      (sum, [dateKey, value]) => sum + Number(Boolean(value) && dateKey >= String(run.startDate || "") && dateKey <= throughDate),
      0,
    );
  const isChecked = (run, dateKey) => Boolean(run?.checkins?.[dateKey]);
  const suggestionIdFor = (run, dateKey) => ("suggest-" + run.id + "-" + dateKey).slice(0, 180);
  const createSuggestionLocal = (data, run, dateKey, kind) => {
    data.suggestions ||= {};
    const id = suggestionIdFor(run, dateKey);
    data.suggestions[id] = {
      id,
      sourceRunId: run.id,
      name: run.name,
      targetDays: run.targetDays,
      startDate: addDays(dateKey, 1),
      kind,
    };
  };
  const finishLocal = (data, run, dateKey, status, reason = "") => {
    run.status = status;
    run.endDate = dateKey;
    run.endReason = status === "ended" ? String(reason || "").trim().slice(0, 500) : "";
    run.completedDate = status === "completed" ? dateKey : null;
    createSuggestionLocal(data, run, dateKey, status === "completed" ? "continue" : "restart");
  };
  const generateRunId = () => {
    const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 10) || Math.random().toString(36).slice(2, 12);
    return "run-" + Date.now().toString(36) + "-" + random;
  };

  const pendingGap = (run, dateKey) => {
    if (run?.status !== "active" || dateKey !== todayKey()) return "";
    const start = String(run.enforceFrom || run.startDate || "");
    if (!start || start >= dateKey) return "";
    for (let cursor = start; cursor < dateKey; cursor = addDays(cursor, 1)) {
      if (!run.checkins?.[cursor]) return cursor;
    }
    return "";
  };

  const runLastDate = (run) =>
    run?.status === "completed"
      ? String(run.completedDate || "")
      : run?.status === "ended"
        ? String(run.endDate || "")
        : "";

  const runVisibleOnDate = (run, dateKey) => {
    const startDate = String(run?.startDate || "");
    if (!startDate || dateKey < startDate) return false;
    if (run?.status === "active") return true;
    const lastDate = runLastDate(run);
    return Boolean(lastDate && dateKey <= lastDate);
  };

  const ensureStyles = () => {
    if (document.querySelector("#joy-daily-day-streak-styles-v2")) return;
    const style = document.createElement("style");
    style.id = "joy-daily-day-streak-styles-v2";
    style.textContent = [
      "#daily-day-modal [data-dd-streak-card]{position:relative}",
      "#daily-day-modal .dd-streak-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}",
      "#daily-day-modal .dd-streak-head .dd-section{margin:0}",
      "#daily-day-modal .dd-streak-add,#daily-day-modal .dd-streak-more{border:1px solid #d6dfdc;background:#f8faf8;color:#55747a;border-radius:9px;font:800 11px Nunito,system-ui;cursor:pointer}",
      "#daily-day-modal .dd-streak-add{height:29px;padding:0 9px}",
      "#daily-day-modal .dd-streak-more{width:28px;height:28px;padding:0}",
      "#daily-day-modal .dd-streak-list{display:grid;gap:8px}",
      "#daily-day-modal .dd-streak-run{display:grid;grid-template-columns:22px minmax(0,1fr) auto 62px 28px;gap:8px;align-items:center}",
      "#daily-day-modal .dd-streak-run.archived .dd-streak-check:disabled{opacity:1;cursor:default}",
      "#daily-day-modal .dd-streak-run.end-day{padding:7px 8px;border:1px solid #d8dcda;border-radius:10px;background:#eef0ee;color:#7c8585}",
      "#daily-day-modal .dd-streak-run.end-day .dd-streak-run-main em{color:#919999}",
      "#daily-day-modal .dd-streak-run.end-day .dd-streak-check.checked{border-color:#969e9d;background:#969e9d}",
      "#daily-day-modal .dd-streak-run.end-day .dd-track i{background:#9ba3a2}",
      "#daily-day-modal .dd-streak-ended-note{margin:-2px 0 2px 30px;padding:6px 8px;border-left:2px solid #b8bfbd;color:#7d8585;font-size:10.5px;line-height:1.35}",
      "#daily-day-modal .dd-streak-ended-note strong{font-size:10.5px;color:#6f7777}",
      "#daily-day-modal .dd-streak-completed-note{margin:-2px 0 2px 30px;padding:6px 8px;border-left:2px solid #86a29f;color:#657a79;font-size:10.5px;line-height:1.35}",
      "#daily-day-modal .dd-streak-run-main{min-width:0;display:grid;gap:2px}",
      "#daily-day-modal .dd-streak-run-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px}",
      "#daily-day-modal .dd-streak-run-main em{font-style:normal;color:#778589;font-size:10.5px}",
      "#daily-day-modal .dd-streak-run small{min-width:48px;text-align:right;font-variant-numeric:tabular-nums;font-size:13.5px}",
      "#daily-day-modal .dd-streak-check{width:20px;height:20px;padding:0;display:grid;place-items:center;border:1.5px solid #83a4a3;border-radius:50%;background:#fffefa;color:transparent;font:800 12px/1 Nunito,system-ui;cursor:pointer}",
      "#daily-day-modal .dd-streak-check.checked{border-color:#648f8e;background:#648f8e;color:#fff}",
      "#daily-day-modal .dd-streak-check:disabled{opacity:.35;cursor:default}",
      "#daily-day-modal .dd-streak-gap,#daily-day-modal .dd-streak-suggestion,#daily-day-modal .dd-streak-finish{padding:9px 10px;border:1px solid #dde4e1;border-radius:10px;background:#f7faf8;font-size:11px}",
      "#daily-day-modal .dd-streak-gap{border-style:dashed}",
      "#daily-day-modal .dd-streak-gap strong,#daily-day-modal .dd-streak-suggestion strong,#daily-day-modal .dd-streak-finish strong{display:block;margin-bottom:4px}",
      "#daily-day-modal .dd-streak-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}",
      "#daily-day-modal .dd-streak-actions button{height:28px;padding:0 9px;border:1px solid #d3ddda;border-radius:8px;background:#fff;color:#536b72;font:800 10.5px Nunito,system-ui;cursor:pointer}",
      "#daily-day-modal .dd-streak-empty{color:#788487;font-size:11px}",
      "#daily-day-modal .dd-calendar-day{overflow:visible}",
      "#daily-day-modal .dd-calendar-achievement{position:absolute;right:3px;bottom:14px;z-index:3;font-size:9px;line-height:1}",
      "#dd-streak-dialog.dd-streak-dialog-backdrop{position:fixed;inset:0;z-index:96;display:grid;place-items:center;padding:18px;background:rgba(18,21,23,.5);backdrop-filter:blur(10px)}",
      "#dd-streak-dialog[hidden]{display:none}",
      "#dd-streak-dialog .dd-streak-dialog{width:min(460px,calc(100vw - 28px));max-height:82vh;overflow:auto;padding:18px;border:1px solid #d9dfdc;border-radius:18px;background:#f8f6f1;color:#32464d;box-shadow:0 24px 70px rgba(20,30,33,.3)}",
      "#dd-streak-dialog .dd-streak-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:10px}",
      "#dd-streak-dialog h3{margin:0;font-size:20px}",
      "#dd-streak-dialog .dd-streak-dialog-close{width:32px;height:32px;border:0;border-radius:9px;background:#e8eeeb;color:#526a70;font-size:18px;cursor:pointer}",
      "#dd-streak-dialog form{display:grid;gap:11px;margin-top:14px}",
      "#dd-streak-dialog label{display:grid;gap:5px;color:#61757b;font-size:11px;font-weight:800}",
      "#dd-streak-dialog input,#dd-streak-dialog textarea{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #d4ddda;border-radius:9px;background:#fff;color:#33494f;font:700 13px Nunito,system-ui;outline:none}",
      "#dd-streak-dialog textarea{min-height:88px;resize:vertical}",
      "#dd-streak-dialog .dd-streak-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}",
      "#dd-streak-dialog .dd-streak-dialog-actions button,#dd-streak-dialog .dd-streak-menu button{min-height:34px;padding:0 12px;border:1px solid #d2dcda;border-radius:9px;background:#fff;color:#526a70;font:800 11px Nunito,system-ui;cursor:pointer}",
      "#dd-streak-dialog .dd-streak-dialog-actions .primary{border-color:#648d8d;background:#648d8d;color:#fff}",
      "#dd-streak-dialog .dd-streak-menu{display:grid;gap:8px;margin-top:14px}",
      "#dd-streak-dialog .dd-streak-history{display:grid;gap:9px;margin-top:14px}",
      "#dd-streak-dialog .dd-streak-history article{padding:10px;border:1px solid #dde3e0;border-radius:10px;background:#fff}",
      "#dd-streak-dialog .dd-streak-history strong{display:block}",
      "#dd-streak-dialog .dd-streak-history small{display:block;margin-top:4px;color:#738084}",
      "@media(max-width:650px){#daily-day-modal .dd-streak-run{grid-template-columns:22px minmax(0,1fr) auto 28px}#daily-day-modal .dd-streak-run>.dd-track{grid-column:2/5;width:100%}}",
    ].join("");
    document.head.append(style);
  };

  const ensureDialog = () => {
    let backdrop = document.querySelector("#dd-streak-dialog");
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = "dd-streak-dialog";
    backdrop.className = "dd-streak-dialog-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = '<section class="dd-streak-dialog" role="dialog" aria-modal="true"><div data-dd-streak-dialog-body></div></section>';
    document.body.append(backdrop);
    return backdrop;
  };
  const closeDialog = () => {
    const dialog = ensureDialog();
    dialog.hidden = true;
    dialog.querySelector("[data-dd-streak-dialog-body]").innerHTML = "";
  };
  const dialogShell = (title, body) =>
    '<div class="dd-streak-dialog-head"><h3>' + esc(title) + '</h3><button type="button" class="dd-streak-dialog-close" data-dd-streak-dialog-close aria-label="' + esc(t("common.close")) + '">×</button></div>' + body;

  const openRunForm = ({ mode, run = null, suggestion = null }) => {
    const dialog = ensureDialog();
    const isEdit = mode === "edit";
    const isSuggestion = mode === "suggestion";
    const title = isEdit ? t("dailyDay.streak.edit") : isSuggestion ? t("dailyDay.streak.suggestionEdit") : t("dailyDay.streak.new");
    const name = run?.name || suggestion?.name || "";
    const targetDays = run?.targetDays || suggestion?.targetDays || 14;
    const startDate = run?.startDate || suggestion?.startDate || todayKey();
    dialog.querySelector("[data-dd-streak-dialog-body]").innerHTML = dialogShell(title,
      '<form data-dd-streak-form data-mode="' + esc(mode) + '" data-run-id="' + esc(run?.id || "") + '" data-suggestion-id="' + esc(suggestion?.id || "") + '">' +
        '<label>' + esc(t("dailyDay.streak.name")) + '<input required maxlength="120" name="name" value="' + esc(name) + '"></label>' +
        '<label>' + esc(t("dailyDay.streak.target")) + '<input required min="1" max="10000" type="number" name="targetDays" value="' + esc(targetDays) + '"></label>' +
        '<label>' + esc(t("dailyDay.streak.startDate")) + '<input required type="date" name="startDate" value="' + esc(startDate) + '"></label>' +
        '<div class="dd-streak-dialog-actions"><button type="button" data-dd-streak-dialog-close>' + esc(t("dailyDay.streak.cancel")) + '</button><button class="primary" type="submit">' + esc(isSuggestion ? t("dailyDay.streak.start") : t("dailyDay.streak.save")) + '</button></div>' +
      '</form>'
    );
    dialog.hidden = false;
    dialog.querySelector('input[name="name"]')?.focus();
  };

  const openEndDialog = (run) => {
    const dialog = ensureDialog();
    const progress = runProgress(run, todayKey());
    dialog.querySelector("[data-dd-streak-dialog-body]").innerHTML = dialogShell(t("dailyDay.streak.end"),
      '<p>' + esc(t("dailyDay.streak.endSummary", { current: progress, target: run.targetDays })) + '</p>' +
      '<form data-dd-streak-end-form data-run-id="' + esc(run.id) + '">' +
        '<label>' + esc(t("dailyDay.streak.reason")) + '<textarea maxlength="500" name="reason" placeholder="' + esc(t("dailyDay.streak.reasonPlaceholder")) + '"></textarea></label>' +
        '<div class="dd-streak-dialog-actions"><button type="button" data-dd-streak-dialog-close>' + esc(t("dailyDay.streak.cancel")) + '</button><button class="primary" type="submit">' + esc(t("dailyDay.streak.endConfirm")) + '</button></div>' +
      '</form>'
    );
    dialog.hidden = false;
    dialog.querySelector("textarea")?.focus();
  };

  const openHistory = () => {
    const data = read();
    const archived = Object.values(data.runs || {})
      .filter((run) => run.status === "completed" || run.status === "ended")
      .sort((a, b) => String(b.endDate || b.completedDate || "").localeCompare(String(a.endDate || a.completedDate || "")));
    const body = archived.length
      ? '<div class="dd-streak-history">' + archived.map((run) => {
          const completed = run.status === "completed";
          const dateKey = completed ? run.completedDate : run.endDate;
          const result = Math.min(runProgress(run, dateKey || "9999-12-31"), Number(run.targetDays || 0));
          return '<article><strong>' + esc((completed ? "🏆 " : "") + run.name) + '</strong><small>' +
            esc(result + "/" + run.targetDays + " · " + formatDate(dateKey || run.startDate)) +
            '</small>' + (run.endReason ? '<small>' + esc(run.endReason) + '</small>' : '') + '</article>';
        }).join("") + '</div>'
      : '<p>' + esc(t("dailyDay.streak.historyEmpty")) + '</p>';
    const dialog = ensureDialog();
    dialog.querySelector("[data-dd-streak-dialog-body]").innerHTML = dialogShell(t("dailyDay.streak.history"), body);
    dialog.hidden = false;
  };

  const openRunMenu = (run) => {
    const dialog = ensureDialog();
    dialog.querySelector("[data-dd-streak-dialog-body]").innerHTML = dialogShell(run.name,
      '<div class="dd-streak-menu">' +
        '<button type="button" data-dd-streak-edit="' + esc(run.id) + '">' + esc(t("dailyDay.streak.edit")) + '</button>' +
        '<button type="button" data-dd-streak-end="' + esc(run.id) + '">' + esc(t("dailyDay.streak.end")) + '</button>' +
        '<button type="button" data-dd-streak-history>' + esc(t("dailyDay.streak.history")) + '</button>' +
      '</div>'
    );
    dialog.hidden = false;
  };

  const locateCard = () => {
    const existing = document.querySelector("#daily-day-modal [data-dd-streak-card]");
    if (existing) return existing;
    const row = document.querySelector("#daily-day-modal .dd-streak");
    const card = row?.closest(".dd-card");
    if (card) card.dataset.ddStreakCard = "true";
    return card || null;
  };

  const decorateCalendar = (data) => {
    document.querySelectorAll("#daily-day-modal .dd-calendar-achievement").forEach((node) => node.remove());
    const completedByDate = {};
    Object.values(data.runs || {}).forEach((run) => {
      if (run.status !== "completed" || !run.completedDate) return;
      completedByDate[run.completedDate] ||= [];
      completedByDate[run.completedDate].push(run);
    });
    Object.entries(completedByDate).forEach(([dateKey, runs]) => {
      const day = document.querySelector('#daily-day-modal [data-dd-calendar-date="' + CSS.escape(dateKey) + '"]');
      if (!day) return;
      const badge = document.createElement("span");
      badge.className = "dd-calendar-achievement";
      badge.textContent = runs.length > 1 ? "🏆" + runs.length : "🏆";
      badge.title = runs.map((run) => run.name + " " + run.targetDays).join(", ");
      day.append(badge);
    });
  };

  const enhance = () => {
    ensureStyles();
    const card = locateCard();
    if (!card) return;
    const dateKey = selectedDate();
    const now = todayKey();
    const data = read();
    decorateCalendar(data);

    const visibleRuns = Object.values(data.runs || {})
      .filter((run) => runVisibleOnDate(run, dateKey))
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    const suggestions = Object.values(data.suggestions || {})
      .filter((suggestion) => String(suggestion.startDate || "") <= dateKey)
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));

    const signature = JSON.stringify({
      dateKey,
      now,
      runs: visibleRuns.map((run) => [run.id, run.name, run.targetDays, run.status, run.endDate, run.completedDate, runProgress(run, dateKey), isChecked(run, dateKey), pendingGap(run, dateKey)]),
      suggestions: suggestions.map((item) => [item.id, item.name, item.targetDays, item.startDate, item.kind]),
    });
    if (card.dataset.ddStreakV2Signature === signature) return;
    card.dataset.ddStreakV2Signature = signature;

    const rows = visibleRuns.map((run) => {
      const current = runProgress(run, dateKey);
      const target = Number(run.targetDays || 1);
      const percent = Math.min(100, Math.round(current / target * 100));
      const checked = isChecked(run, dateKey);
      const archived = run.status !== "active";
      const isEndDay = run.status === "ended" && String(run.endDate || "") === dateKey;
      const isCompletedDay = run.status === "completed" && String(run.completedDate || "") === dateKey;
      const canCheck = !archived && dateKey >= String(run.startDate || "") && dateKey <= now;
      const gap = pendingGap(run, dateKey);
      const rowClass = "dd-streak-run" + (archived ? " archived" : "") + (isEndDay ? " end-day" : "") + (isCompletedDay ? " completed-day" : "");
      const action = archived
        ? ""
        : '<button type="button" class="dd-streak-more" data-dd-streak-more="' + esc(run.id) + '" aria-label="' + esc(t("dailyDay.streak.more")) + '">•••</button>';
      const endNote = isEndDay
        ? '<div class="dd-streak-ended-note"><strong>' + esc(t("dailyDay.streak.ended")) + " · " + current + "/" + target + '</strong>' + (run.endReason ? '<div>' + esc(run.endReason) + '</div>' : '') + '</div>'
        : "";
      const completedNote = isCompletedDay
        ? '<div class="dd-streak-completed-note"><strong>🏆 ' + esc(t("dailyDay.streak.completed")) + " · " + current + "/" + target + '</strong></div>'
        : "";
      return '<div class="' + rowClass + '" data-dd-streak-run="' + esc(run.id) + '">' +
        '<button type="button" class="dd-streak-check ' + (checked ? "checked" : "") + '" data-dd-streak-check="' + esc(run.id) + '" aria-pressed="' + checked + '" ' + (canCheck ? "" : "disabled") + ' aria-label="' + esc((checked ? t("dailyDay.streak.uncheck") : t("dailyDay.streak.check")) + " " + run.name) + '">' + (checked ? "✓" : "") + '</button>' +
        '<div class="dd-streak-run-main"><strong>' + esc(run.name) + '</strong><em>' + esc(formatDate(run.startDate)) + '</em></div>' +
        '<small>' + current + '/' + target + '</small>' +
        '<span class="dd-track"><i style="width:' + percent + '%"></i></span>' +
        action +
      '</div>' +
      endNote +
      completedNote +
      (gap ? '<div class="dd-streak-gap"><strong>' + esc(t("dailyDay.streak.gapTitle")) + '</strong><span>' + esc(t("dailyDay.streak.gapCopy", { date: formatDate(gap) })) + '</span><div class="dd-streak-actions"><button type="button" data-dd-streak-fill-gap="' + esc(run.id) + '" data-date="' + esc(gap) + '">' + esc(t("dailyDay.streak.markComplete")) + '</button><button type="button" data-dd-streak-end="' + esc(run.id) + '">' + esc(t("dailyDay.streak.end")) + '</button></div></div>' : '');
    }).join("");

    const suggestionsHtml = suggestions.map((suggestion) =>
      '<div class="dd-streak-suggestion"><strong>' + esc(suggestion.kind === "restart" ? t("dailyDay.streak.restartTitle") : t("dailyDay.streak.continueTitle")) + '</strong><span>' + esc(suggestion.name + " · " + suggestion.targetDays + " " + t("dailyDay.streak.days")) + '</span><div class="dd-streak-actions"><button type="button" data-dd-streak-suggestion-start="' + esc(suggestion.id) + '">' + esc(t("dailyDay.streak.start")) + '</button><button type="button" data-dd-streak-suggestion-edit="' + esc(suggestion.id) + '">' + esc(t("dailyDay.streak.edit")) + '</button><button type="button" data-dd-streak-suggestion-dismiss="' + esc(suggestion.id) + '">' + esc(t("dailyDay.streak.dismiss")) + '</button></div></div>'
    ).join("");

    card.innerHTML =
      '<div class="dd-streak-head"><h3 class="dd-section">' + esc(t("dailyDay.streakTitle")) + '</h3><div><button type="button" class="dd-streak-add" data-dd-streak-history>' + esc(t("dailyDay.streak.history")) + '</button> <button type="button" class="dd-streak-add" data-dd-streak-new>＋ ' + esc(t("dailyDay.streak.new")) + '</button></div></div>' +
      '<div class="dd-streak-list">' +
        (rows || (!suggestionsHtml ? '<div class="dd-streak-empty">' + esc(t("dailyDay.streak.empty")) + '</div>' : '')) +
        suggestionsHtml +
      '</div>';
  };

  const getRun = (runId) => read().runs?.[runId] || null;
  const getSuggestion = (suggestionId) => read().suggestions?.[suggestionId] || null;

  const applyCheck = (runId, dateKey, value) => {
    const data = read();
    const run = data.runs?.[runId];
    if (!run || run.status !== "active") return;
    run.checkins ||= {};
    if (value) run.checkins[dateKey] = true;
    else delete run.checkins[dateKey];
    const target = Number(run.targetDays || 0);
    if (value && target && runProgress(run, dateKey) >= target) finishLocal(data, run, dateKey, "completed");
    write(data);
    patch({ type: "streak-check", date: dateKey, runId, value });
    enhance();
  };

  const applyEnd = (runId, reason) => {
    const data = read();
    const run = data.runs?.[runId];
    if (!run || run.status !== "active") return;
    const dateKey = todayKey();
    finishLocal(data, run, dateKey, "ended", reason);
    write(data);
    patch({ type: "streak-end", date: dateKey, runId, reason });
    closeDialog();
    enhance();
  };

  const applyCreate = ({ name, targetDays, startDate, sourceRunId = null }) => {
    const data = read();
    const runId = generateRunId();
    data.runs ||= {};
    data.runs[runId] = {
      id: runId,
      name,
      targetDays,
      startDate,
      enforceFrom: startDate,
      status: "active",
      checkins: {},
      endDate: null,
      endReason: "",
      completedDate: null,
      sourceRunId,
      legacyImported: false,
      baseCarry: 0,
    };
    write(data);
    patch({ type: "streak-create", date: todayKey(), runId, name, targetDays, startDate, sourceRunId });
    closeDialog();
    enhance();
  };

  const applyUpdate = ({ runId, name, targetDays, startDate }) => {
    const data = read();
    const run = data.runs?.[runId];
    if (!run || run.status !== "active") return;
    run.name = name;
    run.targetDays = targetDays;
    run.startDate = startDate;
    if (!run.enforceFrom || run.enforceFrom < startDate) run.enforceFrom = startDate;
    if (runProgress(run, todayKey()) >= targetDays) finishLocal(data, run, todayKey(), "completed");
    write(data);
    patch({ type: "streak-update", date: todayKey(), runId, name, targetDays, startDate });
    closeDialog();
    enhance();
  };

  const applySuggestionAccept = ({ suggestionId, name, targetDays, startDate }) => {
    const data = read();
    const suggestion = data.suggestions?.[suggestionId];
    if (!suggestion) return;
    const runId = generateRunId();
    data.runs ||= {};
    data.runs[runId] = {
      id: runId,
      name,
      targetDays,
      startDate,
      enforceFrom: startDate,
      status: "active",
      checkins: {},
      endDate: null,
      endReason: "",
      completedDate: null,
      sourceRunId: suggestion.sourceRunId || null,
      legacyImported: false,
      baseCarry: 0,
    };
    delete data.suggestions[suggestionId];
    write(data);
    patch({
      type: "streak-suggestion-accept",
      date: todayKey(),
      suggestionId,
      runId,
      name,
      targetDays,
      startDate,
    });
    closeDialog();
    enhance();
  };

  const applySuggestionDismiss = (suggestionId) => {
    const data = read();
    if (!data.suggestions?.[suggestionId]) return;
    delete data.suggestions[suggestionId];
    write(data);
    patch({ type: "streak-suggestion-dismiss", date: todayKey(), suggestionId });
    enhance();
  };

  document.addEventListener("click", (event) => {
    const newButton = event.target.closest?.("[data-dd-streak-new]");
    if (newButton) { openRunForm({ mode: "create" }); return; }

    const historyButton = event.target.closest?.("[data-dd-streak-history]");
    if (historyButton) { openHistory(); return; }

    const check = event.target.closest?.("[data-dd-streak-check]");
    if (check) {
      const run = getRun(check.dataset.ddStreakCheck);
      const dateKey = selectedDate();
      if (run) applyCheck(run.id, dateKey, !isChecked(run, dateKey));
      return;
    }

    const gap = event.target.closest?.("[data-dd-streak-fill-gap]");
    if (gap) {
      applyCheck(gap.dataset.ddStreakFillGap, gap.dataset.date, true);
      return;
    }

    const more = event.target.closest?.("[data-dd-streak-more]");
    if (more) {
      const run = getRun(more.dataset.ddStreakMore);
      if (run) openRunMenu(run);
      return;
    }

    const edit = event.target.closest?.("[data-dd-streak-edit]");
    if (edit) {
      const run = getRun(edit.dataset.ddStreakEdit);
      if (run) openRunForm({ mode: "edit", run });
      return;
    }

    const end = event.target.closest?.("[data-dd-streak-end]");
    if (end) {
      const run = getRun(end.dataset.ddStreakEnd);
      if (run) openEndDialog(run);
      return;
    }

    const startSuggestion = event.target.closest?.("[data-dd-streak-suggestion-start]");
    if (startSuggestion) {
      const suggestion = getSuggestion(startSuggestion.dataset.ddStreakSuggestionStart);
      if (suggestion) applySuggestionAccept({
        suggestionId: suggestion.id,
        name: suggestion.name,
        targetDays: Number(suggestion.targetDays),
        startDate: suggestion.startDate,
      });
      return;
    }

    const editSuggestion = event.target.closest?.("[data-dd-streak-suggestion-edit]");
    if (editSuggestion) {
      const suggestion = getSuggestion(editSuggestion.dataset.ddStreakSuggestionEdit);
      if (suggestion) openRunForm({ mode: "suggestion", suggestion });
      return;
    }

    const dismissSuggestion = event.target.closest?.("[data-dd-streak-suggestion-dismiss]");
    if (dismissSuggestion) {
      applySuggestionDismiss(dismissSuggestion.dataset.ddStreakSuggestionDismiss);
      return;
    }

    if (event.target.closest?.("[data-dd-streak-dialog-close]") || event.target.id === "dd-streak-dialog") {
      closeDialog();
      return;
    }

    if (event.target.closest?.("#todo-title,[data-dd-date],[data-dd-today],[data-dd-calendar-date],[data-dd-calendar-prev],[data-dd-calendar-next],[data-dd-calendar]")) {
      requestAnimationFrame(enhance);
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest?.("[data-dd-streak-form]");
    if (form) {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim().slice(0, 120);
      const targetDays = Number.parseInt(data.get("targetDays"), 10);
      const startDate = String(data.get("startDate") || "");
      if (!name || !Number.isInteger(targetDays) || targetDays < 1 || targetDays > 10000 || !DATE_KEY_RE.test(startDate)) return;
      const mode = form.dataset.mode;
      if (mode === "edit") applyUpdate({ runId: form.dataset.runId, name, targetDays, startDate });
      else if (mode === "suggestion") applySuggestionAccept({ suggestionId: form.dataset.suggestionId, name, targetDays, startDate });
      else applyCreate({ name, targetDays, startDate });
      return;
    }

    const endForm = event.target.closest?.("[data-dd-streak-end-form]");
    if (endForm) {
      event.preventDefault();
      const data = new FormData(endForm);
      applyEnd(endForm.dataset.runId, String(data.get("reason") || ""));
    }
  });

  window.addEventListener("joy:daily-day-cloud-applied", (event) => {
    if (event.detail?.streakChanged) requestAnimationFrame(enhance);
  });
  ["joy:i18n-ready", "joy:locale-changed"].forEach((name) => window.addEventListener(name, () => requestAnimationFrame(enhance)));

  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  const modal = document.querySelector("#daily-day-modal");
  if (modal) observer.observe(modal, { childList: true, subtree: true });
  else observer.observe(document.documentElement, { childList: true, subtree: true });

  requestAnimationFrame(enhance);
})();
`;

await appendFile(scriptTarget, streakScript);
console.log("Daily Day streak lifecycle v2 appended with migration, history, suggestions, and calendar achievements");
