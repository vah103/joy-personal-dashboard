(() => {
  const previousRenderHub = renderHub;

  function removeJournalTab() {
    const journalButton = document.querySelector('#turtlebot-hub-modal [data-hub-tab="journal"]');
    if (journalButton) journalButton.remove();

    const journalTabIndex = HUB_TABS.indexOf("journal");
    if (journalTabIndex >= 0) HUB_TABS.splice(journalTabIndex, 1);

    for (let index = hubElements.tabs.length - 1; index >= 0; index -= 1) {
      if (hubElements.tabs[index]?.dataset?.hubTab === "journal") {
        hubElements.tabs.splice(index, 1);
      }
    }

    if (hubState.activeTab === "journal") hubState.activeTab = "plan";
  }

  function arrangeTabs() {
    const nav = document.querySelector("#turtlebot-hub-modal .turtlebot-hub-tabs");
    if (!nav) return;

    removeJournalTab();

    const order = ["plan", "roadmap", "schedule", "commands"];
    const labels = {
      plan: "Overview",
      roadmap: "Roadmap",
      schedule: "12-Week Plan",
      commands: "Commands",
    };

    order.forEach((tabName) => {
      const button = nav.querySelector(`[data-hub-tab="${tabName}"]`);
      if (!button) return;
      button.textContent = labels[tabName];
      nav.append(button);
    });
  }

  function renderEmptyCommands() {
    hubElements.body.innerHTML = "";
  }

  renderHub = () => {
    arrangeTabs();

    if (hubState.activeTab === "commands") {
      hubElements.tabs.forEach((button) => {
        const active = button.dataset.hubTab === "commands";
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
      updateHubStatus();
      renderEmptyCommands();
      return;
    }

    previousRenderHub();
    arrangeTabs();
  };

  arrangeTabs();
  if (!hubElements.modal?.hidden) renderHub();
})();
