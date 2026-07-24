function scheduleHubSave() {
  storeLocalOverrides();
  hubState.saveStatus = "Saving";
  updateHubStatus();
  clearTimeout(hubState.saveTimer);
  hubState.saveTimer = setTimeout(saveHubNow, 500);
}

async function saveHubNow() {
  storeLocalOverrides();
  try {
    const result = await fetchHubJson("/api/project-hub", {
      method: "PUT",
      body: JSON.stringify({ data: hubState.overrides, baseVersion: hubState.version }),
    });
    hubState.version = Number(result.version || hubState.version + 1);
    hubState.updatedAt = Number(result.updatedAt || Date.now());
    hubState.saveStatus = "Saved";
  } catch (error) {
    if (error.status === 409 && error.payload) {
      hubState.overrides = normalizeOverrides(error.payload.data);
      hubState.version = Number(error.payload.version || 0);
      hubState.saveStatus = "Reloaded after conflict";
      storeLocalOverrides();
      renderHub();
    } else {
      hubState.saveStatus = "Saved locally";
    }
  }
  updateHubStatus();
  updateTurtleBotCard();
}

function updateOverrideFromInput(target) {
  if (target.matches("[data-hub-check]")) {
    hubState.overrides.checklist[target.dataset.hubCheck] = target.checked;
    renderRoadmap();
    scheduleHubSave();
    return true;
  }
  if (target.matches("[data-hub-stage-status]")) {
    hubState.overrides.stageStatus[target.dataset.hubStageStatus] = target.value;
    renderRoadmap();
    scheduleHubSave();
    return true;
  }
  if (target.matches("[data-hub-stage-note]")) {
    hubState.overrides.stageNotes[target.dataset.hubStageNote] = target.value;
    scheduleHubSave();
    return true;
  }
  if (target.matches("[data-hub-journal-summary]")) {
    const date = target.dataset.hubJournalSummary;
    hubState.overrides.journals[date] = { ...(hubState.overrides.journals[date] || {}), summary: target.value };
    scheduleHubSave();
    return true;
  }
  if (target.matches("[data-hub-journal-proof]")) {
    const date = target.dataset.hubJournalProof;
    hubState.overrides.journals[date] = { ...(hubState.overrides.journals[date] || {}), proof: target.value };
    scheduleHubSave();
    return true;
  }
  if (target.matches("[data-hub-plan]")) {
    hubState.overrides.plan[target.dataset.hubPlan] = target.value;
    scheduleHubSave();
    return true;
  }
  return false;
}

function commandById(id) {
  return mergedCommands().find((command) => String(command.id) === String(id));
}

function editCommand(id) {
  const command = commandById(id);
  if (!command) return;
  const name = window.prompt("Command name", command.name || "");
  if (name === null) return;
  const code = window.prompt("Command code", command.code || "");
  if (code === null) return;
  const expectedResult = window.prompt("Expected result", command.expectedResult || "");
  if (expectedResult === null) return;

  const existingSource = hubState.source.commands.commands.some((item) => item.id === id);
  if (existingSource) {
    hubState.overrides.commandEdits[id] = {
      ...(hubState.overrides.commandEdits[id] || {}),
      name: name.trim() || command.name,
      code,
      expectedResult,
    };
  } else {
    const index = hubState.overrides.customCommands.findIndex((item) => item.id === id);
    if (index >= 0) {
      hubState.overrides.customCommands[index] = {
        ...hubState.overrides.customCommands[index],
        name: name.trim() || command.name,
        code,
        expectedResult,
      };
    }
  }
  scheduleHubSave();
  renderCommands();
}

function addCommand() {
  const name = window.prompt("New command name");
  if (!name?.trim()) return;
  const code = window.prompt("Command code");
  if (code === null) return;
  const command = {
    id: `custom-${Date.now()}`,
    category: "Custom",
    name: name.trim(),
    runOn: "Dell laptop",
    safety: "unverified",
    verifiedAt: null,
    stageIds: [hubState.activeStageId],
    purpose: "Personal command added in Joy.",
    code,
    expectedResult: "Add the expected result after testing.",
  };
  hubState.overrides.customCommands.push(command);
  scheduleHubSave();
  renderCommands();
}

async function copyCommand(id) {
  const command = commandById(id);
  if (!command) return;
  try {
    await navigator.clipboard.writeText(command.code || "");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = command.code || "";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  hubState.saveStatus = "Command copied";
  updateHubStatus();
  setTimeout(() => {
    hubState.saveStatus = "Saved";
    updateHubStatus();
  }, 1200);
}

async function addPlanToTodo() {
  const plan = effectivePlan();
  const now = new Date().toISOString();
  try {
    await fetchHubJson("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        id: `turtlebot-${Date.now()}`,
        title: `TurtleBot4: ${plan.nextAction || plan.title}`,
        done: false,
        createdAt: now,
        updatedAt: now,
      }),
    });
    hubState.saveStatus = "Added to To-do";
  } catch {
    hubState.saveStatus = "Could not add task";
  }
  updateHubStatus();
}

function answerProjectQuestion(question) {
  const value = question.toLowerCase();
  const stage = currentStage();
  const pending = nextPendingItem(stage);
  const progress = projectProgress();

  if (/(next|tiếp|làm gì)/.test(value)) {
    return `The project is at Stage ${stage.number}: ${stage.name}. The next evidence-based action is “${pending?.label || effectivePlan().nextAction}”. Complete it before moving to Stage ${stage.number + 1}.`;
  }
  if (/(lab|prepare|chuẩn bị)/.test(value)) {
    const relevant = mergedCommands().filter((command) => command.stageIds?.includes(stage.id)).slice(0, 5);
    return `For the next lab session, prepare the versioned map, verify battery/LiDAR/TF first, then run Localization and Nav2 from a fresh startup. Useful commands: ${relevant.map((command) => command.name).join(", ")}. Keep the three fixed goals in open, safe areas.`;
  }
  if (/(abort|status 6|goal)/.test(value)) {
    return "The report proves only that one goal returned ABORTED while later goals succeeded. The likely areas to inspect are a goal placed too close to an obstacle, costmap inflation, an unreachable pose or controller recovery. The exact root cause is not confirmed yet, so save the action result, costmaps and logs during the next repeat.";
  }
  if (/(home|nhà)/.test(value)) {
    return "At home, you can prepare launch/config files, define the fixed benchmark goals, create logging templates, review reports, work in simulation and design frontier scoring. Real LiDAR/camera validation, safe motion tests, docking and final robot benchmarks still require the lab.";
  }
  if (/(progress|percent|%|tiến độ)/.test(value)) {
    return `Joy calculates ${progress}% overall progress from weighted roadmap checklists. Stage ${stage.number} is ${stage.progress}% complete and remains ${labelStatus(stage.status)} because its completion gate has not been fully met.`;
  }
  if (/(camera|depth|rgb)/.test(value)) {
    return "Camera, Mouse and Joystick diagnostics were still unresolved in the 23 July report. RGB and depth must be verified before Stage 6 perception work can begin.";
  }
  return `Current project state: ${progress}% overall, Stage ${stage.number} “${stage.name}” at ${stage.progress}%. The strongest verified result is that SLAM, AMCL Localization and Nav2 operated on the real robot. The next priority is reproducibility and a formal Nav2 benchmark.`;
}

function askJoy(question) {
  const trimmed = String(question || "").trim();
  if (!trimmed) return;
  hubState.chat.push({ role: "user", text: trimmed });
  hubState.chat.push({ role: "joy", text: answerProjectQuestion(trimmed) });
  hubState.chat = hubState.chat.slice(-12);
  renderPlan();
  const log = document.querySelector("#hub-chat-log");
  if (log) log.scrollTop = log.scrollHeight;
}

document.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-hub-action]");
  if (actionTarget) {
    const action = actionTarget.dataset.hubAction;
    if (action === "close") closeHub();
    if (action === "select-stage") {
      hubState.activeStageId = actionTarget.dataset.stageId;
      renderRoadmap();
    }
    if (action === "copy-command") copyCommand(actionTarget.dataset.commandId);
    if (action === "edit-command") editCommand(actionTarget.dataset.commandId);
    if (action === "add-command") addCommand();
    if (action === "add-plan-to-todo") addPlanToTodo();
    if (action === "reset-plan") {
      hubState.overrides.plan = {};
      scheduleHubSave();
      renderPlan();
    }
    if (action === "ask-suggestion") askJoy(actionTarget.dataset.question);
    return;
  }

  const card = event.target.closest(".turtlebot-project-card");
  if (card && !event.target.closest("[data-action='archive-project']")) openHub();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && hubElements.modal && !hubElements.modal.hidden) closeHub();
  const card = event.target.closest?.(".turtlebot-project-card");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openHub();
  }
});

document.addEventListener("input", (event) => {
  updateOverrideFromInput(event.target);
});

document.addEventListener("change", (event) => {
  if (updateOverrideFromInput(event.target)) return;
  if (event.target.id === "hub-command-filter") {
    document.querySelectorAll(".hub-command-card").forEach((card) => {
      card.hidden = Boolean(event.target.value) && card.dataset.commandCategory !== event.target.value;
    });
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "hub-chat-form") return;
  event.preventDefault();
  const input = new FormData(event.target).get("question");
  event.target.reset();
  askJoy(input);
});

hubElements.tabs.forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.hubTab;
    if (!HUB_TABS.includes(tab)) return;
    hubState.activeTab = tab;
    renderHub();
  });
});

hubElements.modal?.addEventListener("click", (event) => {
  if (event.target === hubElements.modal) closeHub();
});

const projectObserver = new MutationObserver(enhanceTurtleBotCard);
const projectList = document.querySelector("#project-list");
if (projectList) projectObserver.observe(projectList, { childList: true, subtree: true });

enhanceTurtleBotCard();
loadTurtleBotHub().catch((error) => {
  hubState.sourceError = error.message;
  hubState.saveStatus = "Unavailable";
  updateHubStatus();
});
