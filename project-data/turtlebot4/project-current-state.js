(() => {
  const STATE_URL = "/project-data/turtlebot4/current-state.json?v=turtlebot-current-state-v2";

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function appendUnique(items, entry, key = "title") {
    const list = Array.isArray(items) ? items : [];
    if (entry && !list.some((item) => item?.[key] === entry[key])) list.push(clone(entry));
    return list;
  }

  function appendAllUnique(items, entries, key = "title") {
    return (Array.isArray(entries) ? entries : [entries])
      .filter(Boolean)
      .reduce((list, entry) => appendUnique(list, entry, key), items);
  }

  function applyProjectPatch(target, currentState) {
    if (!target?.project) return target;
    target.updatedAt = currentState.updatedAt;
    Object.assign(target.project, clone(currentState.project));
    target.history = appendAllUnique(target.history, currentState.history);
    return target;
  }

  function applyRoadmapPatch(source, currentState) {
    if (!source?.roadmap?.stages) return source;
    const completedIds = new Set(currentState.roadmap?.completedChecklistIds || []);
    const completedStageIds = currentState.roadmap?.completedStageIds
      || [currentState.roadmap?.completedStageId].filter(Boolean);
    const results = currentState.roadmap?.results
      || (currentState.roadmap?.result && currentState.roadmap?.completedStageId
        ? [{ ...currentState.roadmap.result, stageId: currentState.roadmap.completedStageId }]
        : []);

    for (const completedStageId of completedStageIds) {
      const completedStage = source.roadmap.stages.find((stage) => stage.id === completedStageId);
      if (!completedStage) continue;
      completedStage.status = "completed";
      completedStage.checklist = (completedStage.checklist || []).map((item) => (
        completedIds.has(item.id) ? { ...item, done: true } : item
      ));
      const result = results.find((entry) => entry.stageId === completedStageId);
      if (result) {
        const { stageId, ...stageResult } = result;
        completedStage.results = appendUnique(completedStage.results, stageResult, "date");
      }
    }

    const activeStage = source.roadmap.stages.find(
      (stage) => stage.id === currentState.roadmap?.activeStageId,
    );
    if (activeStage && activeStage.status === "not-started") activeStage.status = "in-progress";
    source.roadmap.updatedAt = currentState.updatedAt;
    return source;
  }

  function applyPlanPatch(plan, currentState) {
    if (!plan?.project) return plan;
    const next = applyProjectPatch(clone(plan), currentState);
    const completedTaskIds = new Set(currentState.plan?.completedTaskIds || []);
    for (const week of next.weeks || []) {
      for (const day of week.days || []) {
        day.tasks = (day.tasks || []).map((task) => (
          completedTaskIds.has(task.id) ? { ...task, done: true } : task
        ));
      }
    }
    return next;
  }

  function installSourceOwner(currentState) {
    let source = applyRoadmapPatch(
      applyProjectPatch(clone(hubState.source), currentState),
      currentState,
    );

    Object.defineProperty(hubState, "source", {
      configurable: true,
      enumerable: true,
      get: () => source,
      set: (value) => {
        source = applyRoadmapPatch(
          applyProjectPatch(clone(value), currentState),
          currentState,
        );
      },
    });
  }

  function activate(currentState) {
    installSourceOwner(currentState);
    if (hubState.projectState?.project) {
      hubState.projectState = applyPlanPatch(hubState.projectState, currentState);
    }
    hubState.activeStageId = currentState.project.currentStageId;
    updateTurtleBotCard();
    if (!hubElements?.modal?.hidden) renderHub();
  }

  fetch(STATE_URL, { credentials: "same-origin" })
    .then((response) => {
      if (!response.ok) throw new Error(`TurtleBot current state returned ${response.status}`);
      return response.json();
    })
    .then(activate)
    .catch((error) => console.error("Joy TurtleBot current state failed", error));
})();
