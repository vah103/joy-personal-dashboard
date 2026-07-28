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
    const loadReferencePlan = () => {
      if (document.querySelector('script[data-turtlebot-reference-v3="true"]')) return;
      const reference = document.createElement("script");
      reference.src = "/project-data/turtlebot4/project-plan-v3-reference-ui.js?v=turtlebot-read-only-plan-v1";
      reference.dataset.turtlebotReferenceV3 = "true";
      reference.defer = true;
      document.body.append(reference);
    };

    const loadFlexiblePeriods = () => {
      const existingPeriods = document.querySelector('script[data-turtlebot-periods-v3="true"]');
      if (existingPeriods) {
        loadReferencePlan();
        return;
      }
      const periods = document.createElement("script");
      periods.src = "/project-data/turtlebot4/project-plan-v3-periods-ui.js?v=turtlebot-flexible-periods-nunito-v1";
      periods.dataset.turtlebotPeriodsV3 = "true";
      periods.defer = true;
      periods.addEventListener("load", loadReferencePlan, { once: true });
      document.body.append(periods);
    };

    const existingPlan = document.querySelector('script[data-turtlebot-plan-v3="true"]');
    if (existingPlan) {
      loadFlexiblePeriods();
      return;
    }

    const script = document.createElement("script");
    script.src = "/project-data/turtlebot4/project-plan-v3-ui.js?v=turtlebot-new-plan-week3-v1";
    script.dataset.turtlebotPlanV3 = "true";
    script.defer = true;
    script.addEventListener("load", loadFlexiblePeriods, { once: true });
    document.body.append(script);
  });
})();