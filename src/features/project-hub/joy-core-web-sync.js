(() => {
  const hubApi = window.JoyProjectHub;
  if (!hubApi?.getContext) {
    throw new Error("Joy Core web sync requires Project Hub extension API v2");
  }

  const PROJECT_ID = "turtlebot4";
  const API_ROOT = "/api/joy-core/v1";
  const PROJECT_URL = `${API_ROOT}/projects/${PROJECT_ID}`;
  const PROJECT_TASKS_URL = `${PROJECT_URL}/tasks`;
  const CORE_PANEL_SELECTOR = "[data-joy-core-panel]";
  let detail = null;
  let loadPromise = null;
  let projectSyncTimer = 0;
  let applying = false;

  const context = () => hubApi.getContext();
  const escape = (value) => context().escape(String(value ?? ""));

  function slug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 54) || "item";
  }

  function setStatus(message) {
    const ctx = context();
    ctx.state.saveStatus = message;
    ctx.updateStatus();
  }

  async function requestJson(url, init = {}) {
    const headers = new Headers(init.headers || {});
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(url, {
      credentials: "same-origin",
      ...init,
      headers,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `JOY_CORE_HTTP_${response.status}`);
      error.status = response.status;
      error.details = payload.details || null;
      throw error;
    }
    return payload;
  }

  async function waitForProjectState() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const ctx = context();
      if (ctx.state.projectState?.schemaVersion === 2 && ctx.state.source) return ctx;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return context();
  }

  function storeDetail(value) {
    detail = value && typeof value === "object" ? value : null;
    const ctx = context();
    ctx.state.joyCoreProject = detail;
  }

  async function loadCore({ refresh = true } = {}) {
    if (loadPromise) return loadPromise;
    loadPromise = requestJson(PROJECT_URL)
      .then(async (value) => {
        storeDetail(value);
        await waitForProjectState();
        if (value.compatibilityMode) {
          await syncProjectFromHub({ force: true, refresh: false });
        }
        if (refresh) hubApi.refresh();
        return detail;
      })
      .catch((error) => {
        setStatus(`Joy Core unavailable: ${error.message}`);
        return null;
      })
      .finally(() => {
        loadPromise = null;
      });
    return loadPromise;
  }

  function canonicalProject() {
    return detail?.project || null;
  }

  function coreTasks() {
    return Array.isArray(detail?.tasks) ? detail.tasks : [];
  }

  function coreLogs() {
    return Array.isArray(detail?.progressLogs) ? detail.progressLogs : [];
  }

  function coreMilestones() {
    return Array.isArray(detail?.milestones) ? detail.milestones : [];
  }

  function coreEvidence() {
    return Array.isArray(detail?.evidence) ? detail.evidence : [];
  }

  function formatTimestamp(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(timestamp));
  }

  function taskStatusLabel(status) {
    return String(status || "todo").replaceAll("_", " ");
  }

  function renderCoreTasks() {
    const tasks = coreTasks().slice(0, 12);
    if (!tasks.length) {
      return '<p class="joy-core-empty">No Joy Core project tasks yet. Tasks created by the Custom GPT will appear here.</p>';
    }
    return `<div class="joy-core-task-list">${tasks.map((task) => {
      const done = task.status === "done";
      return `<label class="joy-core-task ${done ? "done" : ""}">
        <input type="checkbox" data-joy-core-task="${escape(task.id)}" data-version="${Number(task.version || 0)}" ${done ? "checked" : ""}>
        <span class="joy-core-check">${done ? "✓" : ""}</span>
        <span><b>${escape(task.title)}</b><small>${escape(task.priority || "normal")} · ${escape(taskStatusLabel(task.status))}${task.dueAt ? ` · ${escape(formatTimestamp(task.dueAt))}` : ""}</small></span>
      </label>`;
    }).join("")}</div>`;
  }

  function renderCoreActivity() {
    const logs = coreLogs().slice(0, 6);
    const evidence = coreEvidence().slice(0, 4);
    if (!logs.length && !evidence.length) {
      return '<p class="joy-core-empty">No Joy Core progress logs or evidence have been recorded yet.</p>';
    }
    return `<div class="joy-core-activity">
      ${logs.map((log) => `<article><span>${escape(formatTimestamp(log.occurredAt))}</span><b>${escape(log.title)}</b><p>${escape(log.detail || taskStatusLabel(log.kind))}</p>${log.progressAfter === null || log.progressAfter === undefined ? "" : `<em>${Number(log.progressAfter)}%</em>`}</article>`).join("")}
      ${evidence.map((item) => `<article><span>${escape(taskStatusLabel(item.kind))}</span><b>${escape(item.label)}</b><p>${escape(item.uri)}</p></article>`).join("")}
    </div>`;
  }

  function renderCorePanel() {
    const project = canonicalProject();
    if (!project) return "";
    const milestones = coreMilestones();
    return `<section class="ps-history joy-core-panel" data-joy-core-panel>
      <div class="ps-title"><div><span>Joy Core · shared with Custom GPT</span><h3>${escape(project.currentFocus || "Canonical project state")}</h3></div><small>Version ${Number(project.version || 0)}</small></div>
      <div class="joy-core-summary">
        <article><span>Canonical progress</span><strong>${Number(project.progress || 0)}%</strong></article>
        <article><span>Next action</span><strong>${escape(project.nextAction || "Not set")}</strong></article>
        <article><span>Milestones</span><strong>${milestones.length}</strong></article>
        <article><span>Evidence</span><strong>${coreEvidence().length}</strong></article>
      </div>
      <div class="joy-core-grid">
        <section><div class="joy-core-heading"><b>Project tasks</b><small>Web and GPT use the same records</small></div>${renderCoreTasks()}</section>
        <section><div class="joy-core-heading"><b>Recent activity</b><small>Progress logs and evidence</small></div>${renderCoreActivity()}</section>
      </div>
    </section>`;
  }

  function applyCanonicalView() {
    if (applying) return;
    const project = canonicalProject();
    if (!project) return;
    applying = true;
    try {
      const ctx = context();
      const card = ctx.findTurtleBotCard();
      if (card) {
        const percentage = card.querySelector(".project-top span");
        const track = card.querySelector(".progress-track span");
        const details = card.querySelectorAll("dl dd");
        if (percentage) percentage.textContent = `${Number(project.progress || 0)}%`;
        if (track) track.style.width = `${Number(project.progress || 0)}%`;
        if (details[0] && project.currentFocus) details[0].textContent = project.currentFocus;
        if (details[1] && project.nextAction) details[1].textContent = project.nextAction;
        const source = card.querySelector(".project-git-source");
        if (source) source.textContent = `Joy Core v${Number(project.version || 0)} · ${ctx.state.sourceMode === "github" ? "GitHub roadmap" : "Snapshot roadmap"}`;
      }

      const wrap = ctx.elements.body?.querySelector(".ps-wrap");
      if (!wrap) return;
      const metrics = wrap.querySelectorAll(".ps-metrics article");
      const progressValue = metrics[0]?.querySelector("strong");
      const progressCaption = metrics[0]?.querySelector("small");
      if (progressValue) progressValue.textContent = `${Number(project.progress || 0)}%`;
      if (progressCaption) progressCaption.textContent = "Joy Core canonical";
      const heroLabel = wrap.querySelector(".ps-hero span");
      if (heroLabel && !heroLabel.textContent.startsWith("Joy Core")) {
        heroLabel.textContent = `Joy Core + ${heroLabel.textContent}`;
      }

      wrap.querySelector(CORE_PANEL_SELECTOR)?.remove();
      const history = wrap.querySelector(".ps-history");
      const holder = document.createElement("div");
      holder.innerHTML = renderCorePanel();
      const panel = holder.firstElementChild;
      if (panel) {
        if (history) history.insertAdjacentElement("afterend", panel);
        else wrap.append(panel);
      }
    } finally {
      applying = false;
    }
  }

  function installStyles() {
    if (document.querySelector("#joy-core-web-sync-styles")) return;
    const style = document.createElement("style");
    style.id = "joy-core-web-sync-styles";
    style.textContent = `
      .joy-core-panel{display:grid;gap:14px;border-color:#9fb5bf!important;background:linear-gradient(145deg,#fff,#f3f8fa)!important}.joy-core-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.joy-core-summary article{padding:11px;border:1px solid #d7e2e6;border-radius:11px;background:#fff}.joy-core-summary span,.joy-core-summary strong{display:block}.joy-core-summary span{color:#7a8b92;font-size:.63rem}.joy-core-summary strong{margin-top:4px;color:#344950;font-size:.78rem;line-height:1.35}.joy-core-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.joy-core-grid>section{padding:13px;border:1px solid #dce5e8;border-radius:12px;background:#fff}.joy-core-heading{display:flex;justify-content:space-between;gap:8px}.joy-core-heading b{color:#40535b;font-size:.76rem}.joy-core-heading small{color:#829097;font-size:.61rem}.joy-core-task-list,.joy-core-activity{display:grid;gap:7px;margin-top:10px}.joy-core-task{display:grid;grid-template-columns:19px 1fr;gap:8px;padding:9px;border:1px solid #e0e7e9;border-radius:10px;background:#f9fbfc;cursor:pointer}.joy-core-task input{position:absolute;opacity:0}.joy-core-check{width:18px;height:18px;display:grid;place-items:center;border:1px solid #bfcbd1;border-radius:6px;background:#fff;font-size:.65rem}.joy-core-task b,.joy-core-task small{display:block}.joy-core-task b{color:#46585f;font-size:.72rem;line-height:1.4}.joy-core-task small{margin-top:2px;color:#86949a;font-size:.6rem;text-transform:capitalize}.joy-core-task.done{background:#eef4f2}.joy-core-task.done b{text-decoration:line-through;color:#728079}.joy-core-activity article{position:relative;padding:8px 42px 8px 9px;border-bottom:1px solid #e7ecee}.joy-core-activity span,.joy-core-activity b,.joy-core-activity p{display:block;margin:0}.joy-core-activity span{color:#849299;font-size:.59rem;text-transform:capitalize}.joy-core-activity b{margin-top:2px;color:#46585f;font-size:.7rem}.joy-core-activity p{margin-top:2px;color:#748289;font-size:.62rem;line-height:1.4;overflow-wrap:anywhere}.joy-core-activity em{position:absolute;right:4px;top:11px;padding:3px 6px;border-radius:6px;background:#eaf1f4;color:#526b76;font-size:.62rem;font-style:normal;font-weight:800}.joy-core-empty{margin:10px 0 0;color:#7d8b91;font-size:.67rem;line-height:1.5}
      @media(max-width:860px){.joy-core-summary{grid-template-columns:1fr 1fr}.joy-core-grid{grid-template-columns:1fr}}@media(max-width:480px){.joy-core-summary{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  async function patchProject(patch, { refresh = true } = {}) {
    const project = canonicalProject();
    if (!project) await loadCore({ refresh: false });
    const current = canonicalProject();
    if (!current) return null;
    const saved = await requestJson(PROJECT_URL, {
      method: "PATCH",
      body: JSON.stringify({
        ...patch,
        baseVersion: Number(current.version || 0),
      }),
    });
    storeDetail({
      ...(detail || {}),
      project: saved,
      compatibilityMode: false,
    });
    if (refresh) hubApi.refresh();
    return saved;
  }

  async function syncProjectFromHub({ force = false, refresh = true } = {}) {
    const ctx = await waitForProjectState();
    if (!detail) await loadCore({ refresh: false });
    const project = canonicalProject();
    if (!project) return null;
    const plan = ctx.effectivePlan();
    const progress = Number(ctx.projectProgress() || 0);
    const stageId = ctx.currentStage()?.id || ctx.state.projectState?.project?.currentStageId || null;
    const patch = {
      progress,
      currentStageId: stageId,
      currentFocus: plan.currentFocus || ctx.state.projectState?.project?.currentFocus || "",
      nextAction: plan.nextAction || plan.title || "",
    };
    const changed = force
      || Number(project.progress || 0) !== progress
      || project.currentStageId !== patch.currentStageId
      || project.currentFocus !== patch.currentFocus
      || project.nextAction !== patch.nextAction;
    if (!changed) return project;
    const saved = await patchProject(patch, { refresh });
    setStatus("Joy Core synced");
    return saved;
  }

  function scheduleProjectSync() {
    clearTimeout(projectSyncTimer);
    projectSyncTimer = window.setTimeout(() => {
      syncProjectFromHub().catch((error) => setStatus(`Joy Core sync failed: ${error.message}`));
    }, 450);
  }

  async function createOrUpdateScheduleTask(input) {
    const label = input.closest(".ps-task")?.querySelector("b")?.textContent?.trim();
    const sourceId = input.dataset.psTask;
    if (!label || !sourceId) return;
    const result = await requestJson(PROJECT_TASKS_URL, {
      method: "POST",
      body: JSON.stringify({
        title: label,
        status: input.checked ? "done" : "todo",
        priority: "normal",
        clientRequestId: `web-schedule-${slug(sourceId)}`,
      }),
    });
    let task = result.task;
    if (result.deduplicated && task.status !== (input.checked ? "done" : "todo")) {
      task = await requestJson(`${API_ROOT}/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: input.checked ? "done" : "todo",
          baseVersion: Number(task.version || 0),
        }),
      });
    }
    const tasks = coreTasks().filter((item) => item.id !== task.id);
    storeDetail({ ...(detail || {}), tasks: [task, ...tasks] });
  }

  async function updateCoreTask(input) {
    const taskId = input.dataset.joyCoreTask;
    const task = coreTasks().find((item) => item.id === taskId);
    if (!task) return;
    const saved = await requestJson(`${API_ROOT}/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: input.checked ? "done" : "todo",
        baseVersion: Number(task.version || 0),
      }),
    });
    storeDetail({
      ...(detail || {}),
      tasks: coreTasks().map((item) => item.id === taskId ? saved : item),
    });
    setStatus(input.checked ? "Joy Core task completed" : "Joy Core task reopened");
    hubApi.refresh();
  }

  async function addPlanToJoyCore(button) {
    const ctx = context();
    const plan = ctx.effectivePlan();
    const title = String(plan.title || plan.nextAction || "").trim();
    if (!title) {
      setStatus("No plan task to add");
      return;
    }
    button.disabled = true;
    try {
      const priority = String(plan.priority || "normal").toLowerCase();
      const result = await requestJson(PROJECT_TASKS_URL, {
        method: "POST",
        body: JSON.stringify({
          title,
          description: [plan.why, plan.completionCriteria].filter(Boolean).join("\n\n"),
          priority: ["low", "normal", "high", "critical"].includes(priority) ? priority : "high",
          status: "todo",
          clientRequestId: `web-plan-${slug(title)}`,
        }),
      });
      const tasks = coreTasks().filter((item) => item.id !== result.task.id);
      storeDetail({ ...(detail || {}), tasks: [result.task, ...tasks] });
      setStatus(result.deduplicated ? "Task already exists in Joy Core" : "Task added to Joy Core");
      hubApi.refresh();
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.('[data-hub-action="add-plan-to-todo"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    addPlanToJoyCore(button).catch((error) => setStatus(`Could not add Joy Core task: ${error.message}`));
  }, true);

  document.addEventListener("change", (event) => {
    const coreInput = event.target.closest?.("[data-joy-core-task]");
    if (coreInput) {
      updateCoreTask(coreInput).catch((error) => setStatus(`Task update failed: ${error.message}`));
      return;
    }

    const scheduleInput = event.target.closest?.("[data-ps-task]");
    if (scheduleInput) {
      createOrUpdateScheduleTask(scheduleInput)
        .then(() => scheduleProjectSync())
        .catch((error) => setStatus(`Schedule sync failed: ${error.message}`));
      return;
    }

    if (event.target.closest?.("[data-hub-check],[data-hub-stage-status]")) {
      scheduleProjectSync();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.closest?.("[data-hub-plan]")) scheduleProjectSync();
  });

  document.addEventListener("joy-project-hub:rendered", applyCanonicalView);
  document.addEventListener("joy-project-hub:card-updated", applyCanonicalView);

  installStyles();
  loadCore().then(applyCanonicalView);
})();
