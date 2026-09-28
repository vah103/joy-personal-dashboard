const COMPANY_BOARD_API = "/api/company/live-board";
const COMPANY_BOARD_STYLE = "/company-live-board.css?v=joy-company-live-board-v1";
const LANE_ORDER = Object.freeze(["TODO", "ACTIVE", "REVIEW", "BLOCKED_GATED", "DONE", "OTHER_ARCHIVED"]);

function i18n(key, values = {}) {
  if (typeof window !== "undefined" && window.JoyI18n?.t) return window.JoyI18n.t(key, values);
  return key;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function raw(value, fallback = "—") {
  const text = String(value ?? "").trim() || fallback;
  return `<span data-i18n-skip>${escapeHtml(text)}</span>`;
}

function presenceLabel(state, t) {
  const keys = {
    RECENTLY_CONFIRMED: "companyBoard.presence.recent",
    STALE_NOT_RECENTLY_CONFIRMED: "companyBoard.presence.stale",
    UNKNOWN_UNAVAILABLE: "companyBoard.presence.unknown",
  };
  return t(keys[state] || "companyBoard.presence.unknown");
}

function workloadLabel(state, t) {
  const keys = {
    ACTION_NOW: "companyBoard.workload.actionNow",
    REVIEWING: "companyBoard.workload.reviewing",
    WAITING: "companyBoard.workload.waiting",
    BLOCKED: "companyBoard.workload.blocked",
    FREE_FOR_NEW_WORK: "companyBoard.workload.free",
    UNBOUND: "companyBoard.workload.unbound",
  };
  return t(keys[state] || "companyBoard.workload.unbound");
}

function laneLabel(lane, t) {
  const keys = {
    TODO: "companyBoard.lane.todo",
    ACTIVE: "companyBoard.lane.active",
    REVIEW: "companyBoard.lane.review",
    BLOCKED_GATED: "companyBoard.lane.blocked",
    DONE: "companyBoard.lane.done",
    OTHER_ARCHIVED: "companyBoard.lane.other",
  };
  return t(keys[lane] || "companyBoard.lane.other");
}

function gateLabel(type, t) {
  const key = `companyBoard.gate.${String(type || "unknown").toLowerCase()}`;
  const translated = t(key);
  return translated === key ? t("companyBoard.gate.unknown") : translated;
}

function relationshipLabel(type, t) {
  const keys = {
    PENDING_HANDOFF: "companyBoard.relationship.pendingHandoff",
    REVIEW_WAIT: "companyBoard.relationship.reviewWait",
    DEPENDENCY_WAIT: "companyBoard.relationship.dependencyWait",
    GATE_WAIT: "companyBoard.relationship.gateWait",
  };
  return t(keys[type] || "companyBoard.relationship.gateWait");
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}"${String(value) === String(selected) ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function unique(values) {
  return [...new Set(values.filter((value) => String(value || "").trim()))].sort((a, b) => String(a).localeCompare(String(b)));
}

function renderFilters(data, filters, t) {
  const projects = unique(data.tasks.map((task) => task.project));
  const roles = unique(data.roles.map((role) => role.position));
  const taskIds = unique(data.tasks.map((task) => task.id));
  const handoffStates = unique(data.handoffs.map((handoff) => handoff.pickupState));
  const gateTypes = unique(data.blockers.map((blocker) => blocker.gateType));

  return `
    <div class="company-board-filters" aria-label="${escapeHtml(t("companyBoard.filters"))}">
      <label><span>${escapeHtml(t("companyBoard.filter.project"))}</span><select data-company-board-filter="project">
        ${option("", t("companyBoard.filter.allProjects"), filters.project)}
        ${projects.map((value) => option(value, value, filters.project)).join("")}
      </select></label>
      <label><span>${escapeHtml(t("companyBoard.filter.role"))}</span><select data-company-board-filter="role">
        ${option("", t("companyBoard.filter.allRoles"), filters.role)}
        ${roles.map((value) => option(value, value, filters.role)).join("")}
      </select></label>
      <label><span>${escapeHtml(t("companyBoard.filter.task"))}</span><select data-company-board-filter="task">
        ${option("", t("companyBoard.filter.allTasks"), filters.task)}
        ${taskIds.map((value) => option(value, value, filters.task)).join("")}
      </select></label>
      <label><span>${escapeHtml(t("companyBoard.filter.lane"))}</span><select data-company-board-filter="lane">
        ${option("", t("companyBoard.filter.allLanes"), filters.lane)}
        ${LANE_ORDER.map((value) => option(value, laneLabel(value, t), filters.lane)).join("")}
      </select></label>
      <label><span>${escapeHtml(t("companyBoard.filter.handoff"))}</span><select data-company-board-filter="handoff">
        ${option("", t("companyBoard.filter.allHandoffs"), filters.handoff)}
        ${handoffStates.map((value) => option(value, value, filters.handoff)).join("")}
      </select></label>
      <label><span>${escapeHtml(t("companyBoard.filter.gate"))}</span><select data-company-board-filter="gate">
        ${option("", t("companyBoard.filter.allGates"), filters.gate)}
        ${gateTypes.map((value) => option(value, gateLabel(value, t), filters.gate)).join("")}
      </select></label>
    </div>`;
}

function matchesRole(task, role) {
  if (!role) return true;
  return task.primaryOwner === role || task.currentActionOwner === role;
}

function filteredView(data, filters) {
  const tasks = data.tasks.filter((task) => (
    (!filters.project || task.project === filters.project)
    && (!filters.role || matchesRole(task, filters.role))
    && (!filters.task || task.id === filters.task)
    && (!filters.lane || task.lane === filters.lane)
  ));
  const visibleTaskIds = new Set(tasks.map((task) => task.id));

  const handoffs = data.handoffs.filter((handoff) => (
    (!filters.project || handoff.project === filters.project)
    && (!filters.role || handoff.senderRole === filters.role || handoff.receiverPosition === filters.role)
    && (!filters.task || handoff.taskId === filters.task)
    && (!filters.handoff || handoff.pickupState === filters.handoff)
  ));

  const blockers = data.blockers.filter((blocker) => (
    (!filters.project || blocker.project === filters.project)
    && (!filters.task || blocker.taskId === filters.task)
    && (!filters.gate || blocker.gateType === filters.gate)
    && (!filters.role || data.tasks.some((task) => (
      task.id === blocker.taskId && matchesRole(task, filters.role)
    )))
  ));

  const relationships = data.relationships.filter((relation) => (
    (!filters.task || relation.taskId === filters.task)
    && (!filters.role || relation.from === filters.role || relation.to === filters.role)
    && (!filters.project || visibleTaskIds.has(relation.taskId))
  ));

  const timeline = data.timeline.filter((event) => (
    (!filters.project || event.project === filters.project)
    && (!filters.task || event.taskId === filters.task)
    && (!filters.role || event.role === filters.role)
  ));

  let roles = data.roles;
  if (filters.role) roles = roles.filter((role) => role.position === filters.role);
  else if (filters.project || filters.task || filters.lane) {
    const relevant = new Set();
    tasks.forEach((task) => {
      relevant.add(task.primaryOwner);
      relevant.add(task.currentActionOwner);
    });
    roles = roles.filter((role) => relevant.has(role.position));
  }

  return { tasks, handoffs, blockers, relationships, timeline, roles };
}

function renderSummary(summary, t) {
  const cards = [
    ["actionableNow", "companyBoard.summary.actionable"],
    ["waiting", "companyBoard.summary.waiting"],
    ["review", "companyBoard.summary.review"],
    ["blockedGated", "companyBoard.summary.blocked"],
    ["freeForNewWork", "companyBoard.summary.free"],
    ["doneRecently", "companyBoard.summary.doneRecent"],
  ];
  return `<section class="company-board-summary" aria-label="${escapeHtml(t("companyBoard.summary.title"))}">
    ${cards.map(([key, label]) => {
      const value = summary[key];
      const displayValue = value === null || value === undefined
        ? t("companyBoard.summary.unavailable")
        : value;
      return `<article><strong>${escapeHtml(displayValue)}</strong><span>${escapeHtml(t(label))}</span></article>`;
    }).join("")}
  </section>`;
}

function renderRoleCards(roles, taskMap, t) {
  if (!roles.length) return `<p class="company-board-empty">${escapeHtml(t("companyBoard.empty.roles"))}</p>`;
  return `<div class="company-role-grid">${roles.map((role) => {
    const blockedDetails = role.blockedTasks
      .map((id) => taskMap.get(id))
      .filter(Boolean)
      .map((task) => `${escapeHtml(task.id)} · ${escapeHtml(task.status)}`)
      .join("<br>");
    return `<article class="company-role-card" data-workload="${escapeHtml(role.workload)}">
      <div class="company-role-card-head"><h3>${raw(role.position)}</h3><span class="company-workload-badge">${escapeHtml(workloadLabel(role.workload, t))}</span></div>
      <dl>
        <div><dt>${escapeHtml(t("companyBoard.role.seat"))}</dt><dd>${raw(role.seatStatus)}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.role.assignee"))}</dt><dd>${raw(role.currentAssignee)}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.role.actionable"))}</dt><dd>${raw(role.actionableTasks.join(", "))}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.role.reviewing"))}</dt><dd>${raw(role.reviewingTasks.join(", "))}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.role.waiting"))}</dt><dd>${raw(role.waitingOwnedTasks.join(", "))}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.role.incoming"))}</dt><dd>${raw(role.incomingHandoffs.join(", "))}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.role.blocker"))}</dt><dd>${blockedDetails || raw("")}</dd></div>
      </dl>
      <div class="company-role-presence"><span>${escapeHtml(t("companyBoard.role.presence"))}</span><strong>${escapeHtml(presenceLabel(role.presence?.state, t))}</strong></div>
    </article>`;
  }).join("")}</div>`;
}

function renderBlockers(blockers, t) {
  if (!blockers.length) return `<p class="company-board-empty">${escapeHtml(t("companyBoard.empty.blockers"))}</p>`;
  return `<div class="company-compact-list">${blockers.map((item) => `<article>
    <div><strong>${raw(item.taskId)}</strong><span class="company-chip">${escapeHtml(gateLabel(item.gateType, t))}</span></div>
    <p>${raw(item.detail)}</p>
    <small>${escapeHtml(t("companyBoard.nextOwner"))}: ${raw(item.nextActionOwner)}</small>
  </article>`).join("")}</div>`;
}

function renderHandoffs(handoffs, t) {
  if (!handoffs.length) return `<p class="company-board-empty">${escapeHtml(t("companyBoard.empty.handoffs"))}</p>`;
  return `<div class="company-compact-list">${handoffs.map((item) => `<article class="${item.pickupState === "SUPERSEDED" ? "company-handoff-secondary" : ""}">
    <div><strong>${raw(item.id)}</strong><span class="company-chip">${raw(item.pickupState)}</span></div>
    <p>${raw(item.senderRole)} <span aria-hidden="true">→</span> ${raw(item.receiverPosition)}</p>
    <small>${raw(item.taskId || item.task)} · ${escapeHtml(t("companyBoard.published"))} ${raw(item.publishedAt)}</small>
    <p class="company-board-subtle">${escapeHtml(t("companyBoard.requestedAction"))}: ${raw(item.requestedAction)}</p>
    <p class="company-board-subtle">${escapeHtml(t("companyBoard.nextGate"))}: ${raw(item.nextGate)}</p>
  </article>`).join("")}</div>`;
}

function renderTaskBoard(tasks, t) {
  const groups = new Map(LANE_ORDER.map((lane) => [lane, []]));
  tasks.forEach((task) => (groups.get(task.lane) || groups.get("OTHER_ARCHIVED")).push(task));
  return `<div class="company-task-lanes">${LANE_ORDER.map((lane) => `<section class="company-task-lane">
    <header><h3>${escapeHtml(laneLabel(lane, t))}</h3><span>${groups.get(lane).length}</span></header>
    <div class="company-task-stack">${groups.get(lane).length ? groups.get(lane).map((task) => `<article class="company-task-card">
      <div class="company-task-card-head"><strong>${raw(task.id)}</strong><span class="company-chip">${raw(task.status)}</span></div>
      <h4>${raw(task.title)}</h4>
      <dl>
        <div><dt>${escapeHtml(t("companyBoard.task.project"))}</dt><dd>${raw(task.project)}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.task.primaryOwner"))}</dt><dd>${raw(task.primaryOwner)}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.task.actionOwner"))}</dt><dd>${raw(task.currentActionOwner)}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.task.dependency"))}</dt><dd>${raw(task.dependsOn)}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.task.review"))}</dt><dd>${raw(task.review)}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.task.canonical"))}</dt><dd>${raw(task.canonical)}</dd></div>
        <div><dt>${escapeHtml(t("companyBoard.task.nextAction"))}</dt><dd>${raw(task.nextAction)}</dd></div>
      </dl>
    </article>`).join("") : `<p class="company-board-empty">${escapeHtml(t("companyBoard.empty.lane"))}</p>`}</div>
  </section>`).join("")}</div>`;
}

function renderRelationships(items, t) {
  if (!items.length) return `<p class="company-board-empty">${escapeHtml(t("companyBoard.empty.relationships"))}</p>`;
  return `<div class="company-relationship-list">${items.map((item) => `<article>
    <span class="company-chip">${escapeHtml(relationshipLabel(item.type, t))}</span>
    <strong>${raw(item.from)}</strong><span aria-hidden="true">→</span><strong>${raw(item.to)}</strong>
    <small>${raw(item.taskId)}</small>
  </article>`).join("")}</div>`;
}

function renderTimeline(items, t) {
  if (!items.length) return `<p class="company-board-empty">${escapeHtml(t("companyBoard.empty.timeline"))}</p>`;
  return `<ol class="company-timeline">${items.map((item) => `<li>
    <time data-i18n-skip datetime="${escapeHtml(item.timestamp)}">${escapeHtml(item.timestamp)}</time>
    <strong>${raw(item.summary)}</strong>
    <span>${raw(item.taskId || item.project)}</span>
    <small>${escapeHtml(t("companyBoard.source"))}: ${raw(item.sourceType)} · ${raw(item.sourceId)}</small>
  </li>`).join("")}</ol>`;
}

function renderSources(data, t) {
  const runtime = data.runtimePresence || {};
  return `<footer class="company-board-provenance">
    <div>
      <strong>${escapeHtml(t("companyBoard.refreshed"))}</strong> ${raw(data.fetchedAt)}
      <span>·</span>
      <strong>${escapeHtml(t("companyBoard.runtimePresence"))}</strong>
      <span class="company-chip">${escapeHtml(presenceLabel(runtime.state, t))}</span>
      ${runtime.lastSeen ? `${raw(runtime.host)} · ${raw(runtime.lastSeen)} · ${raw(runtime.source)}` : ""}
    </div>
    <details><summary>${escapeHtml(t("companyBoard.sources"))}</summary>
      <ul>${data.sources.map((source) => `<li>${raw(source.kind)} · ${raw(source.path)} · ${source.available ? escapeHtml(t("companyBoard.available")) : escapeHtml(t("companyBoard.unavailable"))}</li>`).join("")}</ul>
    </details>
    ${data.warnings.length ? `<details class="company-board-warning"><summary>${escapeHtml(t("companyBoard.warnings", { count: data.warnings.length }))}</summary>
      <ul>${data.warnings.map((warning) => `<li>${raw(warning.code)} ${raw(warning.taskId || warning.handoffId || warning.value || "")}</li>`).join("")}</ul>
    </details>` : ""}
  </footer>`;
}

export function renderBoardMarkup(data, {
  filters = {},
  translate = i18n,
} = {}) {
  const t = translate;
  const normalizedFilters = {
    project: filters.project || "",
    role: filters.role || "",
    task: filters.task || "",
    lane: filters.lane || "",
    handoff: filters.handoff || "",
    gate: filters.gate || "",
  };
  const view = filteredView(data, normalizedFilters);
  const taskMap = new Map(data.tasks.map((task) => [task.id, task]));

  return `
    <section class="company-board-dialog" role="dialog" aria-modal="true" aria-labelledby="company-board-title">
      <header class="company-board-header">
        <div>
          <p class="company-board-kicker">${escapeHtml(t("companyBoard.kicker"))}</p>
          <h2 id="company-board-title">${escapeHtml(t("companyBoard.title"))}</h2>
          <p>${escapeHtml(t("companyBoard.subtitle"))}</p>
        </div>
        <div class="company-board-header-actions">
          <span class="company-readonly-badge">${escapeHtml(t("companyBoard.readOnly"))}</span>
          <button type="button" data-company-board-action="refresh">${escapeHtml(t("companyBoard.refresh"))}</button>
          <button type="button" data-company-board-action="close" aria-label="${escapeHtml(t("common.close"))}">×</button>
        </div>
      </header>
      ${renderFilters(data, normalizedFilters, t)}
      ${renderSummary(data.summary, t)}
      <section class="company-board-section"><div class="company-board-section-head"><h2>${escapeHtml(t("companyBoard.roles"))}</h2><p>${escapeHtml(t("companyBoard.rolesHelp"))}</p></div>${renderRoleCards(view.roles, taskMap, t)}</section>
      <div class="company-board-split">
        <section class="company-board-section"><div class="company-board-section-head"><h2>${escapeHtml(t("companyBoard.blockers"))}</h2></div>${renderBlockers(view.blockers, t)}</section>
        <section class="company-board-section"><div class="company-board-section-head"><h2>${escapeHtml(t("companyBoard.handoffs"))}</h2></div>${renderHandoffs(view.handoffs, t)}</section>
      </div>
      <section class="company-board-section"><div class="company-board-section-head"><h2>${escapeHtml(t("companyBoard.tasks"))}</h2><p>${escapeHtml(t("companyBoard.tasksHelp"))}</p></div>${renderTaskBoard(view.tasks, t)}</section>
      <section class="company-board-section"><div class="company-board-section-head"><h2>${escapeHtml(t("companyBoard.relationships"))}</h2><p>${escapeHtml(t("companyBoard.relationshipsHelp"))}</p></div>${renderRelationships(view.relationships, t)}</section>
      <section class="company-board-section"><div class="company-board-section-head"><h2>${escapeHtml(t("companyBoard.timeline"))}</h2><p>${escapeHtml(t("companyBoard.timelineHelp"))}</p></div>${renderTimeline(view.timeline, t)}</section>
      ${renderSources(data, t)}
    </section>`;
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector('link[data-company-live-board-style="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = COMPANY_BOARD_STYLE;
  link.dataset.companyLiveBoardStyle = "true";
  document.head.append(link);
}

function installLauncher() {
  const actions = document.querySelector(".header-actions");
  if (!actions || actions.querySelector("[data-company-board-open]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "company-board-launcher";
  button.dataset.companyBoardOpen = "true";
  button.setAttribute("aria-label", i18n("companyBoard.open"));
  button.innerHTML = `<span aria-hidden="true">◎</span><span>${escapeHtml(i18n("companyBoard.launcher"))}</span>`;
  actions.prepend(button);
}

let data = null;
let loading = false;
let errorCode = "";
const filters = {
  project: "",
  role: "",
  task: "",
  lane: "",
  handoff: "",
  gate: "",
};

function backdrop() {
  return document.querySelector("#company-live-board-backdrop");
}

function renderShell() {
  const root = backdrop();
  if (!root) return;
  if (loading) {
    root.innerHTML = `<section class="company-board-dialog company-board-state" role="dialog" aria-modal="true"><strong>${escapeHtml(i18n("companyBoard.loading"))}</strong></section>`;
    return;
  }
  if (errorCode || !data) {
    root.innerHTML = `<section class="company-board-dialog company-board-state" role="dialog" aria-modal="true">
      <strong>${escapeHtml(i18n("companyBoard.errorTitle"))}</strong>
      <p>${escapeHtml(i18n(errorCode === "AUTH_REQUIRED" ? "companyBoard.errorAuth" : "companyBoard.errorUnavailable"))}</p>
      <div><button type="button" data-company-board-action="refresh">${escapeHtml(i18n("companyBoard.refresh"))}</button><button type="button" data-company-board-action="close">${escapeHtml(i18n("common.close"))}</button></div>
    </section>`;
    return;
  }
  root.innerHTML = renderBoardMarkup(data, { filters, translate: i18n });
}

async function loadBoard() {
  if (loading) return;
  loading = true;
  errorCode = "";
  renderShell();
  try {
    const response = await fetch(COMPANY_BOARD_API, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || "COMPANY_HUB_UNAVAILABLE"), { code: payload.error || "COMPANY_HUB_UNAVAILABLE" });
    data = payload;
  } catch (error) {
    errorCode = String(error?.code || "COMPANY_HUB_UNAVAILABLE");
  } finally {
    loading = false;
    renderShell();
  }
}

function openBoard() {
  const root = backdrop();
  if (!root) return;
  root.hidden = false;
  document.body.classList.add("company-board-open");
  renderShell();
  if (!data) void loadBoard();
  window.requestAnimationFrame(() => root.querySelector('[data-company-board-action="close"]')?.focus());
}

function closeBoard() {
  const root = backdrop();
  if (!root) return;
  root.hidden = true;
  document.body.classList.remove("company-board-open");
  document.querySelector("[data-company-board-open]")?.focus();
}

function install() {
  if (typeof document === "undefined" || !document.body) return;
  ensureStyles();
  installLauncher();
  if (!backdrop()) {
    const root = document.createElement("div");
    root.id = "company-live-board-backdrop";
    root.className = "company-board-backdrop";
    root.hidden = true;
    document.body.append(root);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-company-board-open]")) {
      openBoard();
      return;
    }
    const action = event.target.closest?.("[data-company-board-action]")?.dataset.companyBoardAction;
    if (action === "close") closeBoard();
    if (action === "refresh") void loadBoard();
    if (event.target === backdrop()) closeBoard();
  });

  document.addEventListener("change", (event) => {
    const control = event.target.closest?.("[data-company-board-filter]");
    if (!control) return;
    filters[control.dataset.companyBoardFilter] = control.value;
    renderShell();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && backdrop() && !backdrop().hidden) closeBoard();
  });

  window.addEventListener("joy:i18n-ready", () => {
    installLauncher();
    if (backdrop() && !backdrop().hidden) renderShell();
  });
  window.addEventListener("joy:locale-changed", () => {
    const launcher = document.querySelector("[data-company-board-open]");
    if (launcher) {
      launcher.setAttribute("aria-label", i18n("companyBoard.open"));
      const label = launcher.querySelector("span:last-child");
      if (label) label.textContent = i18n("companyBoard.launcher");
    }
    if (backdrop() && !backdrop().hidden) renderShell();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
