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
    if (document.querySelector('script[data-turtlebot-plan-v3="true"]')) return;
    const script = document.createElement("script");
    script.src = "/project-data/turtlebot4/project-plan-v3-ui.js?v=turtlebot-new-plan-week3-v1";
    script.dataset.turtlebotPlanV3 = "true";
    script.defer = true;
    document.body.append(script);
  });
})();
