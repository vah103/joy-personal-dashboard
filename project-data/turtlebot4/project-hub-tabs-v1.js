(() => {
  const nav = document.querySelector("#turtlebot-hub-modal .turtlebot-hub-tabs");
  if (!nav || typeof hubState === "undefined" || typeof hubElements === "undefined") return;

  function removeJournalTab() {
    const journalButton = nav.querySelector('[data-hub-tab="journal"]');
    if (journalButton) {
      const tabIndex = hubElements.tabs.indexOf(journalButton);
      if (tabIndex >= 0) hubElements.tabs.splice(tabIndex, 1);
      journalButton.remove();
    }

    if (typeof HUB_TABS !== "undefined") {
      const journalIndex = HUB_TABS.indexOf("journal");
      if (journalIndex >= 0) HUB_TABS.splice(journalIndex, 1);
    }

    if (hubState.activeTab === "journal") hubState.activeTab = "roadmap";
  }

  function placeCommandsAfterSchedule() {
    const commandsButton = nav.querySelector('[data-hub-tab="commands"]');
    const scheduleButton = nav.querySelector('[data-hub-tab="schedule"]')
      || [...nav.querySelectorAll('[data-hub-tab="plan"]')]
        .find((button) => !button.hasAttribute("data-ps-overview"));

    if (!commandsButton || !scheduleButton) return;
    if (scheduleButton.nextElementSibling !== commandsButton) scheduleButton.after(commandsButton);
  }

  function syncHubTabs() {
    removeJournalTab();
    placeCommandsAfterSchedule();
  }

  renderCommands = function renderEmptyCommands() {
    if (!hubElements.body) return;
    hubElements.body.className = "turtlebot-hub-body hub-command-empty-body";
    hubElements.body.replaceChildren();
  };

  syncHubTabs();

  const observer = new MutationObserver(syncHubTabs);
  observer.observe(nav, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-hub-tab"],
  });
})();
