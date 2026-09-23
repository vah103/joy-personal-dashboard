// Daily Day v1: local-first implementation of the approved Daily Day + Default day mockups.
(function installDailyDayFeature() {
  const STORAGE_KEY = "joy-daily-day-v1";
  const MODAL_ID = "daily-day-modal";
  const LIBRARY_ID = "daily-day-templates-modal";
  const TEMPLATE_IDS = ["morning", "afternoon", "no_workout"];
  const THREE_TEMPLATE_START = "2026-09-16";
  // Keep committed blueprints neutral: private Daily day details belong in protected runtime storage, not this public repo.
  const weekdayBlocks = [
    ["07:00", "dailyDay.block.morningRoutine", ["dailyDay.item.hygiene", "dailyDay.item.breakfast", "dailyDay.item.prepareDay"]],
    ["07:30", "dailyDay.block.exercise", ["dailyDay.item.warmup", "dailyDay.item.workout", "dailyDay.item.stretch"]],
    ["09:00", "dailyDay.block.homeRoutine", ["dailyDay.item.breakfast", "dailyDay.item.prepareDay"]],
    ["10:30", "dailyDay.block.lunch", ["dailyDay.item.lunch", "dailyDay.item.shortRest"]],
    ["11:30", "dailyDay.block.work", ["dailyDay.item.mainWork", "dailyDay.item.checkLog", "dailyDay.item.progressNote"]],
    ["16:30", "dailyDay.block.homeRoutine", ["dailyDay.item.prepareTomorrow", "dailyDay.item.shortRest"]],
    ["18:00", "dailyDay.block.english", ["dailyDay.item.speaking", "dailyDay.item.vocabulary", "dailyDay.item.shadowing"]],
    ["19:00", "dailyDay.block.evening", ["dailyDay.item.planTomorrow", "dailyDay.item.progressNote"]],
    ["22:00", "dailyDay.block.rest", ["dailyDay.item.relax"]],
  ];
  const templates = Object.freeze({
    morning: [
      ["07:00", "dailyDay.block.morningRoutine", ["dailyDay.item.water", "dailyDay.item.hygiene", "dailyDay.item.breakfast", "dailyDay.item.prepareDay"]],
      ["07:30", "dailyDay.block.exercise", ["dailyDay.item.warmup", "dailyDay.item.workout", "dailyDay.item.shower", "dailyDay.item.stretch"]],
      ["09:00", "dailyDay.block.work", ["dailyDay.item.mainWork", "dailyDay.item.checkLog", "dailyDay.item.progressNote"]],
      ["10:30", "dailyDay.block.english", ["dailyDay.item.speaking", "dailyDay.item.vocabulary", "dailyDay.item.shadowing"]],
      ["11:30", "dailyDay.block.lunch", ["dailyDay.item.lunch", "dailyDay.item.shortRest"]],
      ["18:00", "dailyDay.block.evening", ["dailyDay.item.englishReview", "dailyDay.item.planTomorrow"]],
    ],
    afternoon: [
      ["07:00", "dailyDay.block.morningRoutine", ["dailyDay.item.hygiene", "dailyDay.item.breakfast", "dailyDay.item.prepareDay"]],
      ["08:30", "dailyDay.block.work", ["dailyDay.item.mainWork", "dailyDay.item.checkLog"]],
      ["10:30", "dailyDay.block.lunch", ["dailyDay.item.lunch", "dailyDay.item.shortRest"]],
      ["11:00", "dailyDay.block.work", ["dailyDay.item.mainWork", "dailyDay.item.progressNote"]],
      ["14:00", "dailyDay.block.exercise", ["dailyDay.item.warmup", "dailyDay.item.workout", "dailyDay.item.stretch"]],
      ["18:00", "dailyDay.block.english", ["dailyDay.item.speaking", "dailyDay.item.shadowing"]],
      ["19:00", "dailyDay.block.evening", ["dailyDay.item.planTomorrow", "dailyDay.item.prepareTomorrow"]],
      ["22:00", "dailyDay.block.rest", ["dailyDay.item.relax"]],
    ],
    no_workout: [
      ["07:00", "dailyDay.block.morningRoutine", ["dailyDay.item.hygiene", "dailyDay.item.breakfast", "dailyDay.item.prepareDay"]],
      ["07:30", "dailyDay.block.work", ["dailyDay.item.mainWork"]],
      ["10:30", "dailyDay.block.lunch", ["dailyDay.item.lunch", "dailyDay.item.shortRest"]],
      ["11:30", "dailyDay.block.work", ["dailyDay.item.mainWork", "dailyDay.item.progressNote"]],
      ["18:00", "dailyDay.block.english", ["dailyDay.item.speaking", "dailyDay.item.shadowing"]],
      ["19:00", "dailyDay.block.evening", ["dailyDay.item.planTomorrow", "dailyDay.item.prepareTomorrow"]],
      ["22:00", "dailyDay.block.rest", ["dailyDay.item.relax"]],
    ],
  });
  const todayKey = (value = new Date()) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const view = { date: todayKey(), libraryTemplate: "morning", search: "", calendarOpen: false, calendarMonth: "" };
  const t = (key, values = {}) => window.JoyI18n?.t?.(key, values) || key;
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const date = (key) => new Date(`${key}T12:00:00Z`);
  const key = (value) => todayKey(value);
  const addDays = (value, amount) => { const next = date(value); next.setUTCDate(next.getUTCDate() + amount); return key(next); };
  const addMonths = (value, amount) => { const next = date(value); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + amount); return key(next); };
  const weekday = (value) => date(value).getUTCDay();
  const weekStart = (value) => addDays(value, -(weekday(value) === 0 ? 6 : weekday(value) - 1));
  const templateKey = (id) => `dailyDay.template.${id}`;
  const blocks = (id) => templates[id] || templates.no_workout || [];
  const itemId = (templateId, blockIndex, itemIndex) => `${templateId}:${blockIndex}:${itemIndex}`;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return data && typeof data === "object" ? { overrides: data.overrides || {}, checks: data.checks || {} } : { overrides: {}, checks: {} };
    } catch { return { overrides: {}, checks: {} }; }
  }
  function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  function resolvedTemplate(dateKey) { const id = String(load().overrides[dateKey] || ""); if (TEMPLATE_IDS.includes(id)) return id; return dateKey >= THREE_TEMPLATE_START ? "no_workout" : "no_workout"; }
  function checked(dateKey, id) { return Boolean(load().checks[dateKey]?.[id]); }
  function setCheck(dateKey, id, done) { const data = load(); data.checks[dateKey] ||= {}; data.checks[dateKey][id] = Boolean(done); save(data); }
  function setTemplate(dateKey, templateId) { if (!TEMPLATE_IDS.includes(templateId)) return; const data = load(); data.overrides[dateKey] = templateId; save(data); }
  function stats(dateKey, templateId) {
    let total = 0; let complete = 0;
    blocks(templateId).forEach((block, blockIndex) => block[2].forEach((_, itemIndex) => { total += 1; if (checked(dateKey, itemId(templateId, blockIndex, itemIndex))) complete += 1; }));
    return { total, complete, remaining: total - complete };
  }
  function formatDate(dateKey, options) { return window.JoyI18n?.formatDate?.(date(dateKey), { ...options, timeZone: "Asia/Ho_Chi_Minh" }) || dateKey; }
  function toast(keyName) { window.showToast?.(t(keyName)); }

  function installStyles() {
    if (document.querySelector("#joy-daily-day-styles-v1")) return;
    const style = document.createElement("style"); style.id = "joy-daily-day-styles-v1";
    style.textContent = `
      #todo-title[role=button]{cursor:pointer}#todo-title[role=button]:hover{color:var(--accent-dark)}
      .dd-backdrop{position:fixed;inset:0;z-index:82;display:grid;place-items:center;padding:18px;background:rgba(18,21,23,.58);backdrop-filter:blur(12px)}.dd-library-layer{z-index:86}
      .dd-shell{width:min(1120px,calc(100vw - 36px));max-height:90vh;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:26px;background:#f3f0eb;box-shadow:0 34px 100px rgba(14,17,19,.42);color:#263238;font-family:inherit}.dd-scroll{max-height:90vh;overflow:auto;padding:24px}
      .dd-head,.dd-head-side,.dd-template-head,.dd-library-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.dd-title{margin:0;font-size:clamp(30px,4vw,44px);letter-spacing:-.045em}.dd-sub{margin:6px 0 0;color:#758084;font-size:12px;font-weight:700}
      .dd-progress{min-width:166px;padding:11px 14px;border:1px solid #d8d8d2;border-radius:14px;background:#ffffff8c}.dd-progress strong{display:block;margin-bottom:7px;font-size:10px}.dd-track{height:7px;overflow:hidden;border-radius:99px;background:#d9dfdc}.dd-track i{display:block;height:100%;background:#6d9293}
      .dd-icon{width:38px;height:38px;border:0;border-radius:12px;background:#e7eceb;color:#49616a;font-size:19px}.dd-toolbar{margin-top:14px;display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,260px) 38px 38px;gap:8px;align-items:center}.dd-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}.dd-toolbar-icon{width:38px;min-width:38px;padding:0;display:grid;place-items:center}.dd-toolbar-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.dd-template-select{min-width:0}.dd-toolbar{position:relative}.dd-calendar-icon.active{border-color:#8eaaa7;background:#e7f0ee;color:#365f65}.dd-calendar-popover{position:absolute;z-index:12;top:calc(100% + 8px);right:46px;width:min(410px,calc(100vw - 54px));padding:14px;border:1px solid #d7e0dd;border-radius:16px;background:#fffefa;box-shadow:0 18px 48px rgba(36,54,58,.22);color:#314a56}.dd-calendar-head{display:grid;grid-template-columns:34px 1fr 34px;gap:8px;align-items:center}.dd-calendar-head strong{text-align:center;font-size:13px}.dd-calendar-nav{width:34px;height:34px;border:1px solid #dce4e1;border-radius:10px;background:#f5f8f6;color:#45636d;font:inherit;font-size:20px}.dd-calendar-weekdays,.dd-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.dd-calendar-weekdays{margin-top:10px}.dd-calendar-weekdays span{padding:2px 0;text-align:center;color:#718087;font-size:8.5px;font-weight:800}.dd-calendar-day,.dd-calendar-empty{min-width:0;height:47px;border-radius:9px}.dd-calendar-day{position:relative;padding:6px 5px 7px;border:1px solid #dfe5e2;background:#fff;color:#405b66;font:inherit;font-size:10px;font-weight:800}.dd-calendar-day:hover{border-color:#9db9b5;background:#f5faf8}.dd-calendar-day.selected{border-color:#5f8e8d;box-shadow:inset 0 0 0 1px #5f8e8d;background:#edf5f3}.dd-calendar-day.complete{background:#eef6f3}.dd-calendar-day.selected.complete{background:#dcecea}.dd-calendar-number{position:relative;z-index:1}.dd-calendar-progress{position:absolute;left:6px;right:6px;bottom:6px;height:6px;overflow:hidden;border-radius:99px;background:#e2e8e5}.dd-calendar-progress i{display:block;height:100%;border-radius:inherit;background:#6f9a98}.dd-calendar-day.selected .dd-calendar-progress i{background:#527e7d}.dd-calendar-today-dot{position:absolute;top:5px;right:5px;width:5px;height:5px;border-radius:50%;background:#4f7f80}.dd-calendar-legend{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #e2e7e4}.dd-calendar-legend span{display:grid;gap:4px;justify-items:center}.dd-calendar-legend i{width:34px;height:5px;overflow:hidden;border-radius:99px;background:#e2e8e5}.dd-calendar-legend i b{display:block;height:100%;background:#6f9a98}.dd-calendar-legend small{color:#77858a;font-size:7.5px;font-weight:700}@media(max-width:650px){.dd-calendar-popover{position:fixed;left:12px;right:12px;top:110px;width:auto}.dd-calendar-day,.dd-calendar-empty{height:44px}}
      .dd-button,.dd-week button,.dd-select{min-height:38px;border:1px solid #d8d8d2;border-radius:11px;background:#ffffff85;color:#58666a;font:inherit;font-size:10px;font-weight:800}.dd-button{padding:0 14px}.dd-button.primary,.dd-week button.active{border-color:#5d8382;background:#5d8382;color:white}.dd-select{padding:0 10px;background:#f8f7f3}
      .dd-templatebar{margin-top:12px;display:grid;grid-template-columns:auto minmax(160px,1fr) auto auto;gap:9px;align-items:center;padding:10px 12px;border:1px solid #deded8;border-radius:13px;background:#ffffff59}.dd-templatebar label{font-size:10px;font-weight:900}
      .dd-content{margin-top:14px;display:grid;grid-template-columns:minmax(0,1.65fr) minmax(260px,.95fr);gap:14px}.dd-card{border:1px solid #dadbd6;border-radius:16px;background:#ffffff80}.dd-pad{padding:16px}.dd-section{margin:0 0 13px;font-size:13px;font-weight:900}
      .dd-list{position:relative;display:grid;gap:9px}.dd-list:before{content:"";position:absolute;left:7px;top:20px;bottom:20px;width:2px;background:#c8d7d5}.dd-block{position:relative;display:grid;grid-template-columns:62px 1fr;gap:10px;padding-left:18px;animation:ddrise .28s ease-out both}.dd-block:before{content:"";position:absolute;left:3px;top:18px;width:10px;height:10px;border-radius:50%;background:#70999a;box-shadow:0 0 0 4px #eef1ed}@keyframes ddrise{from{opacity:0;transform:translateY(4px)}}
      .dd-time{margin-top:7px;padding:6px;border-radius:10px;background:#e4eceb;text-align:center;color:#365663;font-size:9px;font-weight:900}.dd-body{padding:10px 12px;border:1px solid #e0e0da;border-radius:13px;background:#fcfbf7d6}.dd-blockhead{display:grid;grid-template-columns:1fr auto 52px;gap:8px;align-items:center}.dd-blockhead strong{font-size:10px}.dd-blockhead small{font-size:9px;color:#667578}.dd-items{margin-top:8px;display:flex;flex-wrap:wrap;gap:7px 11px}.dd-check{display:flex;align-items:center;gap:5px;color:#607074;font-size:9px;font-weight:700}.dd-check input{width:13px;height:13px;accent-color:#577f80}
      .dd-side{display:grid;align-content:start;gap:12px}.dd-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.dd-stat{min-height:82px;padding:9px;border-radius:12px;background:#eef2ef;display:grid;align-content:space-between}.dd-stat span{font-size:8px;color:#667578;font-weight:800}.dd-stat strong{font-size:11px}.dd-streak{display:grid;grid-template-columns:1fr auto 70px;gap:7px;align-items:center;margin-top:9px}.dd-streak strong,.dd-streak small{font-size:9px}.dd-notes{margin:0;padding-left:17px;color:#6b7678;font-size:9px;line-height:1.6}.dd-footer{margin-top:14px;display:flex;justify-content:flex-end;gap:9px}
      .dd-library{width:min(1220px,calc(100vw - 30px))}.dd-library-head{align-items:flex-start}.dd-library-head h2{margin:0;font-size:28px;letter-spacing:-.035em}.dd-library-head p{margin:4px 0 0;color:#778184;font-size:10px}.dd-search{min-height:38px;padding:0 12px;border:1px solid #d8d9d4;border-radius:11px;background:#ffffff9e;font:inherit}.dd-library-grid{margin-top:14px;display:grid;grid-template-columns:290px 1fr;gap:14px}.dd-template-list{display:grid;gap:6px;align-content:start}.dd-template-row{width:100%;min-height:54px;padding:9px 11px;display:grid;grid-template-columns:34px 1fr auto;gap:9px;align-items:center;border:1px solid #deded8;border-radius:11px;background:#ffffff7a;color:#35484f;text-align:left}.dd-template-row.active{border-color:#83aaaa;background:#e2f0ee}.dd-template-row i{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#e9efee;font-style:normal}.dd-template-row strong,.dd-template-row small{display:block}.dd-template-row strong{font-size:10px}.dd-template-row small{margin-top:2px;color:#6d7a7d;font-size:8px}
      .dd-detail{padding:16px;border:1px solid #dcdcd7;border-radius:14px;background:#ffffff75}.dd-detail h3{margin:0;font-size:18px}.dd-detail p{margin:3px 0 0;color:#6c787b;font-size:9px}.dd-badge{margin-left:8px;padding:4px 7px;border-radius:99px;background:#e2edf1;color:#56717b;font-size:8px}.dd-info,.dd-note{margin-top:12px;padding:10px 12px;border-radius:11px;background:#e8f1f4;color:#56717a;font-size:9px;line-height:1.5}.dd-timeline{margin-top:12px;display:grid;gap:7px}.dd-timeline-row{display:grid;grid-template-columns:54px minmax(110px,.7fr) 1.8fr;gap:10px;align-items:center;padding:8px 10px;border:1px solid #e0e0da;border-radius:11px;background:#fcfbf7cc}.dd-timeline-row strong{font-size:9px}.dd-template-items{display:flex;flex-wrap:wrap;gap:6px 11px;color:#647276;font-size:8px}.dd-template-items span:before{content:"☐";margin-right:4px;color:#6b8c8d}
      @media(max-width:900px){.dd-content,.dd-library-grid{grid-template-columns:1fr}.dd-side{grid-template-columns:repeat(2,1fr)}.dd-note-card{grid-column:1/-1}.dd-library-grid{grid-template-columns:1fr}.dd-template-list{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:650px){.dd-backdrop{padding:0;align-items:stretch}.dd-shell,.dd-library{width:100%;max-height:100vh;border-radius:0}.dd-scroll{max-height:100vh;padding:16px}.dd-progress{display:none}.dd-toolbar{grid-template-columns:minmax(0,1fr) 38px 38px}.dd-week{grid-column:1/-1;gap:4px}.dd-week button{padding:0;font-size:8px}.dd-template-select{grid-column:1}.dd-content{display:block}.dd-side{margin-top:12px;grid-template-columns:1fr}.dd-note-card{grid-column:auto}.dd-library-head{display:grid;grid-template-columns:1fr auto}.dd-library-head>div:first-child,.dd-search{grid-column:1/-1}.dd-template-list{grid-template-columns:1fr;max-height:240px;overflow:auto}.dd-timeline-row{grid-template-columns:50px 1fr}.dd-template-items{grid-column:1/-1}}
    `;
    document.head.append(style);
  }

  function ensureMarkup() {
    if (!document.querySelector(`#${MODAL_ID}`)) {
      const modal = document.createElement("div"); modal.id = MODAL_ID; modal.className = "dd-backdrop"; modal.hidden = true;
      modal.innerHTML = '<section class="dd-shell" role="dialog" aria-modal="true" aria-labelledby="dd-title"><div class="dd-scroll" data-dd-main></div></section>'; document.body.append(modal);
    }
    if (!document.querySelector(`#${LIBRARY_ID}`)) {
      const modal = document.createElement("div"); modal.id = LIBRARY_ID; modal.className = "dd-backdrop dd-library-layer"; modal.hidden = true;
      modal.innerHTML = '<section class="dd-shell dd-library" role="dialog" aria-modal="true" aria-labelledby="dd-library-title"><div class="dd-scroll" data-dd-library></div></section>'; document.body.append(modal);
    }
  }
  const icon = (id) => id === "morning" ? "☀" : id === "afternoon" ? "☼" : "▣";
  const syncBody = () => { const open = !document.querySelector(`#${MODAL_ID}`)?.hidden || !document.querySelector(`#${LIBRARY_ID}`)?.hidden; if (open) document.body.classList.add("modal-open"); else if (!document.querySelector(".modal-backdrop:not([hidden])")) document.body.classList.remove("modal-open"); };

  const calendarMonthKey = () => view.calendarMonth || `${view.date.slice(0, 7)}-01`;
  const calendarPercent = (dateKey) => {
    const summary = stats(dateKey, resolvedTemplate(dateKey));
    const percent = summary.total ? Math.round(summary.complete / summary.total * 100) : 0;
    return { ...summary, percent };
  };
  const renderCalendarPopover = () => {
    const monthKey = calendarMonthKey();
    const [year, month] = monthKey.split("-").map(Number);
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const offset = (weekday(monthKey) + 6) % 7;
    const today = todayKey();
    const weekdayLabels = Array.from({ length: 7 }, (_, index) => esc(formatDate(addDays("2026-09-07", index), { weekday: "short" })));
    const cells = Array.from({ length: offset }, () => '<span class="dd-calendar-empty" aria-hidden="true"></span>');
    for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
      const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
      const summary = calendarPercent(dateKey);
      const selected = dateKey === view.date;
      const isToday = dateKey === today;
      const label = `${formatDate(dateKey, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} — ${t("dailyDay.completedOf", { complete: summary.complete, total: summary.total })}`;
      cells.push(`<button type="button" class="dd-calendar-day ${selected ? "selected" : ""} ${isToday ? "today" : ""} ${summary.percent === 100 ? "complete" : ""}" data-dd-calendar-date="${dateKey}" aria-label="${esc(label)}" title="${esc(label)}"><span class="dd-calendar-number">${dayNumber}</span><span class="dd-calendar-progress" aria-hidden="true"><i style="width:${summary.percent}%"></i></span>${isToday ? '<b class="dd-calendar-today-dot"></b>' : ""}</button>`);
    }
    const cellCount = offset + dayCount;
    const trailing = (7 - (cellCount % 7)) % 7;
    for (let index = 0; index < trailing; index += 1) cells.push('<span class="dd-calendar-empty" aria-hidden="true"></span>');
    const monthLabel = formatDate(monthKey, { month: "long", year: "numeric" });
    return `<section class="dd-calendar-popover" role="dialog" aria-label="${esc(monthLabel)}"><header class="dd-calendar-head"><button type="button" class="dd-calendar-nav" data-dd-calendar-prev aria-label="${esc(t("dailyDay.previousMonth"))}">‹</button><strong>${esc(monthLabel)}</strong><button type="button" class="dd-calendar-nav" data-dd-calendar-next aria-label="${esc(t("dailyDay.nextMonth"))}">›</button></header><div class="dd-calendar-weekdays">${weekdayLabels.map((label) => `<span>${label}</span>`).join("")}</div><div class="dd-calendar-grid">${cells.join("")}</div><div class="dd-calendar-legend" aria-hidden="true">${[0,25,50,75,100].map((value) => `<span><i><b style="width:${value}%"></b></i><small>${value}%</small></span>`).join("")}</div></section>`;
  };

  function refreshCheckProgress(checkbox) {
    const root = document.querySelector("[data-dd-main]");
    if (!root) return;

    const block = checkbox?.closest?.(".dd-block");
    if (block) {
      const boxes = [...block.querySelectorAll('input[data-dd-check]')];
      const done = boxes.reduce((sum, input) => sum + Number(input.checked), 0);
      const count = block.querySelector("[data-dd-block-count]");
      const track = block.querySelector("[data-dd-block-progress]");
      if (count) count.textContent = `${done}/${boxes.length}`;
      if (track) track.style.width = `${boxes.length ? Math.round(done / boxes.length * 100) : 0}%`;
    }

    const templateId = resolvedTemplate(view.date);
    const summary = stats(view.date, templateId);
    const percent = summary.total ? Math.round(summary.complete / summary.total * 100) : 0;
    const completed = root.querySelector("[data-dd-completed]");
    const overall = root.querySelector("[data-dd-overall-progress]");
    const done = root.querySelector("[data-dd-done]");
    const remaining = root.querySelector("[data-dd-remaining]");
    if (completed) completed.textContent = t("dailyDay.completedOf", { complete: summary.complete, total: summary.total });
    if (overall) overall.style.width = `${percent}%`;
    if (done) done.textContent = `${summary.complete} ${t("dailyDay.items")}`;
    if (remaining) remaining.textContent = `${summary.remaining} ${t("dailyDay.items")}`;

    const calendarDay = root.querySelector(`[data-dd-calendar-date="${view.date}"]`);
    if (calendarDay) {
      const progress = calendarDay.querySelector(".dd-calendar-progress i");
      if (progress) progress.style.width = `${percent}%`;
      calendarDay.classList.toggle("complete", percent === 100);
      const label = `${formatDate(view.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} — ${t("dailyDay.completedOf", { complete: summary.complete, total: summary.total })}`;
      calendarDay.setAttribute("aria-label", label);
      calendarDay.title = label;
    }
  }

  function renderMain() {
    ensureMarkup(); const root = document.querySelector("[data-dd-main]"); const templateId = resolvedTemplate(view.date); const dayBlocks = blocks(templateId); const summary = stats(view.date, templateId); const percent = summary.total ? Math.round(summary.complete / summary.total * 100) : 0; const monday = weekStart(view.date);
    const week = Array.from({ length: 7 }, (_, i) => { const day = addDays(monday, i); return `<button type="button" class="${day === view.date ? "active" : ""}" data-dd-date="${day}">${esc(formatDate(day, { weekday: "short" }))}</button>`; }).join("");
    const options = TEMPLATE_IDS.map((id) => `<option value="${id}" ${id === templateId ? "selected" : ""}>${esc(t(templateKey(id)))}</option>`).join("");
    const rows = dayBlocks.map((block, bi) => { const done = block[2].reduce((sum, _, ii) => sum + Number(checked(view.date, itemId(templateId, bi, ii))), 0); return `<article class="dd-block" data-dd-block-index="${bi}" style="animation-delay:${Math.min(bi * 45, 280)}ms"><time class="dd-time">${esc(block[0])}</time><div class="dd-body"><div class="dd-blockhead"><strong>${esc(t(block[1]))}</strong><small data-dd-block-count>${done}/${block[2].length}</small><span class="dd-track"><i data-dd-block-progress style="width:${block[2].length ? Math.round(done / block[2].length * 100) : 0}%"></i></span></div><div class="dd-items">${block[2].map((item, ii) => { const id = itemId(templateId, bi, ii); return `<label class="dd-check"><input type="checkbox" data-dd-check="${id}" ${checked(view.date, id) ? "checked" : ""}><span>${esc(t(item))}</span></label>`; }).join("")}</div></div></article>`; }).join("");
    const streaks = [[t("dailyDay.streak.one"), 0, 14], [t("dailyDay.streak.two"), 0, 14], [t("dailyDay.streak.three"), 0, 100]];
    root.innerHTML = `<header class="dd-head"><div><h2 class="dd-title" id="dd-title">${esc(t("dailyDay.title"))}</h2><p class="dd-sub">${esc(formatDate(view.date, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }))}</p></div><div class="dd-head-side"><div class="dd-progress"><strong data-dd-completed>${esc(t("dailyDay.completedOf", { complete: summary.complete, total: summary.total }))}</strong><div class="dd-track"><i data-dd-overall-progress style="width:${percent}%"></i></div></div><button class="dd-icon" type="button" data-dd-close aria-label="${esc(t("common.close"))}">×</button></div></header>
      <div class="dd-toolbar dd-toolbar-compact"><div class="dd-week" aria-label="${esc(t("dailyDay.weekNavigation"))}">${week}</div><select class="dd-select dd-template-select" data-dd-select aria-label="${esc(t("dailyDay.defaultDay"))}">${options}</select><button class="dd-button dd-toolbar-icon dd-calendar-icon ${view.calendarOpen ? "active" : ""}" type="button" data-dd-calendar aria-expanded="${view.calendarOpen ? "true" : "false"}" aria-haspopup="dialog" aria-label="${esc(formatDate(view.date, { month: "long", year: "numeric" }))}" title="${esc(formatDate(view.date, { month: "long", year: "numeric" }))}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M8 3v4M16 3v4M4 10h16"></path><path d="M8 14h3M13 14h3M8 17h3"></path></svg></button><button class="dd-button dd-toolbar-icon dd-edit-icon" type="button" aria-label="${esc(t("dailyDay.editDefaultDay"))}" title="${esc(t("dailyDay.editDefaultDay"))}" data-dd-library><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg></button>${view.calendarOpen ? renderCalendarPopover() : ""}</div>
      <div class="dd-content"><section class="dd-card dd-pad"><h3 class="dd-section">${esc(t("dailyDay.todaySchedule"))}</h3><div class="dd-list">${rows}</div></section><aside class="dd-side">
        <section class="dd-card dd-pad"><h3 class="dd-section">${esc(t("dailyDay.todayOverview"))}</h3><div class="dd-summary"><div class="dd-stat"><span>${esc(t("dailyDay.done"))}</span><strong data-dd-done>${summary.complete} ${esc(t("dailyDay.items"))}</strong></div><div class="dd-stat"><span>${esc(t("dailyDay.remaining"))}</span><strong data-dd-remaining>${summary.remaining} ${esc(t("dailyDay.items"))}</strong></div><div class="dd-stat"><span>${esc(t("dailyDay.templateUsing"))}</span><strong>${esc(t(templateKey(templateId)))}</strong></div></div></section>
        <section class="dd-card dd-pad"><h3 class="dd-section">${esc(t("dailyDay.streakTitle"))}</h3>${streaks.map(([label, current, target]) => `<div class="dd-streak"><strong>${esc(label)}</strong><small>${current}/${target}</small><span class="dd-track"><i style="width:${Math.round(current / target * 100)}%"></i></span></div>`).join("")}</section>
        <section class="dd-card dd-pad dd-note-card"><h3 class="dd-section">${esc(t("dailyDay.notes"))}</h3><ul class="dd-notes"><li>${esc(t("dailyDay.noteFuture"))}</li><li>${esc(t("dailyDay.noteHistory"))}</li></ul></section></aside></div>
      <footer class="dd-footer"><button class="dd-button" type="button" data-dd-today>${esc(t("dailyDay.today"))}</button><button class="dd-button primary" type="button" data-dd-save>${esc(t("dailyDay.saveChanges"))}</button></footer>`;
  }

  function renderLibrary() {
    ensureMarkup(); const root = document.querySelector("[data-dd-library]"); const query = view.search.trim().toLocaleLowerCase(); const visible = TEMPLATE_IDS.filter((id) => t(templateKey(id)).toLocaleLowerCase().includes(query)); if (!visible.includes(view.libraryTemplate)) view.libraryTemplate = visible[0] || "morning"; const selected = view.libraryTemplate; const selectedBlocks = blocks(selected);
    const list = visible.map((id) => `<button type="button" class="dd-template-row ${id === selected ? "active" : ""}" data-dd-template="${id}"><i>${icon(id)}</i><span><strong>${esc(t(templateKey(id)))}</strong><small>${esc(t("dailyDay.templateMeta", { start: blocks(id)[0]?.[0] || "—", end: blocks(id).at(-1)?.[0] || "—", count: blocks(id).length }))}</small></span><b>›</b></button>`).join("");
    const timeline = selectedBlocks.map((block) => `<div class="dd-timeline-row"><strong>${esc(block[0])}</strong><strong>${esc(t(block[1]))}</strong><div class="dd-template-items">${block[2].map((item) => `<span>${esc(t(item))}</span>`).join("")}</div></div>`).join("");
    root.innerHTML = `<header class="dd-library-head"><div><h2 id="dd-library-title">${esc(t("dailyDay.libraryTitle"))}</h2><p>${esc(t("dailyDay.librarySubtitle"))}</p></div><input class="dd-search" type="search" data-dd-search value="${esc(view.search)}" placeholder="${esc(t("dailyDay.searchPlaceholder"))}"><button class="dd-button" type="button" data-dd-later>＋ ${esc(t("dailyDay.createTemplate"))}</button><button class="dd-icon" type="button" data-dd-close-library aria-label="${esc(t("common.close"))}">×</button></header>
      <div class="dd-library-grid"><aside class="dd-template-list">${list || `<div class="dd-note">${esc(t("dailyDay.noTemplateMatch"))}</div>`}</aside><section class="dd-detail"><div class="dd-template-head"><div><h3>${esc(t(templateKey(selected)))}${selected === "morning" ? `<span class="dd-badge">${esc(t("dailyDay.defaultTemplate"))}</span>` : ""}</h3><p>${esc(t("dailyDay.templateMeta", { start: selectedBlocks[0]?.[0] || "—", end: selectedBlocks.at(-1)?.[0] || "—", count: selectedBlocks.length }))}</p></div><button class="dd-icon" type="button" data-dd-later aria-label="${esc(t("dailyDay.more"))}">•••</button></div><div class="dd-info">• ${esc(t("dailyDay.noteFuture"))}<br>• ${esc(t("dailyDay.noteHistory"))}</div><h4 class="dd-section" style="margin-top:14px">${esc(t("dailyDay.templateSchedule"))}</h4><div class="dd-timeline">${timeline}</div><div class="dd-note"><strong>${esc(t("dailyDay.templateNote"))}</strong><p>${esc(t("dailyDay.templateNoteCopy"))}</p></div></section></div>
      <footer class="dd-footer"><button class="dd-button" type="button" data-dd-close-library>${esc(t("common.close"))}</button><button class="dd-button" type="button" data-dd-use>${esc(t("dailyDay.useForThisDay"))}</button><button class="dd-button primary" type="button" data-dd-later>${esc(t("dailyDay.editTemplate"))}</button></footer>`;
  }

  function openMain() { installStyles(); ensureMarkup(); renderMain(); const modal = document.querySelector(`#${MODAL_ID}`); modal.hidden = false; syncBody(); setTimeout(() => modal.querySelector("[data-dd-close]")?.focus(), 0); }
  function closeMain() { view.calendarOpen = false; document.querySelector(`#${LIBRARY_ID}`)?.setAttribute("hidden", ""); document.querySelector(`#${MODAL_ID}`)?.setAttribute("hidden", ""); syncBody(); }
  function openLibrary() { installStyles(); ensureMarkup(); view.calendarOpen = false; view.libraryTemplate = resolvedTemplate(view.date); view.search = ""; renderLibrary(); const modal = document.querySelector(`#${LIBRARY_ID}`); modal.hidden = false; syncBody(); setTimeout(() => modal.querySelector("[data-dd-search]")?.focus(), 0); }
  function closeLibrary() { document.querySelector(`#${LIBRARY_ID}`)?.setAttribute("hidden", ""); syncBody(); }
  function bindTitle() { const title = document.querySelector("#todo-title"); if (!title || title.dataset.dailyDayBound) return; title.dataset.dailyDayBound = "true"; title.role = "button"; title.tabIndex = 0; title.setAttribute("aria-haspopup", "dialog"); title.title = t("dailyDay.open"); title.addEventListener("click", openMain); title.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); openMain(); } }); }

  document.addEventListener("click", (event) => {
    const calendarDate = event.target.closest?.("[data-dd-calendar-date]"); if (calendarDate) { view.date = calendarDate.dataset.ddCalendarDate; view.calendarMonth = `${view.date.slice(0, 7)}-01`; view.calendarOpen = false; renderMain(); return; }
    if (event.target.closest?.("[data-dd-calendar-prev]")) { view.calendarMonth = addMonths(calendarMonthKey(), -1); renderMain(); return; }
    if (event.target.closest?.("[data-dd-calendar-next]")) { view.calendarMonth = addMonths(calendarMonthKey(), 1); renderMain(); return; }
    const day = event.target.closest?.("[data-dd-date]"); if (day) { view.date = day.dataset.ddDate; view.calendarOpen = false; renderMain(); return; }
    if (event.target.closest?.("[data-dd-close]")) { closeMain(); return; }
    if (event.target.closest?.("[data-dd-close-library]")) { closeLibrary(); return; }
    if (event.target.closest?.("[data-dd-library]")) { openLibrary(); return; }
    if (event.target.closest?.("[data-dd-today]")) { view.date = todayKey(); renderMain(); return; }
    if (event.target.closest?.("[data-dd-save]")) { toast("dailyDay.savedLocal"); closeMain(); return; }
    if (event.target.closest?.("[data-dd-calendar]")) { view.calendarOpen = !view.calendarOpen; view.calendarMonth = `${view.date.slice(0, 7)}-01`; renderMain(); return; }
    if (event.target.closest?.("[data-dd-later]")) { toast("dailyDay.comingLater"); return; }
    const template = event.target.closest?.("[data-dd-template]"); if (template) { view.libraryTemplate = template.dataset.ddTemplate; renderLibrary(); return; }
    if (event.target.closest?.("[data-dd-use]")) { setTemplate(view.date, view.libraryTemplate); closeLibrary(); renderMain(); toast("dailyDay.templateApplied"); }
  });
  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest?.("[data-dd-check]"); if (checkbox) { setCheck(view.date, checkbox.dataset.ddCheck, checkbox.checked); refreshCheckProgress(checkbox); return; }
    const select = event.target.closest?.("[data-dd-select]"); if (select) { view.calendarOpen = false; setTemplate(view.date, select.value); renderMain(); toast("dailyDay.templateApplied"); }
  });
  document.addEventListener("input", (event) => { if (!event.target.matches?.("[data-dd-search]")) return; const caret = event.target.selectionStart; view.search = event.target.value; renderLibrary(); const input = document.querySelector("[data-dd-search]"); input?.focus(); if (Number.isInteger(caret)) input?.setSelectionRange(caret, caret); });
  document.addEventListener("mousedown", (event) => { if (view.calendarOpen && !event.target.closest?.(".dd-calendar-popover,[data-dd-calendar]")) { view.calendarOpen = false; document.querySelector("#daily-day-modal .dd-calendar-popover")?.remove(); document.querySelector("#daily-day-modal [data-dd-calendar]")?.setAttribute("aria-expanded", "false"); } if (event.target.id === MODAL_ID) closeMain(); if (event.target.id === LIBRARY_ID) closeLibrary(); });
  document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; if (view.calendarOpen) { view.calendarOpen = false; renderMain(); return; } const library = document.querySelector(`#${LIBRARY_ID}`); if (library && !library.hidden) closeLibrary(); else if (!document.querySelector(`#${MODAL_ID}`)?.hidden) closeMain(); });
  ["joy:i18n-ready", "joy:locale-changed"].forEach((name) => window.addEventListener(name, () => { bindTitle(); const title = document.querySelector("#todo-title"); if (title) title.title = t("dailyDay.open"); if (!document.querySelector(`#${MODAL_ID}`)?.hidden) renderMain(); if (!document.querySelector(`#${LIBRARY_ID}`)?.hidden) renderLibrary(); }));
  installStyles(); bindTitle();
})();
