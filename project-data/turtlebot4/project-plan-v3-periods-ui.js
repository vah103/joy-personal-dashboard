(() => {
  const TOTAL_WEEKS = 12;
  const DAY_MS = 86400000;

  const planState = () => hubState.projectState?.project?.totalWeeks === TOTAL_WEEKS
    ? hubState.projectState
    : null;

  const currentDate = () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
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

  const roadmapItemDone = (id) => getStages()
    .map(effectiveStage)
    .some((stage) => stage.checklist?.some((item) => item.id === id && item.done));

  const taskProgress = (task) => {
    const linkedIds = task.roadmapItemIds || [];
    if (linkedIds.length) return linkedIds.filter(roadmapItemDone).length / linkedIds.length;
    const override = hubState.overrides.planTasks?.[task.id];
    return typeof override === "boolean" ? (override ? 1 : 0) : (task.done ? 1 : 0);
  };

  const taskDone = (task) => taskProgress(task) >= 1;
  const isGateTask = (task) => /^Completion gate:/i.test(task?.label || "");
  const usableTasks = (day) => (day?.tasks || []).filter((task) => !task.optional && !isGateTask(task));

  function periodsForWeek(week) {
    const indexedDays = (week?.days || [])
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => !day.optional);
    const labDays = indexedDays.filter(({ day }) => day.location === "Lab");
    const gateTask = (week?.days || [])
      .flatMap((day) => day.tasks || [])
      .find(isGateTask);
    const gate = gateTask?.label.replace(/^Completion gate:\s*/i, "") || week?.deliverable || "";

    if (!labDays.length) {
      return {
        gate,
        periods: [{
          id: "home",
          eyebrow: "Flexible week",
          title: "Home Work",
          description: "Complete these tasks in any order during the week. No weekday deadline is assigned.",
          tasks: indexedDays.flatMap(({ day }) => usableTasks(day)),
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
          description: "Prepare code, commands, data sheets, safety checks and success criteria at home.",
          tasks: indexedDays
            .filter(({ index }) => index < firstLabIndex)
            .flatMap(({ day }) => usableTasks(day)),
        },
        {
          id: "at-lab",
          eyebrow: "Robot session",
          title: "At the Lab",
          description: "Use robot time for hardware validation, supervised experiments and evidence collection.",
          tasks: labDays.flatMap(({ day }) => usableTasks(day)),
        },
        {
          id: "after-lab",
          eyebrow: "Process results",
          title: "After Lab",
          description: "Analyze data, repair issues, update the thesis and commit evidence after the robot session.",
          tasks: indexedDays
            .filter(({ index }) => index > lastLabIndex)
            .flatMap(({ day }) => usableTasks(day)),
        },
      ],
    };
  }

  const periodProgress = (period) => period.tasks.length
    ? Math.round(period.tasks.reduce((sum, task) => sum + taskProgress(task), 0) / period.tasks.length * 100)
    : 0;

  const weekProgress = (week) => {
    const tasks = periodsForWeek(week).periods.flatMap((period) => period.tasks);
    return tasks.length
      ? Math.round(tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length * 100)
      : 0;
  };

  function snapshot() {
    const state = planState();
    const date = currentDate();
    const weeks = state?.weeks || [];
    const week = weeks.find((item) => date >= item.start && date <= item.end)
      || weeks.find((item) => date < item.start)
      || weeks.at(-1);
    const weekPeriods = periodsForWeek(week).periods;
    const currentPeriod = weekPeriods.find((period) => period.tasks.some((task) => !taskDone(task)))
      || weekPeriods.at(-1);
    let next = null;

    for (const candidateWeek of weeks.filter((item) => !week || item.number >= week.number)) {
      for (const period of periodsForWeek(candidateWeek).periods) {
        const task = period.tasks.find((item) => !taskDone(item));
        if (task) {
          next = { task, period, week: candidateWeek };
          break;
        }
      }
      if (next) break;
    }

    const nextLab = weeks
      .filter((item) => !week || item.number >= week.number)
      .map((item) => ({
        week: item,
        period: periodsForWeek(item).periods.find((period) => period.id === "at-lab"),
      }))
      .find(({ period }) => period?.tasks.some((task) => !taskDone(task))) || null;

    const overdueWeeks = weeks.filter((item) => item.end < date && weekProgress(item) < 100);
    const stages = getStages().map(effectiveStage);
    const stage = stages.find((item) => item.id === state?.project?.currentStageId)
      || stages.find((item) => item.progress < 100)
      || stages.at(-1);
    const stageIndex = Math.max(0, stages.findIndex((item) => item.id === stage?.id)) + 1;
    const start = new Date(`${state?.project?.planStart}T00:00:00+07:00`).getTime();
    const end = new Date(`${state?.project?.planEnd}T00:00:00+07:00`).getTime();
    const now = new Date(`${date}T00:00:00+07:00`).getTime();
    const elapsed = now <= start ? 0 : now >= end ? 100 : Math.round((now - start) / (end - start) * 100);
    const status = date < state?.project?.planStart
      ? "Not started"
      : date > state?.project?.planEnd && projectProgress() < 100
        ? "Behind"
        : overdueWeeks.length
          ? "At risk"
          : "On track";

    return {
      state,
      date,
      week,
      currentPeriod,
      next,
      nextLab,
      overdueWeeks,
      stages,
      stage,
      stageIndex,
      elapsed,
      status,
      overall: projectProgress(),
      weekProgress: weekProgress(week),
    };
  }

  const style = document.createElement("style");
  style.dataset.turtlebotFlexiblePeriods = "true";
  style.textContent = `
    #turtlebot-hub-modal,#turtlebot-hub-modal *{font-family:"Nunito",ui-rounded,"Arial Rounded MT Bold",system-ui,sans-serif!important}
    .fp-schedule,.fp-overview{padding:22px;display:grid;gap:14px}.fp-header,.fp-hero,.fp-panel,.fp-week,.fp-history{border:1px solid #d6dee2;border-radius:16px;background:#fff}.fp-header,.fp-hero{display:flex;justify-content:space-between;gap:18px;padding:20px}.fp-hero{background:radial-gradient(circle at 88% 0%,rgba(132,166,183,.18),transparent 34%),#fff}.fp-header span,.fp-hero span,.fp-panel-title span,.fp-period header span{color:#73828a;font-size:.68rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.fp-header h3,.fp-hero h3,.fp-panel-title h3,.fp-period h4{margin:4px 0 0;color:#29363d}.fp-header p,.fp-hero p,.fp-week-intro{margin:7px 0 0;color:#617079;font-size:.78rem;line-height:1.5}.fp-header a{display:inline-flex;align-items:center;min-height:35px;padding:0 11px;border:1px solid #d1dade;border-radius:9px;color:#556972;font-size:.7rem;font-weight:700;text-decoration:none;height:fit-content}.fp-status{height:fit-content;padding:7px 10px;border-radius:999px;background:#eaf1f4;color:#4a6572;font-size:.7rem;font-weight:800}.fp-status.at-risk,.fp-status.behind{background:#fbf2da;color:#7c6021}.fp-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.fp-metrics article{padding:14px;border:1px solid #d7dfe3;border-radius:13px;background:#fff}.fp-metrics span,.fp-metrics strong,.fp-metrics small{display:block}.fp-metrics span{color:#7a878e;font-size:.66rem}.fp-metrics strong{margin-top:4px;color:#2e3e46;font-size:1.35rem}.fp-metrics small{margin-top:3px;color:#7a878e;font-size:.65rem}.fp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fp-panel,.fp-history{padding:17px}.fp-panel-title{display:flex;justify-content:space-between;gap:12px}.fp-panel-title small{color:#829097;font-size:.67rem}.fp-panel>p{color:#5e6e76;font-size:.75rem;line-height:1.5}.fp-panel ul{padding-left:18px;color:#6d624f;font-size:.71rem;line-height:1.5}.fp-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.fp-actions a{display:inline-flex;align-items:center;min-height:35px;padding:0 11px;border:1px solid #d1dade;border-radius:9px;color:#556972;font-size:.7rem;font-weight:700;text-decoration:none}.fp-weeks{display:grid;gap:9px}.fp-week{overflow:hidden}.fp-week>summary{display:grid;grid-template-columns:35px 1fr 120px;gap:10px;align-items:center;padding:13px 15px;list-style:none;cursor:pointer}.fp-week>summary::-webkit-details-marker{display:none}.fp-week-number{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#eaf0f2;color:#526b76;font-size:.75rem;font-weight:900}.fp-week.current .fp-week-number{background:#31434c;color:#fff}.fp-week summary b,.fp-week summary small{display:block}.fp-week summary b{color:#405159;font-size:.79rem}.fp-week summary small{margin-top:2px;color:#829097;font-size:.64rem}.fp-progress{text-align:right;color:#526a75;font-size:.68rem}.fp-progress i{display:block;height:5px;margin-top:4px;border-radius:99px;background:#e2e8eb;overflow:hidden}.fp-progress em{display:block;height:100%;background:#6e8995}.fp-week-body{padding:15px;border-top:1px solid #e2e7e9}.fp-periods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:13px}.fp-periods.single{grid-template-columns:1fr}.fp-period{padding:13px;border:1px solid #dfe5e8;border-radius:13px;background:#fafbfc}.fp-period header{display:flex;justify-content:space-between;gap:10px}.fp-period h4{font-size:.9rem}.fp-period header b{color:#59717c;font-size:.69rem}.fp-period>p{margin:7px 0 10px;color:#78868c;font-size:.67rem;line-height:1.45}.fp-period .ps-tasks{margin-top:0}.fp-gate{margin-top:12px;padding:12px 14px;border-radius:12px;background:#f2f6f7;color:#53666f;font-size:.72rem;line-height:1.5}.fp-gate strong{display:block;margin-bottom:3px;color:#33474f}.fp-history .ps-timeline{margin-top:12px}
    @media(max-width:980px){.fp-periods{grid-template-columns:1fr}.fp-metrics{grid-template-columns:1fr 1fr}.fp-grid{grid-template-columns:1fr}}@media(max-width:600px){.fp-schedule,.fp-overview{padding:13px}.fp-header,.fp-hero,.fp-panel-title{flex-direction:column}.fp-week>summary{grid-template-columns:32px 1fr}.fp-progress{grid-column:1/-1}.fp-metrics{grid-template-columns:1fr 1fr}}@media(max-width:420px){.fp-metrics{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const renderTasks = (tasks = []) => `<div class="ps-tasks">${tasks.length
    ? tasks.map((task) => {
      const progress = taskProgress(task);
      const done = progress >= 1;
      const linked = (task.roadmapItemIds || []).length;
      return `<label class="ps-task ${done ? "done" : ""}"><input type="checkbox" data-ps-task="${escapeHub(task.id)}" ${done ? "checked" : ""}><span class="ps-check">${done ? "✓" : ""}</span><span><b>${escapeHub(task.label)}</b><small>${linked ? "Technical progress" : "Plan task"}${progress > 0 && progress < 1 ? ` · ${Math.round(progress * 100)}%` : ""}</small></span></label>`;
    }).join("")
    : '<p class="hub-muted">No tasks in this period.</p>'}</div>`;

  const renderChat = () => `<section class="hub-chat-card ps-chat"><header><div><span>Joy project assistant</span><h3>Ask about TurtleBot4</h3></div><i>✦</i></header><div class="hub-chat-suggestions">${[
    "What should I focus on now?",
    "What should I prepare before the lab?",
    "Am I on schedule?",
    "How is progress calculated?",
  ].map((question) => `<button type="button" data-hub-action="ask-suggestion" data-question="${escapeHub(question)}">${escapeHub(question)}</button>`).join("")}</div><div class="hub-chat-log" id="hub-chat-log">${hubState.chat.length
    ? hubState.chat.map((message) => `<div class="hub-chat-message ${message.role}"><span>${message.role === "joy" ? "Joy" : "Vanh"}</span><p>${escapeHub(message.text)}</p></div>`).join("")
    : '<div class="hub-chat-empty"><strong>Flexible 12-week plan is active</strong><p>Joy tracks preparation, robot work, post-lab analysis and technical completion gates without assigning weekday deadlines.</p></div>'}</div><form id="hub-chat-form"><input name="question" autocomplete="off" placeholder="Ask Joy about this project..." required><button type="submit">Send</button></form></section>`;

  function renderOverview() {
    const data = snapshot();
    const focusTasks = data.currentPeriod?.tasks.filter((task) => !taskDone(task)) || [];
    const labTasks = data.nextLab?.period.tasks.filter((task) => !taskDone(task)) || [];
    const history = data.state?.history || [];
    hubElements.body.innerHTML = `<div class="fp-overview"><section class="fp-hero"><div><span>Project State v3 · Flexible workflow</span><h3>${escapeHub(data.week ? `Week ${data.week.number}: ${data.week.title}` : "TurtleBot4")}</h3><p>${escapeHub(data.week?.objective || data.stage?.objective || "")}</p></div><b class="fp-status ${data.status.toLowerCase().replaceAll(" ", "-")}">${escapeHub(data.status)}</b></section><section class="fp-metrics"><article><span>Overall completion</span><strong>${data.overall}%</strong><small>All 9 technical stages</small></article><article><span>Current week</span><strong>${data.week?.number || "-"}/12</strong><small>${data.weekProgress}% required tasks</small></article><article><span>Technical stage</span><strong>${data.stageIndex}/${data.stages.length}</strong><small>${escapeHub(data.stage?.shortName || data.stage?.name || "")}</small></article><article><span>Timeline elapsed</span><strong>${data.elapsed}%</strong><small>Time never adds progress</small></article></section><div class="fp-grid"><section class="fp-panel"><div class="fp-panel-title"><div><span>Current focus</span><h3>${escapeHub(data.currentPeriod?.title || "Next planned action")}</h3></div><small>Week ${data.week?.number || "-"}</small></div>${renderTasks(focusTasks.length ? focusTasks : [data.next?.task].filter(Boolean))}<div class="fp-actions"><button class="hub-primary-button" data-hub-action="add-plan-to-todo">Add next action to To-do</button><a href="${escapeHub(data.state?.project?.googleDocUrl)}" target="_blank" rel="noreferrer">Open New Plan ↗</a></div></section><section class="fp-panel"><div class="fp-panel-title"><div><span>Robot work</span><h3>${data.nextLab ? `Week ${data.nextLab.week.number} · At the Lab` : "No lab period pending"}</h3></div><small>Flexible within the week</small></div>${renderTasks(labTasks)}</section><section class="fp-panel"><div class="fp-panel-title"><div><span>Current completion gate</span><h3>${escapeHub(data.stage?.name || "Current stage")}</h3></div></div><p>${escapeHub(data.stage?.completionCriteria || "")}</p><ul>${(data.state?.project?.currentBlockers || []).map((blocker) => `<li>${escapeHub(blocker)}</li>`).join("")}</ul></section><section class="fp-panel"><div class="fp-panel-title"><div><span>Weekly workflow</span><h3>Flexible, evidence-first execution</h3></div></div><p>Complete preparation before using the robot, perform supervised validation at the lab, then analyze and commit evidence afterward. Tasks are not tied to Monday–Sunday deadlines.</p><p><b>${data.overdueWeeks.length}</b> previous week${data.overdueWeeks.length === 1 ? "" : "s"} still have required work open.</p></section></div><section class="fp-history"><div class="fp-panel-title"><div><span>Progress history</span><h3>Evidence-backed milestones</h3></div><small>Technical progress only</small></div><div class="ps-timeline">${history.map((entry) => `<article><div><small>${escapeHub(formatDate(entry.date))}</small><b>${escapeHub(entry.title)}</b><p>${escapeHub(entry.detail)}</p></div><em>${entry.progressAfter}%</em></article>`).join("")}</div></section>${renderChat()}</div>`;
  }

  function renderSchedule() {
    const data = snapshot();
    const weeks = data.state?.weeks || [];
    hubElements.body.innerHTML = `<div class="fp-schedule"><header class="fp-header"><div><span>12-week execution plan</span><h3>${escapeHub(formatDate(data.state.project.planStart))} – ${escapeHub(formatDate(data.state.project.planEnd))}</h3><p>Each week is organized by workflow period rather than weekday: prepare before lab, work with the robot at the lab, then process results after lab.</p></div><a href="${escapeHub(data.state.project.googleDocUrl)}" target="_blank" rel="noreferrer">Open New Plan ↗</a></header><div class="fp-weeks">${weeks.map((week) => {
      const grouped = periodsForWeek(week);
      const progress = weekProgress(week);
      const current = week.number === data.week?.number;
      return `<details class="fp-week ${current ? "current" : ""}" ${current ? "open" : ""}><summary><span class="fp-week-number">${week.number}</span><span><b>${escapeHub(week.title)}</b><small>${escapeHub(formatDate(week.start))} – ${escapeHub(formatDate(week.end))}</small></span><span class="fp-progress">${progress}%<i><em style="width:${progress}%"></em></i></span></summary><div class="fp-week-body"><p class="fp-week-intro">${escapeHub(week.objective)} <b>Deliverable:</b> ${escapeHub(week.deliverable)}</p><div class="fp-periods ${grouped.periods.length === 1 ? "single" : ""}">${grouped.periods.map((period) => `<section class="fp-period"><header><div><span>${escapeHub(period.eyebrow)}</span><h4>${escapeHub(period.title)}</h4></div><b>${periodProgress(period)}%</b></header><p>${escapeHub(period.description)}</p>${renderTasks(period.tasks)}</section>`).join("")}</div><div class="fp-gate"><strong>Completion Gate</strong>${escapeHub(grouped.gate)}</div></div></details>`;
    }).join("")}</div></div>`;
  }

  const previousRenderHub = renderHub;
  const previousUpdateCard = updateTurtleBotCard;

  const syncTabs = () => {
    hubElements.tabs.forEach((button) => {
      const active = button.dataset.hubTab === hubState.activeTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    updateHubStatus();
  };

  renderHub = () => {
    if (!planState()) return previousRenderHub();
    if (hubState.activeTab === "schedule") {
      syncTabs();
      renderSchedule();
      return;
    }
    if (hubState.activeTab === "plan") {
      syncTabs();
      renderOverview();
      return;
    }
    previousRenderHub();
  };

  effectivePlan = () => {
    const data = snapshot();
    return {
      title: data.next?.task.label || "Review the current completion gate",
      why: data.stage?.completionCriteria || "",
      location: data.next?.period.id === "at-lab" ? "Lab" : "Home",
      priority: "High",
      currentFocus: data.next?.task.label || "",
      nextAction: data.next?.task.label || "",
      completionCriteria: data.stage?.completionCriteria || "",
    };
  };

  updateTurtleBotCard = () => {
    previousUpdateCard();
    if (!planState() || !hubState.source) return;
    const data = snapshot();
    const card = findTurtleBotCard();
    if (!card) return;
    const details = card.querySelectorAll("dl dd");
    if (details[0]) details[0].textContent = data.next?.task.label || data.stage?.objective || "";
    if (details[1]) details[1].textContent = data.currentPeriod?.title || "Review the current completion gate";
    const pill = card.querySelector(".project-stage-pill");
    if (pill) pill.textContent = `Week ${data.week?.number || "-"} of 12 · Stage ${data.stageIndex} of ${data.stages.length}`;
    const source = card.querySelector(".project-git-source");
    if (source) source.textContent = `Project State v3 · Flexible periods · ${data.status}`;
  };

  answerProjectQuestion = (question) => {
    const value = String(question || "").toLowerCase();
    const data = snapshot();
    const nextAction = data.next?.task.label || "Review the current completion gate";
    if (/today|next|focus|what should i do/.test(value)) {
      return `You are in Week ${data.week?.number || "-"} of 12, ${data.currentPeriod?.title || "current workflow"}. Next action: ${nextAction}.`;
    }
    if (/lab|prepare/.test(value)) {
      return data.nextLab
        ? `The next robot-work period is Week ${data.nextLab.week.number}, At the Lab. Prepare before going: ${data.nextLab.period.tasks.filter((task) => !taskDone(task)).map((task) => task.label).join("; ")}.`
        : `No robot-work period is pending. Continue with: ${nextAction}.`;
    }
    if (/progress|percent|completion/.test(value)) {
      return `Overall technical completion is ${data.overall}% across all nine stages. Week ${data.week?.number || "-"} is ${data.weekProgress}%. Weekday timing never adds technical progress.`;
    }
    if (/schedule|track|late|behind|overdue/.test(value)) {
      return `Schedule status: ${data.status}. ${data.overdueWeeks.length} previous weeks still have required work open. Next: ${nextAction}.`;
    }
    if (/blocker|gate|criteria|risk/.test(value)) {
      return `Completion gate: ${data.stage?.completionCriteria}. Blockers: ${(data.state?.project?.currentBlockers || []).join("; ")}.`;
    }
    return `Joy is tracking Week ${data.week?.number || "-"} of 12 by flexible periods. Current focus: ${data.currentPeriod?.title || "current workflow"}. Next: ${nextAction}.`;
  };

  updateTurtleBotCard();
  if (!hubElements.modal?.hidden) renderHub();
})();