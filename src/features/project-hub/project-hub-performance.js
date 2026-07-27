(() => {
  const nativeObserve = window.MutationObserver?.prototype?.observe;
  if (!nativeObserve || nativeObserve.__joyProjectHubGuard) return;

  function observeWithoutProjectFeedback(target, options = {}) {
    if (target instanceof Element && target.id === "project-list") {
      return nativeObserve.call(this, target, {
        ...options,
        attributes: false,
        characterData: false,
        subtree: false,
        childList: true,
      });
    }
    return nativeObserve.call(this, target, options);
  }

  observeWithoutProjectFeedback.__joyProjectHubGuard = true;
  window.MutationObserver.prototype.observe = observeWithoutProjectFeedback;

  window.addEventListener("pageshow", () => {
    const modal = document.querySelector("#turtlebot-hub-modal");
    if (!modal || modal.hidden) document.body.classList.remove("hub-modal-open");
  });

  window.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector('script[data-turtlebot-project-state-v2="true"]')) return;
    const script = document.createElement("script");
    script.src = "/project-data/turtlebot4/project-state-v2.js?v=turtlebot-project-state-v2";
    script.dataset.turtlebotProjectStateV2 = "true";
    script.async = false;

    const syncCurrentStage = () => {
      if (!window.hubState?.projectState || typeof getStages !== "function" || typeof effectiveStage !== "function") return;
      const included = new Set(hubState.projectState.scope?.includedStageIds || []);
      const stages = getStages().map(effectiveStage).filter((stage) => !included.size || included.has(stage.id));
      if (!stages.length) return;
      const configuredId = hubState.projectState.project?.currentStageId;
      const configuredIndex = Math.max(0, stages.findIndex((stage) => stage.id === configuredId));
      const next = stages.slice(configuredIndex).find((stage) => stage.progress < 100)
        || stages.find((stage) => stage.progress < 100)
        || stages.at(-1);
      if (next?.id) hubState.projectState.project.currentStageId = next.id;
    };

    script.addEventListener("load", () => {
      const apply = () => {
        syncCurrentStage();
        if (typeof updateTurtleBotCard === "function") updateTurtleBotCard();
        if (typeof renderHub === "function" && !document.querySelector("#turtlebot-hub-modal")?.hidden) renderHub();
      };
      setTimeout(apply, 0);
      document.addEventListener("change", () => setTimeout(apply, 0));
    });

    document.body.append(script);
  });
})();