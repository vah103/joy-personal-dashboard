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
    document.body.append(script);
  });
})();