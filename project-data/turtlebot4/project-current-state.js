(() => {
  const STATE_URL = "/project-data/turtlebot4/current-state.json?v=turtlebot-current-state-v3-popup-sync";
  let canonicalProgress = null;
  let canonicalState = null;
  let progressOwnerInstalled = false;

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch {
        // Proxies used to protect canonical checklist values are not structured-cloneable.
      }
    }
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

  function resolveCanonicalProgress(currentState) {
    const explicit = Number(currentState?.project?.overallProgress);
    if (Number.isFinite(explicit)) return Math.min(100, Math.max(0, Math.round(explicit)));

    const history = Array.isArray(currentState?.history) ? currentState.history : [];
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const progress = Number(history[index]?.progressAfter);
      if (Number.isFinite(progress)) return Math.min(100, Math.max(0, Math.round(progress)));
    }
    return null;
  }

  function canonicalStageNumber(currentState) {
    const match = String(currentState?.project?.currentStageId || "").match(/stage-(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function canonicalChecklistPredicate(currentState) {
    const completedIds = new Set(currentState?.roadmap?.completedChecklistIds || []);
    const completedStages = new Set(currentState?.roadmap?.completedStageIds || []);
    return (id) => {
      const value = String(id || "");
      if (completedIds.has(value)) return true;
      const match = value.match(/^s(\d+)-/);
      return Boolean(match && completedStages.has(`stage-${match[1]}`));
    };
  }

  function hasDom() {
    return typeof document !== "undefined"
      && typeof document.querySelectorAll === "function"
      && typeof document.querySelector === "function";
  }

  function findTurtleBotCard() {
    if (!hasDom()) return null;
    return [...document.querySelectorAll("#project-list .project-card")]
      .find((card) => card.querySelector(".project-top strong")
        ?.textContent.trim().toLowerCase().includes("turtlebot"));
  }

  function applyCanonicalStateToUi() {
    if (!canonicalState || !hasDom()) return;

    const project = canonicalState.project || {};
    const progress = canonicalProgress;
    const card = findTurtleBotCard();
    if (card) {
      const percentage = card.querySelector(".project-top span");
      const track = card.querySelector(".progress-track span");
      const focus = card.querySelector("dl div:first-child dd");
      const next = card.querySelector("dl div:last-child dd");
      const pill = card.querySelector(".project-stage-pill");
      if (Number.isFinite(progress) && percentage) percentage.textContent = `${progress}%`;
      if (Number.isFinite(progress) && track) track.style.width = `${progress}%`;
      if (focus && project.currentFocus) focus.textContent = project.currentFocus;
      if (next && project.nextAction) next.textContent = project.nextAction;
      if (pill) {
        const stageNumber = canonicalStageNumber(canonicalState);
        if (stageNumber) {
          const stageText = `Stage ${stageNumber} of 9`;
          pill.textContent = /Stage \d+ of \d+/i.test(pill.textContent)
            ? pill.textContent.replace(/Stage \d+ of \d+/i, stageText)
            : stageText;
        }
      }
    }

    if (Number.isFinite(progress)) {
      const overviewProgress = document.querySelector(".ps-metrics article:first-child strong");
      const roadmapProgress = document.querySelector(".hub-progress-summary strong");
      const roadmapTrack = document.querySelector(".hub-progress-summary div i");
      if (overviewProgress) overviewProgress.textContent = `${progress}%`;
      if (roadmapProgress) roadmapProgress.textContent = `${progress}%`;
      if (roadmapTrack) roadmapTrack.style.width = `${progress}%`;
    }
  }

  function installUiOwner(currentState) {
    canonicalState = clone(currentState);
    canonicalProgress = resolveCanonicalProgress(currentState);
    hubState.currentState = canonicalState;
    hubState.canonicalProgress = canonicalProgress;

    if (
      !progressOwnerInstalled
      && hasDom()
      && typeof document.addEventListener === "function"
    ) {
      document.addEventListener("joy-project-hub:card-updated", applyCanonicalStateToUi);
      document.addEventListener("joy-project-hub:rendered", applyCanonicalStateToUi);
      progressOwnerInstalled = true;
    }
    applyCanonicalStateToUi();
  }

  function applyScopePatch(target, currentState) {
    if (!target || !currentState?.scope) return target;
    target.scope = { ...(target.scope || {}), ...clone(currentState.scope) };
    return target;
  }

  function applyProjectPatch(target, currentState) {
    if (!target?.project) return target;
    target.updatedAt = currentState.updatedAt;
    Object.assign(target.project, clone(currentState.project));
    target.history = appendAllUnique(target.history, currentState.history);
    applyScopePatch(target, currentState);
    return target;
  }

  function applyRoadmapPatch(source, currentState) {
    if (!source?.roadmap?.stages) return source;
    const completedStageIds = currentState.roadmap?.completedStageIds
      || [currentState.roadmap?.completedStageId].filter(Boolean);
    const completedStages = new Set(completedStageIds);
    const activeStageId = currentState.roadmap?.activeStageId || currentState.project?.currentStageId;
    const results = currentState.roadmap?.results
      || (currentState.roadmap?.result && currentState.roadmap?.completedStageId
        ? [{ ...currentState.roadmap.result, stageId: currentState.roadmap.completedStageId }]
        : []);

    for (const stage of source.roadmap.stages) {
      if (completedStages.has(stage.id)) {
        stage.status = "completed";
        stage.checklist = (stage.checklist || []).map((item) => ({ ...item, done: true }));
        const result = results.find((entry) => entry.stageId === stage.id);
        if (result) {
          const { stageId, ...stageResult } = result;
          stage.results = appendUnique(stage.results, stageResult, "date");
        }
      } else if (stage.id === activeStageId) {
        stage.status = "in-progress";
      }
    }

    source.roadmap.updatedAt = currentState.updatedAt;
    source.roadmap.activeStageId = activeStageId;
    source.roadmap.completedStageIds = [...completedStageIds];
    source.roadmap.completedChecklistIds = [
      ...(currentState.roadmap?.completedChecklistIds || []),
    ];
    return source;
  }

  function canonicalTaskDone(task, currentState) {
    const isCanonicalChecklist = canonicalChecklistPredicate(currentState);
    return (task?.roadmapItemIds || []).some(isCanonicalChecklist);
  }

  function applyPlanPatch(plan, currentState) {
    if (!plan?.project) return plan;
    applyProjectPatch(plan, currentState);
    const completedTaskIds = new Set(currentState.plan?.completedTaskIds || []);
    const completedStages = new Set(currentState.roadmap?.completedStageIds || []);

    for (const week of plan.weeks || []) {
      const completedWeek = (week.stageIds || []).some((stageId) => completedStages.has(stageId));
      for (const day of week.days || []) {
        day.tasks = (day.tasks || []).map((task) => (
          completedWeek || completedTaskIds.has(task.id) || canonicalTaskDone(task, currentState)
            ? { ...task, done: true }
            : task
        ));
      }
    }
    return plan;
  }

  function installOverridesOwner(currentState) {
    const isCanonicalChecklist = canonicalChecklistPredicate(currentState);
    const explicitIds = currentState.roadmap?.completedChecklistIds || [];
    const protectedLists = new WeakSet();

    function protectChecklist(value) {
      const target = value && typeof value === "object" ? value : {};
      if (protectedLists.has(target)) return target;
      explicitIds.forEach((id) => { target[id] = true; });
      const proxy = new Proxy(target, {
        get(checklist, property, receiver) {
          if (typeof property === "string" && isCanonicalChecklist(property)) return true;
          return Reflect.get(checklist, property, receiver);
        },
        set(checklist, property, valueToSet) {
          checklist[property] = typeof property === "string" && isCanonicalChecklist(property)
            ? true
            : valueToSet;
          return true;
        },
        deleteProperty(checklist, property) {
          if (typeof property === "string" && isCanonicalChecklist(property)) {
            checklist[property] = true;
            return true;
          }
          return Reflect.deleteProperty(checklist, property);
        },
      });
      protectedLists.add(proxy);
      return proxy;
    }

    function patchOverrides(value) {
      const next = value && typeof value === "object" ? value : {};
      next.checklist = protectChecklist(next.checklist);
      return next;
    }

    let overrides = patchOverrides(hubState.overrides);
    Object.defineProperty(hubState, "overrides", {
      configurable: true,
      enumerable: true,
      get: () => overrides,
      set: (value) => { overrides = patchOverrides(value); },
    });
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

  function installPlanOwner(currentState) {
    let plan = applyPlanPatch(hubState.projectState, currentState);
    Object.defineProperty(hubState, "projectState", {
      configurable: true,
      enumerable: true,
      get: () => plan,
      set: (value) => { plan = applyPlanPatch(value, currentState); },
    });
  }

  function activate(currentState) {
    installOverridesOwner(currentState);
    installSourceOwner(currentState);
    installPlanOwner(currentState);
    hubState.activeStageId = currentState.roadmap?.activeStageId
      || currentState.project.currentStageId;
    installUiOwner(currentState);
    updateTurtleBotCard();
    if (!hubElements?.modal?.hidden) renderHub();
    applyCanonicalStateToUi();
  }

  fetch(STATE_URL, { credentials: "same-origin" })
    .then((response) => {
      if (!response.ok) throw new Error(`TurtleBot current state returned ${response.status}`);
      return response.json();
    })
    .then(activate)
    .catch((error) => console.error("Joy TurtleBot current state failed", error));
})();
