(() => {
  const loadVocabulary = () => {
    if (!document.querySelector('link[data-joy-vocabulary="true"]')) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "/project-data/vocabulary/vocabulary.css?v=joy-vocabulary-v1";
      stylesheet.dataset.joyVocabulary = "true";
      document.head.append(stylesheet);
    }

    if (document.querySelector('script[data-joy-vocabulary="true"]')) return;
    const script = document.createElement("script");
    script.src = "/project-data/vocabulary/vocabulary.js?v=joy-vocabulary-v1";
    script.dataset.joyVocabulary = "true";
    document.body.append(script);
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", loadVocabulary, { once: true });
  } else {
    loadVocabulary();
  }

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
    const loadTabsCleanup = () => {
      if (document.querySelector('script[data-turtlebot-tabs-cleanup="true"]')) return;
      const cleanup = document.createElement("script");
      cleanup.src = "/project-data/turtlebot4/project-hub-tabs-cleanup.js?v=turtlebot-inline-tabs-v2";
      cleanup.dataset.turtlebotTabsCleanup = "true";
      cleanup.defer = true;
      document.body.append(cleanup);
    };

    const loadReferencePlan = () => {
      const existingReference = document.querySelector('script[data-turtlebot-reference-v3="true"]');
      if (existingReference) {
        loadTabsCleanup();
        return;
      }

      const reference = document.createElement("script");
      reference.src = "/project-data/turtlebot4/project-plan-v3-reference-ui.js?v=turtlebot-reference-no-progress-v2";
      reference.dataset.turtlebotReferenceV3 = "true";
      reference.defer = true;
      reference.addEventListener("load", loadTabsCleanup, { once: true });
      document.body.append(reference);
    };

    const existingPlan = document.querySelector('script[data-turtlebot-plan-v3="true"]');
    if (existingPlan) {
      loadReferencePlan();
      return;
    }

    const script = document.createElement("script");
    script.src = "/project-data/turtlebot4/project-plan-v3-ui.js?v=turtlebot-new-plan-week3-v1";
    script.dataset.turtlebotPlanV3 = "true";
    script.defer = true;
    script.addEventListener("load", loadReferencePlan, { once: true });
    document.body.append(script);
  });
})();