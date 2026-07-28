(() => {
  const planState = () => hubState.projectState?.project?.totalWeeks === 12
    ? hubState.projectState
    : null;
  const previousRenderHub = renderHub;
  const previousAnswer = answerProjectQuestion;

  const currentDate = () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: planState()?.project?.timezone || "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date()).map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  };

  const formatDate = (value) => new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+07:00`));

  const isGateTask = (task) => /^Completion gate:/i.test(task?.label || "");
  const visibleTasks = (day) => (day?.tasks || []).filter((task) => !task.optional && !isGateTask(task));

  function periodsForWeek(week) {
    const indexed = (week?.days || [])
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => !day.optional);
    const labDays = indexed.filter(({ day }) => day.location === "Lab");
    const gateTask = (week?.days || []).flatMap((day) => day.tasks || []).find(isGateTask);
    const gate = gateTask?.label.replace(/^Completion gate:\s*/i, "") || week?.deliverable || "";

    if (!labDays.length) {
      return {
        gate,
        periods: [{
          id: "home",
          eyebrow: "Flexible week",
          title: "Home Work",
          description: "Use this reference list and arrange the work freely within the week.",
          tasks: indexed.flatMap(({ day }) => visibleTasks(day)),
        }],
      };
    }

    const firstLabIndex = labDays[0].index;
    const lastLabIndex = labDays.at(-1).index;
    return {
      gate,
      periods: [
        {
          id: "before-lab",
          eyebrow: "Prepare",
          title: "Before Lab",
          description: "Prepare code, commands, data sheets, safety checks and success criteria before using the robot.",
          tasks: indexed.filter(({ index }) => index < firstLabIndex).flatMap(({ day }) => visibleTasks(day)),
        },
        {
          id: "at-lab",
          eyebrow: "Robot session",
          title: "At the Lab",
          description: "Use lab access for hardware validation, supervised experiments and evidence collection.",
          tasks: labDays.flatMap(({ day }) => visibleTasks(day)),
        },
        {
          id: "after-lab",
          eyebrow: "Process results",
          title: "After Lab",
          description: "Analyze results, fix issues, update the thesis and organize evidence after the lab session.",
          tasks: indexed.filter(({ index }) => index > lastLabIndex).flatMap(({ day }) => visibleTasks(day)),
        },
      ],
    };
  }

  function calendarData() {
    const plan = planState();
    const date = currentDate();
    const weeks = plan?.weeks || [];
    const active = weeks.find((week) => date >= week.start && date <= week.end)
      || weeks.find((week) => date < week.start)
      || weeks.at(-1);
    const next = active ? weeks.find((week) => week.number === active.number + 1) : null;
    return { plan, date, weeks, active, next };
  }

  function weekLabel(week, date) {
    if (date < week.start) return "Upcoming";
    if (date > week.end) return "Previous";
    return "Current week";
  }

  const renderTaskList = (tasks = []) => tasks.length
    ? `<ul class="rp-task-list">${tasks.map((task) => `<li>${escapeHub(task.label)}</li>`).join("")}</ul>`
    : '<p class="hub-muted">No planned items in this period.</p>';

  const renderPeriods = (week) => {
    const grouped = periodsForWeek(week);
    return `<div class="rp-periods ${grouped.periods.length === 1 ? "single" : ""}">${grouped.periods.map((period) => `<section class="rp-period"><header><div><span>${escapeHub(period.eyebrow)}</span><h4>${escapeHub(period.title)}</h4></div></header><p>${escapeHub(period.description)}</p>${renderTaskList(period.tasks)}</section>`).join("")}</div><aside class="rp-gate"><strong>Completion Gate</strong>${escapeHub(grouped.gate)}</aside>`;
  };

  function renderReferenceOverview() {
    const { plan, active, next } = calendarData();
    if (!plan || !active) {
      hubElements.body.innerHTML = '<div class="hub-loading"><span></span><strong>Loading 12-week plan...</strong></div>';
      return;
    }

    const currentStage = getStages().map(effectiveStage)
      .find((stage) => stage.id === plan.project.currentStageId)
      || getStages().map(effectiveStage).find((stage) => stage.status !== "completed");

    hubElements.body.innerHTML = `<div class="rp-overview"><section class="rp-hero"><div><span>Current plan position</span><h3>Week ${active.number} of 12 · ${escapeHub(active.title)}</h3><p>${escapeHub(active.objective)}</p></div><b>Current week</b></section><section class="rp-info-grid"><article><span>Date range</span><strong>${escapeHub(formatDate(active.start))}</strong><small>to ${escapeHub(formatDate(active.end))}</small></article><article><span>Technical focus</span><strong>${escapeHub(currentStage?.shortName || currentStage?.name || "TurtleBot4")}</strong><small>Tracked separately in Roadmap</small></article><article><span>Plan mode</span><strong>Reference only</strong><small>No checkbox or completion score</small></article></section><section class="rp-current"><header><div><span>This week's reference</span><h3>${escapeHub(active.title)}</h3></div><a href="${escapeHub(plan.project.googleDocUrl)}" target="_blank" rel="noreferrer">Open New Plan ↗</a></header><p>${escapeHub(active.deliverable)}</p>${renderPeriods(active)}</section>${next ? `<section class="rp-next"><span>Next week</span><h3>Week ${next.number} · ${escapeHub(next.title)}</h3><p>${escapeHub(formatDate(next.start))} – ${escapeHub(formatDate(next.end))}</p><small>The app will switch automatically when this date range begins.</small></section>` : ""}</div>`;
  }

  function renderReferenceSchedule() {
    const { plan, date, weeks, active } = calendarData();
    if (!plan) {
      hubElements.body.innerHTML = '<div class="hub-loading"><span></span><strong>Loading 12-week plan...</strong></div>';
      return;
    }

    hubElements.body.innerHTML = `<div class="rp-schedule"><header class="rp-header"><div><span>12-week reference plan</span><h3>${escapeHub(formatDate(plan.project.planStart))} – ${escapeHub(formatDate(plan.project.planEnd))}</h3><p>No checkbox and no completion score. The current week is selected only from the calendar and changes automatically over time.</p></div><a href="${escapeHub(plan.project.googleDocUrl)}" target="_blank" rel="noreferrer">Open New Plan ↗</a></header><div class="rp-weeks">${weeks.map((week) => {
      const current = week.number === active?.number;
      const label = weekLabel(week, date);
      return `<details class="rp-week ${current ? "current" : ""}" ${current ? "open" : ""}><summary><span class="rp-week-number">${week.number}</span><span><b>${escapeHub(week.title)}</b><small>${escapeHub(formatDate(week.start))} – ${escapeHub(formatDate(week.end))}</small></span><em class="rp-week-state ${label === "Current week" ? "active" : ""}">${escapeHub(label)}</em></summary><div class="rp-week-body"><p class="rp-week-intro">${escapeHub(week.objective)} <b>Deliverable:</b> ${escapeHub(week.deliverable)}</p>${renderPeriods(week)}</div></details>`;
    }).join("")}</div></div>`;
  }

  const style = document.createElement("style");
  style.dataset.turtlebotReferencePlan = "true";
  style.textContent = `
    #turtlebot-hub-modal,#turtlebot-hub-modal *{font-family:"Nunito",ui-rounded,"Arial Rounded MT Bold",system-ui,sans-serif!important}
    .rp-schedule,.rp-overview{padding:22px;display:grid;gap:14px}.rp-header,.rp-hero,.rp-current,.rp-next,.rp-week{border:1px solid #d6dee2;border-radius:16px;background:#fff}.rp-header,.rp-hero,.rp-current>header{display:flex;justify-content:space-between;gap:18px;padding:20px}.rp-hero{background:radial-gradient(circle at 88% 0%,rgba(132,166,183,.18),transparent 34%),#fff}.rp-header span,.rp-hero span,.rp-current header span,.rp-period header span,.rp-next span,.rp-info-grid span{color:#73828a;font-size:.68rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.rp-header h3,.rp-hero h3,.rp-current h3,.rp-period h4,.rp-next h3{margin:4px 0 0;color:#29363d}.rp-header p,.rp-hero p,.rp-week-intro,.rp-current>p,.rp-next p{margin:7px 0 0;color:#617079;font-size:.78rem;line-height:1.5}.rp-header a,.rp-current a{display:inline-flex;align-items:center;min-height:35px;padding:0 11px;border:1px solid #d1dade;border-radius:9px;color:#556972;font-size:.7rem;font-weight:700;text-decoration:none;height:fit-content}.rp-hero>b{height:fit-content;padding:7px 10px;border-radius:999px;background:#e6eef1;color:#3f5965;font-size:.7rem}.rp-info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.rp-info-grid article{padding:14px;border:1px solid #d7dfe3;border-radius:13px;background:#fff}.rp-info-grid span,.rp-info-grid strong,.rp-info-grid small{display:block}.rp-info-grid strong{margin-top:5px;color:#2e3e46;font-size:1rem}.rp-info-grid small{margin-top:4px;color:#7a878e;font-size:.65rem}.rp-current{padding-bottom:16px}.rp-current>p{padding:0 20px}.rp-next{padding:16px}.rp-next small{display:block;margin-top:5px;color:#7a878e;font-size:.68rem}.rp-weeks{display:grid;gap:9px}.rp-week{overflow:hidden}.rp-week>summary{display:grid;grid-template-columns:35px 1fr auto;gap:10px;align-items:center;padding:13px 15px;list-style:none;cursor:pointer}.rp-week>summary::-webkit-details-marker{display:none}.rp-week-number{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#eaf0f2;color:#526b76;font-size:.75rem;font-weight:900}.rp-week.current .rp-week-number{background:#31434c;color:#fff}.rp-week summary b,.rp-week summary small{display:block}.rp-week summary b{color:#405159;font-size:.79rem}.rp-week summary small{margin-top:2px;color:#829097;font-size:.64rem}.rp-week-state{padding:5px 8px;border-radius:999px;background:#f1f4f5;color:#76858c;font-size:.65rem;font-style:normal;font-weight:800}.rp-week-state.active{background:#e6eef1;color:#3f5965}.rp-week-body{padding:15px;border-top:1px solid #e2e7e9}.rp-periods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:13px}.rp-current .rp-periods,.rp-current .rp-gate{margin-left:20px;margin-right:20px}.rp-periods.single{grid-template-columns:1fr}.rp-period{padding:13px;border:1px solid #dfe5e8;border-radius:13px;background:#fafbfc}.rp-period h4{font-size:.9rem}.rp-period>p{margin:7px 0 10px;color:#78868c;font-size:.67rem;line-height:1.45}.rp-task-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.rp-task-list li{position:relative;padding:9px 10px 9px 25px;border:1px solid #e0e5e7;border-radius:10px;background:#fff;color:#46565e;font-size:.72rem;line-height:1.45}.rp-task-list li::before{content:"•";position:absolute;left:11px;top:8px;color:#78909b;font-size:1rem}.rp-gate{margin-top:12px;padding:12px 14px;border-radius:12px;background:#f2f6f7;color:#53666f;font-size:.72rem;line-height:1.5}.rp-gate strong{display:block;margin-bottom:3px;color:#33474f}
    @media(max-width:980px){.rp-periods,.rp-info-grid{grid-template-columns:1fr}}@media(max-width:600px){.rp-schedule,.rp-overview{padding:13px}.rp-header,.rp-hero,.rp-current>header{flex-direction:column}.rp-week>summary{grid-template-columns:32px 1fr}.rp-week-state{grid-column:1/-1;width:fit-content}.rp-current .rp-periods,.rp-current .rp-gate{margin-left:13px;margin-right:13px}}
  `;
  document.head.append(style);

  renderPlan = renderReferenceOverview;
  renderHub = () => {
    hubElements.tabs.forEach((button) => {
      const active = button.dataset.hubTab === hubState.activeTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    updateHubStatus();

    if (!hubState.source || !planState()) {
      hubElements.body.innerHTML = '<div class="hub-loading"><span></span><strong>Loading TurtleBot project...</strong></div>';
      return;
    }

    if (hubState.activeTab === "schedule") renderReferenceSchedule();
    else if (hubState.activeTab === "plan") renderReferenceOverview();
    else previousRenderHub();
  };

  answerProjectQuestion = (question) => {
    const value = String(question || "").toLowerCase();
    const { active } = calendarData();
    if (/(schedule|week|plan|today|next)/.test(value)) {
      return `The 12-week plan is a calendar-driven reference. The current schedule is Week ${active?.number || "-"} of 12: ${active?.title || "TurtleBot4"}. It contains no checkbox or completion score.`;
    }
    return previousAnswer(question);
  };

  if (!hubElements.modal?.hidden) renderHub();
})();