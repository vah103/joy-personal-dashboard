(() => {
  const api = window.JoyProjectHub;
  if (!api?.getContext) return;

  let scheduled = false;
  let reconciling = false;

  function reconcile() {
    scheduled = false;
    if (reconciling) return;
    reconciling = true;

    try {
      const context = api.getContext();
      const body = context.elements?.body;
      const overview = body?.querySelector(".rp-overview");
      if (!overview) return;

      // Stage C originally targeted the legacy .ps-wrap overview. Reuse the
      // canonical Joy Core renderer without changing the 12-week reference UI.
      overview.classList.add("ps-wrap");

      if (context.state?.joyCoreProject?.project
        && !overview.querySelector("[data-joy-core-panel]")) {
        document.dispatchEvent(new CustomEvent("joy-project-hub:rendered"));
      }

      const panel = overview.querySelector("[data-joy-core-panel]");
      const infoGrid = overview.querySelector(".rp-info-grid");
      if (panel && infoGrid && panel.previousElementSibling !== infoGrid) {
        infoGrid.insertAdjacentElement("afterend", panel);
      }
    } finally {
      reconciling = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(reconcile);
  }

  const body = api.getContext().elements?.body;
  if (body) {
    new MutationObserver(schedule).observe(body, {
      childList: true,
      subtree: true,
    });
  }

  document.addEventListener("joy-project-hub:rendered", schedule);
  document.addEventListener("joy-project-hub:card-updated", schedule);
  document.addEventListener("joy-project-hub:extension-ready", schedule);

  schedule();
})();
