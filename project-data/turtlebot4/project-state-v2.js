(() => {
  const api = window.JoyProjectHub;
  if (!api?.registerExtension) {
    throw new Error("Joy Project Hub extension API is not loaded");
  }

  const PROJECT_STATE_URL = "/project-data/turtlebot4/project-state-v2.json?v=turtlebot-progress-20260729-v1";
  const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";
  let context;

  const projectState = () => context?.state.projectState?.schemaVersion === 2
    ? context.state.projectState
    : null;

  const activeStages = () => {
    const includedIds = new Set(
      projectState()?.scope?.includedStageIds || context.getStages().map((stage) => stage.id),
    );
    return context.getStages()
      .map(context.effectiveStage)
      .filter((stage) => includedIds.has(stage.id));
  };

  const currentDate = () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: projectState()?.project?.timezone || DEFAULT_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date()).map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  };

  const formatDate = (value, includeWeekday = true) => new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULT_TIME_ZONE,
    weekday: includeWeekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+07:00`));

  const planWeeks = () => projectState()?.weeks || [];
  const planDays = () => planWeeks().flatMap((week) =>
    (week.days || []).map((day) => ({ ...day, weekNumber: week.number, weekTitle: week.title })),
  );

  const roadmapItemDone = (id) => context.getStages()
    .map(context.effectiveStage)
    .some((stage) => stage.checklist?.some((item) => item.id === id && item.done));

  const taskProgress = (task) => {
    const linkedIds = task.roadmapItemIds || [];
    if (linkedIds.length) return linkedIds.filter(roadmapItemDone).length / linkedIds.length;
    const override = context.state.overrides.planTasks?.[task.id];
    return typeof override === "boolean" ? (override ? 1 : 0) : (task.done ? 1 : 0);
  };

  const taskDone = (task) => taskProgress(task) >= 1;

  const dayProgress = (day) => {
    const tasks = day?.tasks || [];
    return tasks.length
      ? Math.round(tasks.reduce((total, task) => total + taskProgress(task), 0) / tasks.length * 100)
      : 0;
  };

  const weekProgress = (week) => {
    const tasks = (week?.days || [])
      .filter((day) => !day.optional)
      .flatMap((day) => (day.tasks || []).filter((task) => !task.optional));
    return tasks.length
      ? Math.round(tasks.reduce((total, task) => total + taskProgress(task), 0) / tasks.length * 100)
      : 0;
  };

  const calculateProjectProgress = () => {
    if (!projectState()) return null;
    const stages = activeStages();
    if (!stages.length) return null;
    const totalWeight = stages.reduce((total, stage) => total + Number(stage.weight || 1), 0);
    return totalWeight
      ? Math.round(stages.reduce((total, stage) => total + stage.progress * Number(stage.weight || 1), 0) / totalWeight)
      : 0;
  };

  const projectSnapshot = () => {
    const date = currentDate();
    const weeks = planWeeks();
    const days = planDays();
    const week = weeks.find((item) => date >= item.start && date <= item.end)
      || weeks.find((item) => date < item.start)
      || weeks.at(-1);
    const today = days.find((day) => day.date === date);
    const pendingDays = days.filter((day) => day.date >= date);
    let next = null;

    for (const day of [today, ...pendingDays.filter((item) => item !== today)].filter(Boolean)) {
      const task = (day.tasks || []).find((item) => !taskDone(item));
      if (task) {
        next = { task, day };
        break;
      }
    }

    if (!next) {
      for (const day of days) {
        const task = (day.tasks || []).find((item) => !taskDone(item));
        if (task) {
          next = { task, day };
          break;
        }
      }
    }

    const nextLab = days.find((day) =>
      day.date >= date
      && day.location === "Lab"
      && (day.tasks || []).some((task) => !taskDone(task)),
    ) || null;

    const overdue = days.flatMap((day) =>
      day.date < date && !day.optional
        ? (day.tasks || []).filter((task) => !taskDone(task)).map((task) => ({ task, day }))
        : [],
    );

    const stages = activeStages();
    const stage = stages.find((item) => item.id === projectState()?.project?.currentStageId)
      || stages.find((item) => item.progress < 100)
      || stages.at(-1);

    const start = new Date(`${projectState()?.project?.planStart}T00:00:00+07:00`).getTime();
    const end = new Date(`${projectState()?.project?.planEnd}T00:00:00+07:00`).getTime();
    const now = new Date(`${date}T00:00:00+07:00`).getTime();
    const elapsed = now <= start ? 0 : now >= end ? 100 : Math.round((now - start) / (end - start) * 100);
    const overall = calculateProjectProgress() ?? 0;
    const status = date < projectState()?.project?.planStart
      ? "Not started"
      : overdue.length
        ? "At risk"
        : date > projectState()?.project?.planEnd && overall < 100
          ? "Behind"
          : "On track";

    return {
      date,
      week,
      today,
      next,
      nextLab,
      overdue,
      stage,
      elapsed,
      status,
      overall,
      weekProgress: weekProgress(week),
    };
  };

  const projectPlan = () => {
    if (!projectState()) return null;
    const snapshot = projectSnapshot();
    return {
      title: snapshot.next?.task.label || "Review the next milestone",
      why: snapshot.stage?.completionCriteria || "",
      location: snapshot.next?.day.location || "Home",
      priority: "High",
      currentFocus: (snapshot.today?.tasks || []).find((task) => !taskDone(task))?.label
        || snapshot.next?.task.label
        || "",
      nextAction: snapshot.next?.task.label || "",
      completionCriteria: snapshot.stage?.completionCriteria || "",
    };
  };

  const renderTasks = (tasks = []) => `<div class="ps-tasks">${tasks.length
    ? tasks.map((task) => {
      const progress = taskProgress(task);
      const done = progress >= 1;
      const linked = (task.roadmapItemIds || []).length;
      return `<label class="ps-task ${done ? "done" : ""}"><input type="checkbox" data-ps-task="${context.escape(task.id)}" ${done ? "checked" : ""}><span class="ps-check">${done ? "✓" : ""}</span><span><b>${context.escape(task.label)}</b><small>${linked ? "Counts toward technical progress" : "Schedule task"}${progress > 0 && progress < 1 ? ` · ${Math.round(progress * 100)}%` : ""}</small></span></label>`;
    }).join("")
    : '<p class="hub-muted">No tasks scheduled.</p>'}</div>`;

  const renderChat = () => `<section class="hub-chat-card ps-chat"><header><div><span>Joy project assistant</span><h3>Ask about TurtleBot4</h3></div><i>✦</i></header><div class="hub-chat-suggestions">${[
    "What should I do today?",
    "What should I prepare for the next lab?",
    "Am I on schedule?",
    "How did progress reach this percentage?",
  ].map((question) => `<button type="button" data-hub-action="ask-suggestion" data-question="${context.escape(question)}">${context.escape(question)}</button>`).join("")}</div><div class="hub-chat-log" id="hub-chat-log">${context.state.chat.length
    ? context.state.chat.map((message) => `<div class="hub-chat-message ${message.role}"><span>${message.role === "joy" ? "Joy" : "Vanh"}</span><p>${context.escape(message.text)}</p></div>`).join("")
    : '<div class="hub-chat-empty"><strong>Project State v2 is active</strong><p>Joy now combines roadmap evidence, the 10-week schedule, lab days and completion gates.</p></div>'}</div><form id="hub-chat-form"><input name="question" autocomplete="off" placeholder="Ask Joy about this project..." required><button type="submit">Send</button></form></section>`;

  function renderOverview() {
    const snapshot = projectSnapshot();
    const stages = activeStages();
    const stageIndex = Math.max(0, stages.findIndex((stage) => stage.id === snapshot.stage?.id)) + 1;
    const history = projectState().history || [];

    context.elements.body.innerHTML = `<div class="ps-wrap"><section class="ps-hero"><div><span>Project State v2 · ${context.escape(formatDate(snapshot.date))}</span><h3>${context.escape(snapshot.week ? `Week ${snapshot.week.number}: ${snapshot.week.title}` : "TurtleBot4")}</h3><p>${context.escape(snapshot.week?.objective || snapshot.stage?.objective || "")}</p></div><b class="ps-status ${snapshot.status.toLowerCase().replaceAll(" ", "-")}">${context.escape(snapshot.status)}</b></section><section class="ps-metrics"><article><span>Overall completion</span><strong>${snapshot.overall}%</strong><small>Active 10-week scope</small></article><article><span>Current week</span><strong>${snapshot.week?.number || "-"}/10</strong><small>${snapshot.weekProgress}% weekly tasks</small></article><article><span>Technical stage</span><strong>${stageIndex}/${stages.length}</strong><small>${context.escape(snapshot.stage?.shortName || snapshot.stage?.name || "")}</small></article><article><span>Timeline elapsed</span><strong>${snapshot.elapsed}%</strong><small>Time does not add progress</small></article></section><div class="ps-grid"><section class="ps-panel"><div class="ps-title"><div><span>Today</span><h3>${context.escape(snapshot.today ? `${snapshot.today.label} · ${snapshot.today.location}` : "Next planned action")}</h3></div><small>${context.escape(formatDate(snapshot.date, false))}</small></div>${renderTasks(snapshot.today?.tasks || [snapshot.next?.task].filter(Boolean))}<div class="ps-actions"><button class="hub-primary-button" data-hub-action="add-plan-to-todo">Add next action to To-do</button><a href="${context.escape(projectState().project.googleDocUrl)}" target="_blank" rel="noreferrer">Open Google Docs plan ↗</a></div></section><section class="ps-panel"><div class="ps-title"><div><span>Next robot session</span><h3>${context.escape(snapshot.nextLab ? formatDate(snapshot.nextLab.date) : "No lab session pending")}</h3></div><small>${context.escape(snapshot.nextLab?.location || "")}</small></div>${renderTasks((snapshot.nextLab?.tasks || []).filter((task) => !taskDone(task)))}</section><section class="ps-panel"><div class="ps-title"><div><span>Current completion gate</span><h3>${context.escape(snapshot.stage?.name || "Current stage")}</h3></div></div><p>${context.escape(snapshot.stage?.completionCriteria || "")}</p><ul>${(projectState().project.currentBlockers || []).map((blocker) => `<li>${context.escape(blocker)}</li>`).join("")}</ul></section><section class="ps-panel"><div class="ps-title"><div><span>Scope control</span><h3>Accelerated core thesis</h3></div></div><p>${context.escape(projectState().scope.excludedReason)}</p><p><b>${projectState().scope.objectClassLimit}</b> object classes · <b>${projectState().scope.environmentLimit}</b> experiment environment · Saturday only as buffer.</p></section></div><section class="ps-history"><div class="ps-title"><div><span>Progress history</span><h3>From 0% to today</h3></div><small>Evidence-backed only</small></div><div class="ps-timeline">${history.map((entry) => `<article><div><small>${context.escape(formatDate(entry.date, false))}</small><b>${context.escape(entry.title)}</b><p>${context.escape(entry.detail)}</p></div><em>${entry.progressAfter}%</em></article>`).join("")}</div></section>${renderChat()}</div>`;
  }

  function renderSchedule() {
    const snapshot = projectSnapshot();
    context.elements.body.innerHTML = `<div class="ps-schedule"><header><div><span>10-week execution plan</span><h3>27 Jul - 4 Oct 2026</h3><p>Home preparation Monday-Tuesday, robot work Wednesday-Thursday, Saturday only as a controlled buffer.</p></div><a href="${context.escape(projectState().project.googleDocUrl)}" target="_blank" rel="noreferrer">Open source plan ↗</a></header><div class="ps-weeks">${planWeeks().map((week) => {
      const progress = weekProgress(week);
      const current = week.number === snapshot.week?.number;
      return `<details class="ps-week ${current ? "current" : ""}" ${current ? "open" : ""}><summary><span class="ps-num">${week.number}</span><span><b>${context.escape(week.title)}</b><small>${context.escape(formatDate(week.start, false))} - ${context.escape(formatDate(week.end, false))}</small></span><span class="ps-bar">${progress}%<i><em style="width:${progress}%"></em></i></span></summary><div class="ps-week-body"><p>${context.escape(week.objective)} <b>Deliverable:</b> ${context.escape(week.deliverable)}</p><div class="ps-days">${(week.days || []).map((day) => `<article class="ps-day ${day.date === snapshot.date ? "today" : ""} ${day.optional ? "optional" : ""}"><header><b>${context.escape(day.label)} · ${context.escape(formatDate(day.date, false))}</b><span>${context.escape(day.location)} · ${dayProgress(day)}%</span></header>${renderTasks(day.tasks || [])}</article>`).join("")}</div></div></details>`;
    }).join("")}</div></div>`;
  }

  function updateCard() {
    if (!projectState() || !context.state.source) return false;

    const card = context.findTurtleBotCard();
    if (!card) return true;
    const snapshot = projectSnapshot();
    const stages = activeStages();
    const stageIndex = Math.max(0, stages.findIndex((stage) => stage.id === snapshot.stage?.id)) + 1;

    const percentage = card.querySelector(".project-top span");
    const track = card.querySelector(".progress-track span");
    if (percentage) percentage.textContent = `${snapshot.overall}%`;
    if (track) track.style.width = `${snapshot.overall}%`;

    const details = card.querySelectorAll("dl dd");
    if (details[0]) {
      details[0].textContent = (snapshot.today?.tasks || []).find((task) => !taskDone(task))?.label
        || snapshot.next?.task.label
        || snapshot.stage?.objective
        || "";
    }
    if (details[1]) details[1].textContent = snapshot.next?.task.label || "Review the next completion gate";

    const pill = card.querySelector(".project-stage-pill");
    if (pill) pill.textContent = `Week ${snapshot.week?.number || "-"} of 10 · Stage ${stageIndex} of ${stages.length}`;

    let source = card.querySelector(".project-git-source");
    if (!source) {
      source = document.createElement("span");
      source.className = "project-git-source";
      card.append(source);
    }
    source.textContent = `Project State v2 · ${snapshot.status} · ${context.state.sourceMode === "github" ? "GitHub live" : "Snapshot"}`;
    return true;
  }

  function answerQuestion(question) {
    if (!projectState()) return null;
    const value = String(question || "").toLowerCase();
    const snapshot = projectSnapshot();
    const nextAction = snapshot.next?.task.label || "No pending task";
    const stage = `${snapshot.stage?.name || "Stage"} (${snapshot.stage?.progress || 0}%)`;

    if (/today|what should i do|next action/.test(value)) {
      const tasks = (snapshot.today?.tasks || []).filter((task) => !taskDone(task));
      return `Today is ${formatDate(snapshot.date)}. You are in Week ${snapshot.week?.number || "-"}, ${stage}. Focus on: ${(tasks.length ? tasks : [snapshot.next?.task].filter(Boolean)).map((task) => task.label).join("; ")}.`;
    }
    if (/lab|prepare/.test(value)) {
      const tasks = (snapshot.nextLab?.tasks || []).filter((task) => !taskDone(task)).map((task) => task.label).join("; ");
      return `Next lab: ${snapshot.nextLab ? formatDate(snapshot.nextLab.date) : "none pending"}. ${tasks || nextAction}`;
    }
    if (/progress|percent|completion/.test(value)) {
      return `Completion is ${snapshot.overall}% for the active 10-week scope; ${stage}; Week ${snapshot.week?.number || "-"} is ${snapshot.weekProgress}%. Timeline elapsed is ${snapshot.elapsed}% but never adds completion.`;
    }
    if (/schedule|track|late|behind|overdue/.test(value)) {
      return `Schedule: ${snapshot.status}. ${snapshot.overdue.length} overdue tasks. Next: ${nextAction}.`;
    }
    if (/blocker|gate|criteria|risk/.test(value)) {
      return `Completion gate: ${snapshot.stage?.completionCriteria}. Blockers: ${(projectState().project.currentBlockers || []).join("; ")}.`;
    }
    return `Joy is tracking ${snapshot.overall}%, Week ${snapshot.week?.number || "-"} (${snapshot.weekProgress}%), ${stage}, status ${snapshot.status}. Next: ${nextAction}.`;
  }

  const taskById = (id) => {
    for (const week of planWeeks()) {
      for (const day of week.days || []) {
        const task = (day.tasks || []).find((item) => item.id === id);
        if (task) return task;
      }
    }
    return null;
  };

  function handleChange(event) {
    const input = event.target.closest?.("[data-ps-task]");
    if (!input) return false;
    const task = taskById(input.dataset.psTask);
    if (!task) return false;

    context.state.overrides.planTasks ||= {};
    const linkedIds = task.roadmapItemIds || [];
    if (linkedIds.length) {
      delete context.state.overrides.planTasks[task.id];
      linkedIds.forEach((id) => {
        context.state.overrides.checklist[id] = input.checked;
      });
    } else {
      context.state.overrides.planTasks[task.id] = input.checked;
    }

    context.scheduleSave();
    context.updateCard();
    context.render();
    return true;
  }

  function installStyles() {
    if (document.querySelector("#joy-project-state-v2-styles")) return;
    const style = document.createElement("style");
    style.id = "joy-project-state-v2-styles";
    style.textContent = `
      .ps-wrap{padding:22px;display:grid;gap:14px}.ps-hero,.ps-panel,.ps-history,.ps-week{border:1px solid #d6dee2;border-radius:16px;background:#fff}.ps-hero{display:flex;justify-content:space-between;gap:18px;padding:20px;background:radial-gradient(circle at 88% 0%,rgba(132,166,183,.18),transparent 34%),#fff}.ps-hero span,.ps-title span,.ps-schedule>header span{color:#73828a;font-size:.68rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.ps-hero h3,.ps-title h3,.ps-schedule>header h3{margin:4px 0 0;color:#29363d}.ps-hero p,.ps-schedule>header p{margin:7px 0 0;color:#617079;font-size:.78rem;line-height:1.5}.ps-status{height:fit-content;padding:7px 10px;border-radius:999px;background:#eaf1f4;color:#4a6572;font-size:.7rem;font-weight:800}.ps-status.at-risk,.ps-status.behind{background:#fbf2da;color:#7c6021}.ps-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.ps-metrics article{padding:14px;border:1px solid #d7dfe3;border-radius:13px;background:#fff}.ps-metrics span,.ps-metrics strong,.ps-metrics small{display:block}.ps-metrics span{color:#7a878e;font-size:.66rem}.ps-metrics strong{margin-top:4px;color:#2e3e46;font-size:1.35rem}.ps-metrics small{margin-top:3px;color:#7a878e;font-size:.65rem}.ps-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ps-panel,.ps-history{padding:17px}.ps-title{display:flex;justify-content:space-between;gap:12px}.ps-title h3{font-size:1rem}.ps-title small{color:#829097;font-size:.67rem}.ps-tasks{display:grid;gap:7px;margin-top:12px}.ps-task{display:grid;grid-template-columns:19px 1fr;gap:8px;padding:9px 10px;border:1px solid #e0e5e7;border-radius:10px;background:#f8fafb;cursor:pointer}.ps-task input{position:absolute;opacity:0}.ps-check{width:18px;height:18px;display:grid;place-items:center;border:1px solid #bfcbd1;border-radius:6px;background:#fff;font-size:.65rem}.ps-task b,.ps-task small{display:block}.ps-task b{color:#46565e;font-size:.74rem;line-height:1.4}.ps-task small{margin-top:2px;color:#87949a;font-size:.61rem}.ps-task.done{background:#eef4f2}.ps-task.done b{text-decoration:line-through;color:#6f7e78}.ps-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.ps-actions a,.ps-schedule>header a{display:inline-flex;align-items:center;min-height:35px;padding:0 11px;border:1px solid #d1dade;border-radius:9px;color:#556972;font-size:.7rem;font-weight:700;text-decoration:none}.ps-panel>p{color:#5e6e76;font-size:.75rem;line-height:1.5}.ps-panel ul{padding-left:18px;color:#6d624f;font-size:.71rem;line-height:1.5}.ps-timeline{display:grid;margin-top:12px}.ps-timeline article{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 0;border-bottom:1px solid #e6eaec}.ps-timeline small,.ps-timeline b,.ps-timeline p{display:block;margin:0}.ps-timeline small{color:#829097;font-size:.62rem}.ps-timeline b{color:#40525a;font-size:.75rem}.ps-timeline p{margin-top:3px;color:#718087;font-size:.68rem}.ps-timeline em{padding:4px 7px;border-radius:7px;background:#eef3f5;color:#506873;font-size:.68rem;font-style:normal;font-weight:800}.ps-chat{min-height:480px}.ps-schedule{padding:22px;display:grid;gap:12px}.ps-schedule>header{display:flex;justify-content:space-between;gap:18px;padding:19px;border:1px solid #d6dee2;border-radius:16px;background:#fff}.ps-weeks{display:grid;gap:9px}.ps-week{overflow:hidden}.ps-week>summary{display:grid;grid-template-columns:35px 1fr 120px;gap:10px;align-items:center;padding:13px 15px;list-style:none;cursor:pointer}.ps-week>summary::-webkit-details-marker{display:none}.ps-num{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#eaf0f2;color:#526b76;font-size:.75rem;font-weight:900}.ps-week.current .ps-num{background:#31434c;color:#fff}.ps-week summary b,.ps-week summary small{display:block}.ps-week summary b{color:#405159;font-size:.79rem}.ps-week summary small{margin-top:2px;color:#829097;font-size:.64rem}.ps-bar{text-align:right;color:#526a75;font-size:.68rem}.ps-bar i{display:block;height:5px;margin-top:4px;border-radius:99px;background:#e2e8eb;overflow:hidden}.ps-bar em{display:block;height:100%;background:#6e8995}.ps-week-body{padding:14px;border-top:1px solid #e2e7e9}.ps-week-body>p{color:#607078;font-size:.73rem}.ps-days{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ps-day{padding:10px;border:1px solid #e0e5e7;border-radius:10px;background:#fafbfc}.ps-day.today{border-color:#9bb1bb;background:#f2f6f7}.ps-day.optional{border-style:dashed}.ps-day>header{display:flex;justify-content:space-between;gap:8px;color:#70828a;font-size:.63rem;font-weight:700}.ps-day>header b{color:#42545c}.ps-day .ps-tasks{margin-top:8px}.ps-day .ps-task{padding:8px}.ps-day .ps-task b{font-size:.7rem}
      @media(max-width:900px){.ps-metrics{grid-template-columns:1fr 1fr}.ps-grid,.ps-days{grid-template-columns:1fr}}@media(max-width:600px){.ps-wrap,.ps-schedule{padding:13px}.ps-hero,.ps-schedule>header,.ps-title{flex-direction:column}.ps-metrics{grid-template-columns:1fr 1fr}.ps-week>summary{grid-template-columns:32px 1fr}.ps-bar{grid-column:1/-1}.ps-grid{grid-template-columns:1fr}}@media(max-width:420px){.ps-metrics{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  function installTabs() {
    const originalPlanButton = context.elements.tabs
      .find((button) => button.dataset.hubTab === "plan");
    if (!originalPlanButton || document.querySelector("[data-ps-overview]")) return;

    originalPlanButton.dataset.hubTab = "schedule";
    originalPlanButton.textContent = "10-Week Plan";
    if (!context.tabIds.includes("schedule")) context.tabIds.push("schedule");

    const overviewButton = document.createElement("button");
    overviewButton.type = "button";
    overviewButton.dataset.hubTab = "plan";
    overviewButton.dataset.psOverview = "1";
    overviewButton.textContent = "Overview";
    overviewButton.setAttribute("aria-selected", "false");
    originalPlanButton.parentElement.insertBefore(
      overviewButton,
      originalPlanButton.parentElement.firstElementChild,
    );
    context.elements.tabs.unshift(overviewButton);
    overviewButton.addEventListener("click", () => context.selectTab("plan"));
  }

  function install(nextContext) {
    context = nextContext;
    context.state.projectState = null;
    context.state.overrides = context.normalizeOverrides(context.state.overrides);
    context.storeOverrides();
    installStyles();
    installTabs();

    context.fetchJson(PROJECT_STATE_URL)
      .then((data) => {
        if (data?.schemaVersion !== 2) throw new Error("Unsupported Project State schema");
        context.state.projectState = data;
        context.state.activeTab = "plan";
        context.updateCard();
        if (!context.elements.modal?.hidden) context.render();
      })
      .catch((error) => {
        context.state.saveStatus = "Project State unavailable";
        context.state.projectStateError = error.message;
        context.updateStatus();
      });
  }

  api.registerExtension(Object.freeze({
    id: "turtlebot-project-state-v2",
    install,
    normalizeOverrides(normalized, value) {
      return {
        ...normalized,
        planTasks: value?.planTasks && typeof value.planTasks === "object"
          ? value.planTasks
          : {},
      };
    },
    projectProgress: calculateProjectProgress,
    effectivePlan: projectPlan,
    renderTab(tab) {
      if (!projectState()) return false;
      if (tab === "plan") {
        renderOverview();
        return true;
      }
      if (tab === "schedule") {
        renderSchedule();
        return true;
      }
      return false;
    },
    updateCard,
    answerQuestion,
    handleChange,
  }));
})();
