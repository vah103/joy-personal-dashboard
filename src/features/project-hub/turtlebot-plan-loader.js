(() => {
  function loadTabsCleanup() {
    if (document.querySelector('script[data-turtlebot-tabs-cleanup="true"]')) return;
    const cleanup = document.createElement("script");
    cleanup.src = "/project-data/turtlebot4/project-hub-tabs-cleanup.js?v=turtlebot-doc-commands-v1";
    cleanup.dataset.turtlebotTabsCleanup = "true";
    cleanup.defer = true;
    document.body.append(cleanup);
  }

  function loadReferencePlan() {
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
  }

  function loadCurrentState() {
    const existingState = document.querySelector('script[data-turtlebot-current-state="true"]');
    if (existingState) {
      loadReferencePlan();
      return;
    }

    const state = document.createElement("script");
    state.src = "/project-data/turtlebot4/project-current-state.js?v=turtlebot-current-state-v2";
    state.dataset.turtlebotCurrentState = "true";
    state.defer = true;
    state.addEventListener("load", loadReferencePlan, { once: true });
    document.body.append(state);
  }

  function load() {
    const existingPlan = document.querySelector('script[data-turtlebot-plan-v3="true"]');
    if (existingPlan) {
      loadCurrentState();
      return;
    }

    const script = document.createElement("script");
    script.src = "/project-data/turtlebot4/project-plan-v3-ui.js?v=turtlebot-progress-20260729-v1";
    script.dataset.turtlebotPlanV3 = "true";
    script.defer = true;
    script.addEventListener("load", loadCurrentState, { once: true });
    document.body.append(script);
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
