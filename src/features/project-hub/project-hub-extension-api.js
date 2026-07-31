(function installProjectHubExtensionApi(root) {
  if (root.JoyProjectHub?.registerExtension) return;

  const base = Object.freeze({
    normalizeOverrides,
    projectProgress,
    updateCard: updateTurtleBotCard,
    renderHub,
    answerQuestion: answerProjectQuestion,
    effectivePlan,
  });
  let extension = null;

  function extensionContext() {
    return Object.freeze({
      state: hubState,
      elements: hubElements,
      tabIds: HUB_TABS,
      getStages,
      effectiveStage,
      currentStage,
      nextPendingItem,
      mergedCommands,
      findTurtleBotCard,
      escape: escapeHub,
      formatDate: formatHubDate,
      labelStatus,
      fetchJson: fetchHubJson,
      normalizeOverrides: (value) => normalizeOverrides(value),
      storeOverrides: storeLocalOverrides,
      scheduleSave: scheduleHubSave,
      updateStatus: updateHubStatus,
      render: renderHub,
      updateCard: updateTurtleBotCard,
      projectProgress: () => projectProgress(),
      effectivePlan: () => effectivePlan(),
      selectTab(tab) {
        if (!HUB_TABS.includes(tab)) return;
        hubState.activeTab = tab;
        renderHub();
      },
    });
  }

  function announce(type) {
    document.dispatchEvent(new CustomEvent(`joy-project-hub:${type}`, {
      detail: { extensionId: extension?.id || null },
    }));
  }

  function registerExtension(candidate) {
    if (!candidate || typeof candidate !== "object") {
      throw new TypeError("Project Hub extension must be an object");
    }
    if (extension) {
      throw new Error(`Project Hub extension ${extension.id || "unknown"} is already registered`);
    }

    extension = Object.freeze(candidate);
    extension.install?.(extensionContext());
    announce("extension-ready");
  }

  normalizeOverrides = function normalizeProjectHubOverrides(value) {
    const normalized = base.normalizeOverrides(value);
    const extended = extension?.normalizeOverrides?.(normalized, value, extensionContext());
    return extended && typeof extended === "object" ? extended : normalized;
  };

  projectProgress = function calculateProjectHubProgress() {
    const result = extension?.projectProgress?.(extensionContext());
    return Number.isFinite(result) ? Math.round(result) : base.projectProgress();
  };

  effectivePlan = function resolveProjectHubPlan() {
    const fallback = base.effectivePlan();
    const result = extension?.effectivePlan?.(extensionContext());
    return result && typeof result === "object" ? { ...fallback, ...result } : fallback;
  };

  renderHub = function renderProjectHubWithExtension() {
    if (extension?.renderTab?.(hubState.activeTab, extensionContext()) !== true) {
      base.renderHub();
    }
    announce("rendered");
  };

  updateTurtleBotCard = function updateProjectCardWithExtension() {
    if (extension?.updateCard?.(extensionContext()) !== true) {
      base.updateCard();
    }
    announce("card-updated");
  };

  answerProjectQuestion = function answerWithProjectHubExtension(question) {
    const answer = extension?.answerQuestion?.(question, extensionContext());
    return typeof answer === "string" && answer.trim()
      ? answer
      : base.answerQuestion(question);
  };

  document.addEventListener("change", (event) => {
    extension?.handleChange?.(event, extensionContext());
  });

  root.JoyProjectHub = Object.freeze({
    version: "extension-v2",
    registerExtension,
    getContext: extensionContext,
    refresh() {
      updateTurtleBotCard();
      if (!hubElements.modal?.hidden) renderHub();
    },
  });
})(window);
