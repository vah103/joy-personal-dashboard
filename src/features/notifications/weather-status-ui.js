(() => {
  const notice = document.querySelector("#weather-rain-notice");
  if (!notice) return;

  const visibleStates = new Set(["rain", "sunny", "chill"]);

  function syncVisibility() {
    const shouldHide = !visibleStates.has(notice.dataset.state)
      || !String(notice.textContent || "").trim();
    if (notice.hidden !== shouldHide) notice.hidden = shouldHide;
  }

  const observer = new MutationObserver(syncVisibility);
  observer.observe(notice, {
    attributes: true,
    attributeFilter: ["hidden", "data-state"],
    childList: true,
    characterData: true,
    subtree: true,
  });

  syncVisibility();
})();
