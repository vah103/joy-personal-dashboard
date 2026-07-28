(() => {
  const ROADMAP_ROOT_SELECTOR = "#turtlebot-hub-modal .hub-roadmap-layout";

  function markRoadmapAsEnglish() {
    const modal = document.querySelector("#turtlebot-hub-modal");
    const roadmap = document.querySelector(ROADMAP_ROOT_SELECTOR);
    if (modal) modal.setAttribute("lang", "en");
    if (roadmap) roadmap.setAttribute("lang", "en");
  }

  function stageSummary() {
    const stage = typeof currentStage === "function" ? currentStage() : null;
    const progress = typeof projectProgress === "function" ? projectProgress() : 0;
    const pending = typeof nextPendingItem === "function" ? nextPendingItem(stage) : null;
    return { stage, progress, pending };
  }

  function scheduledDays() {
    const weeks = hubState?.projectState?.weeks;
    if (!Array.isArray(weeks)) return [];
    return weeks.flatMap((week) => (week.days || []).map((day) => ({ ...day, week })));
  }

  function scheduleTaskDone(task) {
    const linkedIds = task?.roadmapItemIds || [];
    if (linkedIds.length) {
      const completedIds = new Set(
        (typeof getStages === "function" ? getStages() : [])
          .map((stage) => (typeof effectiveStage === "function" ? effectiveStage(stage) : stage))
          .flatMap((stage) => stage.checklist || [])
          .filter((item) => item.done)
          .map((item) => item.id),
      );
      return linkedIds.every((id) => completedIds.has(id));
    }
    const override = hubState?.overrides?.planTasks?.[task?.id];
    return typeof override === "boolean" ? override : Boolean(task?.done);
  }

  function nextLabSession() {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return scheduledDays().find((day) =>
      day.date >= today
      && String(day.location || "").includes("Lab")
      && (day.tasks || []).some((task) => !scheduleTaskDone(task)),
    ) || null;
  }

  function formatDate(value) {
    if (!value) return "No date scheduled";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00+07:00`));
  }

  answerProjectQuestion = (question) => {
    const value = String(question || "").trim().toLowerCase();
    const { stage, progress, pending } = stageSummary();
    const plan = typeof effectivePlan === "function" ? effectivePlan() : {};
    const stageName = stage?.name || "Current stage";
    const stageProgress = stage?.progress ?? 0;
    const nextAction = pending?.label || plan.nextAction || plan.title || "Review the next completion gate";

    if (/(today|next|what should i do|focus)/.test(value)) {
      return `Current focus: Stage ${stage?.number || "-"}, ${stageName} (${stageProgress}%). Next action: ${nextAction}.`;
    }

    if (/(lab|prepare|robot session)/.test(value)) {
      const lab = nextLabSession();
      const tasks = (lab?.tasks || []).filter((task) => !scheduleTaskDone(task)).map((task) => task.label);
      return lab
        ? `Next lab session: ${formatDate(lab.date)}. Prepare for: ${tasks.join("; ") || nextAction}.`
        : `No pending lab session was found. Continue with: ${nextAction}.`;
    }

    if (/(progress|percent|completion|roadmap)/.test(value)) {
      return `Overall completion is ${progress}%. Stage ${stage?.number || "-"}, ${stageName}, is ${stageProgress}% complete. Progress is calculated from completed roadmap checklist items.`;
    }

    if (/(schedule|track|late|behind|overdue)/.test(value)) {
      const upcoming = scheduledDays().filter((day) => (day.tasks || []).some((task) => !scheduleTaskDone(task)));
      return `The plan has ${upcoming.length} scheduled days with unfinished work. The next priority is: ${nextAction}.`;
    }

    if (/(blocker|gate|criteria|risk)/.test(value)) {
      const blockers = hubState?.projectState?.project?.currentBlockers || [];
      return `Completion gate: ${stage?.completionCriteria || plan.completionCriteria || "Review the stage criteria."} Blockers: ${blockers.join("; ") || "No blocker is recorded."}`;
    }

    return `Joy is tracking ${progress}% overall completion. The project is at Stage ${stage?.number || "-"}, ${stageName} (${stageProgress}%). Next action: ${nextAction}.`;
  };

  const observer = new MutationObserver(markRoadmapAsEnglish);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  markRoadmapAsEnglish();
})();
