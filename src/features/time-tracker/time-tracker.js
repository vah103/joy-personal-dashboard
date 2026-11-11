(function installDailyTimeTracker() {
  const modal = document.getElementById("time-tracker-modal");
  if (!modal) return;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const ACTIVITIES = Object.freeze([
    { id: "sleep", hours: 8, icon: "☾" },
    { id: "chores", hours: 3, icon: "⌂" },
    { id: "income", hours: 2, icon: "▰" },
    { id: "gym", hours: 2, icon: "◈" },
    { id: "relax", hours: 1, icon: "☁" },
    { id: "thesis", hours: 4, icon: "▣" },
    { id: "english", hours: 1, icon: "Aa" },
    { id: "ai", hours: 2, icon: "✦" },
    { id: "career", hours: 1, icon: "↗" },
  ]);
  const STUDY_IDS = ["thesis", "english", "ai", "career"];
  const byId = Object.fromEntries(ACTIVITIES.map((item) => [item.id, item]));
  const view = {
    snapshot: null,
    receivedAt: 0,
    busy: false,
    syncing: false,
    lastSync: 0,
    requestSerial: 0,
    error: "",
    lastFocus: null,
  };

  const t = (key, values) => window.JoyI18n?.t?.(key, values) || key;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const formatClock = (milliseconds) => {
    const seconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((value) => String(value).padStart(2, "0")).join(":");
  };
  const formatTimeOfDay = (value) => window.JoyI18n?.formatDate?.(new Date(value), {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false,
  }) || "—";
  const q = (selector) => document.querySelector(selector);

  function currentValues() {
    const snapshot = view.snapshot;
    if (!snapshot) return null;
    const totals = { ...snapshot.totals };
    const projectedNow = snapshot.serverNow + Math.max(0, Date.now() - view.receivedAt);
    if (snapshot.activeActivity && Object.hasOwn(totals, snapshot.activeActivity)) {
      const addition = Math.max(0, Math.min(projectedNow, snapshot.dayEnd) - snapshot.serverNow);
      totals[snapshot.activeActivity] += addition;
    }
    const study = STUDY_IDS.reduce((sum, id) => sum + (totals[id] || 0), 0);
    const recorded = Object.values(totals).reduce((sum, value) => sum + value, 0);
    return { totals, study, recorded, projectedNow };
  }

  function activityCard(item, compact = false) {
    const running = view.snapshot?.activeActivity === item.id;
    const label = t(`timeTracker.${item.id}`);
    return `<button type="button" class="tt-activity tt-${item.id} ${compact ? "is-compact" : ""} ${running ? "is-running" : ""}"
      data-tt-activity="${item.id}" aria-pressed="${running}" ${view.busy || !view.snapshot ? "disabled" : ""}>
      <span class="tt-activity-top"><span class="tt-activity-icon" aria-hidden="true">${esc(item.icon)}</span><span class="tt-activity-title">${esc(label)}</span><span class="tt-state-icon" aria-hidden="true">${running ? "Ⅱ" : "▶"}</span></span>
      <strong class="tt-clock" data-tt-clock="${item.id}">00:00:00</strong>
      <span class="tt-activity-goal" data-tt-goal="${item.id}"></span>
      <span class="tt-track"><span data-tt-progress="${item.id}"></span></span>
    </button>`;
  }

  function renderCards() {
    q("[data-tt-main]").innerHTML = ACTIVITIES.filter((item) => !STUDY_IDS.includes(item.id))
      .map((item) => activityCard(item)).join("");
    q("[data-tt-thesis]").innerHTML = activityCard(byId.thesis);
    q("[data-tt-minis]").innerHTML = ACTIVITIES.filter((item) => STUDY_IDS.includes(item.id) && item.id !== "thesis")
      .map((item) => activityCard(item, true)).join("");
  }

  function renderHistory() {
    const root = q("[data-tt-history]");
    const history = view.snapshot?.history || [];
    root.innerHTML = history.length ? history.map((item) => {
      const label = t(`timeTracker.${item.activity}`);
      const period = `${formatTimeOfDay(item.startedAt)}–${formatTimeOfDay(item.endedAt)}`;
      return `<div class="tt-history-row"><span>${esc(label)}<small>${esc(period)}</small></span><strong>${formatClock(item.durationMs)}</strong></div>`;
    }).join("") : `<p class="tt-history-empty">${esc(t("timeTracker.noHistory"))}</p>`;
  }

  function renderStatus() {
    const status = q("[data-tt-status]");
    const teaser = q("[data-tt-teaser-status]");
    const message = view.error
      ? t(view.error)
      : !view.snapshot ? t("timeTracker.loading")
        : view.snapshot.activeActivity
          ? t("timeTracker.running", { activity: t(`timeTracker.${view.snapshot.activeActivity}`) })
          : t("timeTracker.paused");
    status.textContent = message;
    teaser.textContent = message;
    status.dataset.error = view.error ? "true" : "false";
  }

  function render() {
    q("[data-tt-close]")?.setAttribute("aria-label", t("common.close"));
    renderCards();
    renderHistory();
    renderStatus();
    tick();
  }

  function tick() {
    const values = currentValues();
    if (!values) return;
    q("[data-tt-today]").textContent = formatClock(values.recorded);
    q("[data-tt-teaser-total]").textContent = formatClock(values.recorded);
    q("[data-tt-unrecorded]").textContent = formatClock(Math.max(0, DAY_MS - values.recorded));
    q("[data-tt-study-total]").textContent = `${formatClock(values.study)} / 08:00:00`;
    const progress = `${Math.min(100, values.recorded / DAY_MS * 100)}%`;
    q("[data-tt-overview-progress]").style.width = progress;
    q("[data-tt-teaser-progress]").style.width = progress;
    q("[data-tt-study-progress]").style.width = `${Math.min(100, values.study / (8 * 3600000) * 100)}%`;

    for (const item of ACTIVITIES) {
      const duration = values.totals[item.id] || 0;
      const goal = item.hours * 3600000;
      q(`[data-tt-clock="${item.id}"]`).textContent = formatClock(duration);
      q(`[data-tt-goal="${item.id}"]`).textContent = duration > goal
        ? t("timeTracker.over", { time: formatClock(duration - goal) })
        : t("timeTracker.target", { time: formatClock(goal) });
      q(`[data-tt-progress="${item.id}"]`).style.width = `${Math.min(100, duration / goal * 100)}%`;
    }
    if (values.projectedNow >= view.snapshot.dayEnd && !view.syncing) void loadSnapshot();
  }

  async function loadSnapshot() {
    if (view.syncing || view.busy) return;
    view.syncing = true;
    view.lastSync = Date.now();
    const serial = view.requestSerial;
    try {
      const response = await fetch("/api/time-tracker", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "timeTracker.signIn" : "timeTracker.syncFailed");
      const snapshot = await response.json();
      if (serial !== view.requestSerial) return;
      view.snapshot = snapshot;
      view.receivedAt = Date.now();
      view.error = "";
      render();
    } catch (error) {
      if (serial !== view.requestSerial) return;
      view.error = error.message === "timeTracker.signIn" ? error.message : "timeTracker.syncFailed";
      renderStatus();
    } finally {
      view.syncing = false;
    }
  }

  async function switchTo(activity) {
    if (!view.snapshot || view.busy) return;
    const next = view.snapshot.activeActivity === activity ? null : activity;
    view.busy = true;
    view.requestSerial += 1;
    renderCards();
    tick();
    try {
      const response = await fetch("/api/time-tracker/switch", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity: next, expectedVersion: view.snapshot.version }),
      });
      const data = await response.json();
      if (response.status === 409 && data.snapshot) {
        view.snapshot = data.snapshot;
        view.error = "timeTracker.changedElsewhere";
      } else if (response.ok) {
        view.snapshot = data;
        view.error = "";
      } else {
        view.error = response.status === 401 ? "timeTracker.signIn" : "timeTracker.syncFailed";
      }
      view.receivedAt = Date.now();
      view.lastSync = Date.now();
    } catch {
      view.error = "timeTracker.syncFailed";
    } finally {
      view.busy = false;
      render();
    }
  }

  function open() {
    view.lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    render();
    q("[data-tt-close]")?.focus();
    void loadSnapshot();
  }

  function close() {
    modal.hidden = true;
    if (!document.querySelector(".modal-backdrop:not([hidden])")) document.body.classList.remove("modal-open");
    view.lastFocus?.focus?.();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-tt-open]")) { open(); return; }
    if (event.target.closest?.("[data-tt-close]")) { close(); return; }
    const activity = event.target.closest?.("[data-tt-activity]");
    if (activity) void switchTo(activity.dataset.ttActivity);
    if (event.target === modal) close();
  });
  document.addEventListener("keydown", (event) => {
    if (modal.hidden) return;
    if (event.key === "Escape") { close(); return; }
    if (event.key !== "Tab") return;
    const items = [...modal.querySelectorAll("button:not([disabled])")];
    if (!items.length) return;
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  });
  window.addEventListener("joy:locale-changed", render);
  window.addEventListener("joy:i18n-ready", render);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void loadSnapshot(); });
  setInterval(() => {
    tick();
    if (!document.hidden && Date.now() - view.lastSync > 30_000) void loadSnapshot();
  }, 1000);
  render();
  void loadSnapshot();
})();
