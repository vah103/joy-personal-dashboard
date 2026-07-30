(() => {
  const previousRenderHub = renderHub;
  let docsCommands = [];
  let docsCommandsLoaded = false;

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

  function dockTabsInHeader(nav) {
    const header = document.querySelector("#turtlebot-hub-modal .turtlebot-hub-header");
    if (!header || !nav) return;

    const actions = header.querySelector(".turtlebot-hub-header-actions");
    header.classList.add("turtlebot-hub-header-with-tabs");
    header.insertBefore(nav, actions || null);
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

    dockTabsInHeader(nav);
  }

  function clearLegacyCommandOverrides() {
    const edits = hubState.overrides?.commandEdits;
    const custom = hubState.overrides?.customCommands;
    const hasLegacy = Boolean(
      (edits && Object.keys(edits).length)
      || (Array.isArray(custom) && custom.length),
    );
    if (!hasLegacy) return;

    hubState.overrides.commandEdits = {};
    hubState.overrides.customCommands = [];
    if (typeof storeLocalOverrides === "function") storeLocalOverrides();
    if (typeof scheduleHubSave === "function") scheduleHubSave();
  }

  function docsOnlyCommands() {
    return docsCommandsLoaded ? docsCommands : [];
  }

  mergedCommands = docsOnlyCommands;

  function removeLegacyCommandControls() {
    const body = hubElements.body;
    if (!body) return;
    body.querySelector('[data-hub-action="add-command"]')?.remove();
    body.querySelectorAll('[data-hub-action="edit-command"]').forEach((button) => button.remove());

    const sourceLabel = body.querySelector(".hub-command-toolbar p");
    if (sourceLabel) sourceLabel.textContent = "Google Docs command tab";
  }

  async function loadDocsCommands() {
    try {
      const response = await fetch(
        "/project-data/turtlebot4/commands-docs.json?v=turtlebot-doc-commands-v1",
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Command source returned ${response.status}`);
      const payload = await response.json();
      docsCommands = Array.isArray(payload?.commands) ? payload.commands : [];
      docsCommandsLoaded = true;
      if (hubState.source) hubState.source.commands = payload;
    } catch (error) {
      console.error("Joy could not load the Google Docs command source", error);
      docsCommands = Array.isArray(hubState.source?.commands?.commands)
        ? hubState.source.commands.commands
        : [];
      docsCommandsLoaded = true;
    }

    clearLegacyCommandOverrides();
    if (hubState.activeTab === "commands" && !hubElements.modal?.hidden) renderHub();
  }

  renderHub = () => {
    arrangeTabs();
    clearLegacyCommandOverrides();
    previousRenderHub();
    if (hubState.activeTab === "commands") removeLegacyCommandControls();
    arrangeTabs();
  };

  arrangeTabs();
  loadDocsCommands();
  if (!hubElements.modal?.hidden) renderHub();
})();
