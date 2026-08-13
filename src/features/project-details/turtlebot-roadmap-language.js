(() => {
  const ROADMAP_ROOT_SELECTOR = "#turtlebot-hub-modal .hub-roadmap-layout";

  function i18n() {
    return window.JoyI18n || null;
  }

  function tr(key, values, fallback) {
    return i18n()?.t?.(key, values) || fallback;
  }

  function syncRoadmapLanguage() {
    const locale = i18n()?.getLocale?.() || "en";
    const modal = document.querySelector("#turtlebot-hub-modal");
    const roadmap = document.querySelector(ROADMAP_ROOT_SELECTOR);
    if (modal) modal.setAttribute("lang", locale);
    if (roadmap) roadmap.setAttribute("lang", locale);
    i18n()?.translateRoot?.(modal || roadmap || document.body);
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
    if (!value) return tr("common.noDate", {}, "No date scheduled");
    const date = new Date(`${value}T00:00:00+07:00`);
    if (i18n()?.formatDate) {
      return i18n().formatDate(date, {
        timeZone: "Asia/Ho_Chi_Minh",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  answerProjectQuestion = (question) => {
    const value = String(question || "").trim().toLowerCase();
    const { stage, progress, pending } = stageSummary();
    const plan = typeof effectivePlan === "function" ? effectivePlan() : {};
    const stageName = stage?.name || tr("turtlebot.currentStage", {}, "Current stage");
    const stageProgress = stage?.progress ?? 0;
    const nextAction = pending?.label || plan.nextAction || plan.title || tr("turtlebot.reviewGate", {}, "Review the next completion gate");
    const stageNumber = stage?.number || "-";

    if (/(today|next|what should i do|focus|hôm nay|tiếp theo|làm gì|trọng tâm)/i.test(value)) {
      return tr("turtlebot.currentFocus", {
        stage: stageNumber,
        name: stageName,
        progress: stageProgress,
        next: nextAction,
      }, `Current focus: Stage ${stageNumber}, ${stageName} (${stageProgress}%). Next action: ${nextAction}.`);
    }

    if (/(lab|prepare|robot session|chuẩn bị|buổi robot)/i.test(value)) {
      const lab = nextLabSession();
      const tasks = (lab?.tasks || []).filter((task) => !scheduleTaskDone(task)).map((task) => task.label);
      return lab
        ? tr("turtlebot.nextLab", {
            date: formatDate(lab.date),
            tasks: tasks.join("; ") || nextAction,
          }, `Next lab session: ${formatDate(lab.date)}. Prepare for: ${tasks.join("; ") || nextAction}.`)
        : tr("turtlebot.noLab", { next: nextAction }, `No pending lab session was found. Continue with: ${nextAction}.`);
    }

    if (/(progress|percent|completion|roadmap|tiến độ|hoàn thành)/i.test(value)) {
      return tr("turtlebot.progress", {
        overall: progress,
        stage: stageNumber,
        name: stageName,
        progress: stageProgress,
      }, `Overall completion is ${progress}%. Stage ${stageNumber}, ${stageName}, is ${stageProgress}% complete. Progress is calculated from completed roadmap checklist items.`);
    }

    if (/(schedule|track|late|behind|overdue|lịch|chậm|trễ)/i.test(value)) {
      const upcoming = scheduledDays().filter((day) => (day.tasks || []).some((task) => !scheduleTaskDone(task)));
      return tr("turtlebot.schedule", { count: upcoming.length, next: nextAction }, `The plan has ${upcoming.length} scheduled days with unfinished work. The next priority is: ${nextAction}.`);
    }

    if (/(blocker|gate|criteria|risk|vướng|tiêu chí|rủi ro)/i.test(value)) {
      const blockers = hubState?.projectState?.project?.currentBlockers || [];
      const gate = stage?.completionCriteria || plan.completionCriteria || tr("turtlebot.reviewCriteria", {}, "Review the stage criteria.");
      const blockerText = blockers.join("; ") || tr("turtlebot.noBlocker", {}, "No blocker is recorded.");
      return tr("turtlebot.gate", { gate, blockers: blockerText }, `Completion gate: ${gate} Blockers: ${blockerText}`);
    }

    return tr("turtlebot.tracking", {
      overall: progress,
      stage: stageNumber,
      name: stageName,
      progress: stageProgress,
      next: nextAction,
    }, `Joy is tracking ${progress}% overall completion. The project is at Stage ${stageNumber}, ${stageName} (${stageProgress}%). Next action: ${nextAction}.`);
  };

  const observer = new MutationObserver(syncRoadmapLanguage);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("joy:i18n-ready", syncRoadmapLanguage);
  window.addEventListener("joy:locale-changed", syncRoadmapLanguage);
  syncRoadmapLanguage();
})();
