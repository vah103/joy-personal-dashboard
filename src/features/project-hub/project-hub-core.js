function ensureHubShell() {
  if (document.querySelector("#turtlebot-hub-modal")) return;
  const shell = document.createElement("div");
  shell.className = "turtlebot-hub-backdrop";
  shell.id = "turtlebot-hub-modal";
  shell.hidden = true;
  shell.innerHTML = `
    <section class="turtlebot-hub" role="dialog" aria-modal="true" aria-labelledby="turtlebot-hub-title">
      <header class="turtlebot-hub-header">
        <div class="turtlebot-hub-title">
          <span class="turtlebot-hub-mark" aria-hidden="true">⌁</span>
          <div>
            <p>TurtleBot project hub</p>
            <h2 id="turtlebot-hub-title">TurtleBot 4</h2>
            <small>Semantic-risk-aware autonomous exploration</small>
          </div>
        </div>
        <div class="turtlebot-hub-header-actions">
          <span class="turtlebot-hub-sync" id="turtlebot-hub-sync">Connecting…</span>
          <a href="https://github.com/vah103/turtlebot4_project" target="_blank" rel="noreferrer">GitHub ↗</a>
          <button type="button" data-hub-action="close" aria-label="Close TurtleBot project hub">×</button>
        </div>
      </header>
      <nav class="turtlebot-hub-tabs" aria-label="TurtleBot project sections">
        <button type="button" class="active" data-hub-tab="roadmap" aria-selected="true">Roadmap</button>
        <button type="button" data-hub-tab="commands" aria-selected="false">Commands</button>
        <button type="button" data-hub-tab="journal" aria-selected="false">Lab Journal</button>
        <button type="button" data-hub-tab="plan" aria-selected="false">Plan & Joy</button>
      </nav>
      <div class="turtlebot-hub-body" id="turtlebot-hub-body"></div>
    </section>`;
  document.body.append(shell);
}

ensureHubShell();

const HUB_LOCAL_KEY = "joy-turtlebot-hub-overrides-v1";
const HUB_TABS = ["roadmap", "commands", "journal", "plan"];

const hubState = {
  source: null,
  overrides: emptyOverrides(),
  version: 0,
  updatedAt: 0,
  activeTab: "roadmap",
  activeStageId: "stage-2",
  sourceMode: "loading",
  sourceError: "",
  saveStatus: "Saved",
  saveTimer: null,
  chat: [],
};

const hubElements = {
  modal: document.querySelector("#turtlebot-hub-modal"),
  body: document.querySelector("#turtlebot-hub-body"),
  status: document.querySelector("#turtlebot-hub-sync"),
  tabs: [...document.querySelectorAll("[data-hub-tab]")],
  title: document.querySelector("#turtlebot-hub-title"),
};

function emptyOverrides() {
  return {
    checklist: {},
    stageStatus: {},
    stageNotes: {},
    commandEdits: {},
    customCommands: [],
    journals: {},
    plan: {},
  };
}

function normalizeOverrides(value) {
  const base = emptyOverrides();
  if (!value || typeof value !== "object") return base;
  return {
    checklist: value.checklist && typeof value.checklist === "object" ? value.checklist : {},
    stageStatus: value.stageStatus && typeof value.stageStatus === "object" ? value.stageStatus : {},
    stageNotes: value.stageNotes && typeof value.stageNotes === "object" ? value.stageNotes : {},
    commandEdits: value.commandEdits && typeof value.commandEdits === "object" ? value.commandEdits : {},
    customCommands: Array.isArray(value.customCommands) ? value.customCommands : [],
    journals: value.journals && typeof value.journals === "object" ? value.journals : {},
    plan: value.plan && typeof value.plan === "object" ? value.plan : {},
  };
}

function escapeHub(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatHubDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStages() {
  return Array.isArray(hubState.source?.roadmap?.stages) ? hubState.source.roadmap.stages : [];
}

function effectiveChecklistItem(item) {
  const override = hubState.overrides.checklist[item.id];
  return { ...item, done: typeof override === "boolean" ? override : Boolean(item.done) };
}

function effectiveStage(stage) {
  const checklist = (stage.checklist || []).map(effectiveChecklistItem);
  const total = checklist.reduce((sum, item) => sum + Number(item.weight || 1), 0);
  const completed = checklist.reduce((sum, item) => sum + (item.done ? Number(item.weight || 1) : 0), 0);
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const overrideStatus = hubState.overrides.stageStatus[stage.id];
  let status = overrideStatus || stage.status || "not-started";
  if (!overrideStatus && progress === 100) status = "completed";
  if (!overrideStatus && progress > 0 && status === "not-started") status = "in-progress";
  return { ...stage, checklist, progress, status };
}

function projectProgress() {
  const stages = getStages().map(effectiveStage);
  const totalWeight = stages.reduce((sum, stage) => sum + Number(stage.weight || 1), 0);
  const weighted = stages.reduce((sum, stage) => sum + stage.progress * Number(stage.weight || 1), 0);
  return totalWeight ? Math.round(weighted / totalWeight) : 0;
}

function currentStage() {
  const stages = getStages().map(effectiveStage);
  return stages.find((stage) => stage.id === hubState.activeStageId)
    || stages.find((stage) => stage.id === hubState.source?.project?.currentStageId)
    || stages[0];
}

function nextPendingItem(stage = currentStage()) {
  return stage?.checklist?.find((item) => !item.done) || null;
}

function mergedCommands() {
  const sourceCommands = Array.isArray(hubState.source?.commands?.commands)
    ? hubState.source.commands.commands
    : [];
  const edited = sourceCommands.map((command) => ({
    ...command,
    ...(hubState.overrides.commandEdits[command.id] || {}),
  }));
  return [...edited, ...hubState.overrides.customCommands];
}

function loadLocalOverrides() {
  try {
    return normalizeOverrides(JSON.parse(localStorage.getItem(HUB_LOCAL_KEY)));
  } catch {
    return emptyOverrides();
  }
}

function storeLocalOverrides() {
  localStorage.setItem(HUB_LOCAL_KEY, JSON.stringify(hubState.overrides));
}

async function fetchHubJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function loadTurtleBotHub() {
  const sourcePromise = fetchHubJson("/api/turtlebot-source")
    .then((source) => {
      hubState.sourceMode = "github";
      return source;
    })
    .catch(async (error) => {
      hubState.sourceError = error.payload?.message || error.message;
      const snapshot = await fetchHubJson("/project-data/turtlebot4/source.json");
      hubState.sourceMode = "snapshot";
      return snapshot;
    });

  const overridePromise = fetchHubJson("/api/project-hub")
    .catch(() => ({
      data: loadLocalOverrides(),
      version: 0,
      updatedAt: 0,
      localOnly: true,
    }));

  const [source, stored] = await Promise.all([sourcePromise, overridePromise]);
  hubState.source = source;
  hubState.overrides = normalizeOverrides(stored.data);
  hubState.version = Number(stored.version || 0);
  hubState.updatedAt = Number(stored.updatedAt || 0);
  hubState.activeStageId = source.project?.currentStageId || getStages()[0]?.id || "stage-1";
  storeLocalOverrides();
  updateTurtleBotCard();
  updateHubStatus();
  if (!hubElements.modal?.hidden) renderHub();
}

function updateHubStatus() {
  if (!hubElements.status) return;
  const sourceLabel = hubState.sourceMode === "github" ? "GitHub synced" : "Snapshot";
  const saveLabel = hubState.saveStatus;
  hubElements.status.textContent = `${sourceLabel} · ${saveLabel}`;
  hubElements.status.dataset.mode = hubState.sourceMode;
}

function findTurtleBotCard() {
  return [...document.querySelectorAll("#project-list .project-card")]
    .find((card) => card.querySelector(".project-top strong")?.textContent.trim().toLowerCase().includes("turtlebot"));
}

function enhanceTurtleBotCard() {
  const card = findTurtleBotCard();
  if (!card) return;
  card.classList.add("turtlebot-project-card");
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", "Open TurtleBot 4 project hub");
  if (!card.querySelector(".project-stage-pill")) {
    const pill = document.createElement("span");
    pill.className = "project-stage-pill";
    card.querySelector(".project-top")?.after(pill);
  }
  updateTurtleBotCard();
}

function updateTurtleBotCard() {
  const card = findTurtleBotCard();
  if (!card || !hubState.source) return;
  const stage = getStages().map(effectiveStage)
    .find((item) => item.id === hubState.source.project?.currentStageId)
    || currentStage();
  const progress = projectProgress();
  const pending = nextPendingItem(stage);

  const percentage = card.querySelector(".project-top span");
  if (percentage) percentage.textContent = `${progress}%`;
  const track = card.querySelector(".progress-track span");
  if (track) track.style.width = `${progress}%`;
  const focus = card.querySelector("dl div:first-child dd");
  const next = card.querySelector("dl div:last-child dd");
  if (focus) focus.textContent = hubState.overrides.plan.currentFocus
    || hubState.source.project?.currentFocus
    || stage?.objective
    || "Review roadmap";
  if (next) next.textContent = hubState.overrides.plan.nextAction
    || pending?.label
    || hubState.source.project?.nextAction
    || "Review the next stage";

  const pill = card.querySelector(".project-stage-pill");
  if (pill && stage) {
    pill.textContent = `Stage ${stage.number} of ${getStages().length} · ${labelStatus(stage.status)}`;
  }

  let source = card.querySelector(".project-git-source");
  if (!source) {
    source = document.createElement("span");
    source.className = "project-git-source";
    card.append(source);
  }
  source.textContent = hubState.sourceMode === "github"
    ? "GitHub live · Open project hub"
    : "GitHub snapshot · Open project hub";
}

function labelStatus(status) {
  return String(status || "not-started")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function openHub() {
  if (!hubElements.modal) return;
  hubElements.modal.hidden = false;
  document.body.classList.add("hub-modal-open");
  renderHub();
}

function closeHub() {
  if (!hubElements.modal) return;
  hubElements.modal.hidden = true;
  document.body.classList.remove("hub-modal-open");
}

function renderHub() {
  if (!hubElements.body) return;
  hubElements.tabs.forEach((button) => {
    const active = button.dataset.hubTab === hubState.activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  updateHubStatus();

  if (!hubState.source) {
    hubElements.body.innerHTML = `<div class="hub-loading"><span></span><strong>Connecting TurtleBot project…</strong></div>`;
    return;
  }

  if (hubState.activeTab === "commands") renderCommands();
  else if (hubState.activeTab === "journal") renderJournal();
  else if (hubState.activeTab === "plan") renderPlan();
  else renderRoadmap();
}
