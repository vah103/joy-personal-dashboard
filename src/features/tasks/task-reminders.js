(function registerJoyTaskReminders(root) {
  const CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
  if (!CLOUD_BACKEND) return;

  const TIME_ZONE = "Asia/Ho_Chi_Minh";
  const TASK_STORAGE_KEY = "joy-dashboard-todos-v1";
  const REMINDER_STORAGE_KEY = "joy-dashboard-task-reminders-v1";
  const FILTER_STORAGE_KEY = "joy-dashboard-task-filter-v1";
  const WEEKDAYS = [
    { value: 1, short: "M", label: "Monday" },
    { value: 2, short: "T", label: "Tuesday" },
    { value: 3, short: "W", label: "Wednesday" },
    { value: 4, short: "T", label: "Thursday" },
    { value: 5, short: "F", label: "Friday" },
    { value: 6, short: "S", label: "Saturday" },
    { value: 7, short: "S", label: "Sunday" },
  ];

  let reminders = new Map();
  let activeFilter = readFilter();
  let composerOpen = false;
  let editingTaskId = "";
  let decorating = false;
  let syncTimer = 0;

  const elements = {};

  function setup() {
    elements.panel = document.querySelector("#to-do");
    elements.form = document.querySelector("#quick-add-form");
    elements.input = document.querySelector("#quick-task");
    elements.list = document.querySelector("#task-list");
    elements.headingActions = document.querySelector(".todo-heading-actions");
    elements.toast = document.querySelector("#toast");
    if (!elements.panel || !elements.form || !elements.input || !elements.list) return;

    reminders = readReminderStore();
    installQuickAddControls();
    installFilters();
    installTaskModal();
    installFocusModal();
    bindEvents();
    observeTaskList();
    decorateTaskRows();
    void syncReminders();
  }

  function installQuickAddControls() {
    if (document.querySelector("#joy-reminder-toggle")) return;

    const addButton = elements.form.querySelector('button[type="submit"]');
    const bell = document.createElement("button");
    bell.id = "joy-reminder-toggle";
    bell.className = "joy-reminder-toggle";
    bell.type = "button";
    bell.setAttribute("aria-label", "Add a reminder");
    bell.setAttribute("aria-expanded", "false");
    bell.innerHTML = bellSvg();
    addButton.before(bell);
    elements.bell = bell;

    const composer = document.createElement("div");
    composer.id = "joy-reminder-composer";
    composer.className = "joy-reminder-composer";
    composer.hidden = true;
    composer.innerHTML = `
      <div class="joy-reminder-fields">
        <label><span>Date</span><input id="joy-reminder-date" type="date"></label>
        <label><span>Time</span><input id="joy-reminder-time" type="time" step="60"></label>
        <label><span>Repeat</span>
          <select id="joy-reminder-repeat">
            <option value="once">Once</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
          </select>
        </label>
        <label class="joy-notify-switch">
          <span>Push</span>
          <input id="joy-reminder-notify" type="checkbox" checked>
          <i aria-hidden="true"></i>
        </label>
      </div>
      <div class="joy-weekday-picker" id="joy-reminder-weekdays" hidden>
        ${WEEKDAYS.map((day) => `<button type="button" data-weekday="${day.value}" aria-label="${day.label}" aria-pressed="false">${day.short}</button>`).join("")}
      </div>
      <p class="joy-reminder-hint" id="joy-reminder-hint">Joy will notify you at the selected time.</p>
    `;
    elements.form.insertAdjacentElement("afterend", composer);
    elements.composer = composer;
    elements.date = composer.querySelector("#joy-reminder-date");
    elements.time = composer.querySelector("#joy-reminder-time");
    elements.repeat = composer.querySelector("#joy-reminder-repeat");
    elements.notify = composer.querySelector("#joy-reminder-notify");
    elements.weekdays = composer.querySelector("#joy-reminder-weekdays");
    elements.hint = composer.querySelector("#joy-reminder-hint");
    fillDefaultSchedule();
  }

  function installFilters() {
    if (document.querySelector("#joy-task-filters")) return;

    const toolbar = document.createElement("div");
    toolbar.className = "joy-task-toolbar";
    toolbar.innerHTML = `
      <div class="joy-task-filters" id="joy-task-filters" role="tablist" aria-label="Task filters">
        <button type="button" data-task-filter="today" role="tab">Today</button>
        <button type="button" data-task-filter="upcoming" role="tab">Upcoming</button>
        <button type="button" data-task-filter="repeating" role="tab">Repeating</button>
      </div>
      <button class="joy-focus-button" id="joy-focus-button" type="button">Focus</button>
    `;
    elements.composer.insertAdjacentElement("afterend", toolbar);
    elements.toolbar = toolbar;
    elements.filters = [...toolbar.querySelectorAll("[data-task-filter]")];
    elements.focusButton = toolbar.querySelector("#joy-focus-button");
    updateFilterButtons();
  }

  function installTaskModal() {
    if (document.querySelector("#joy-task-modal")) return;
    const modal = document.createElement("div");
    modal.className = "modal-backdrop joy-task-modal-backdrop";
    modal.id = "joy-task-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="modal joy-task-modal" role="dialog" aria-modal="true" aria-labelledby="joy-task-modal-title">
        <div class="modal-heading">
          <div><p class="section-kicker">Joy Tasks</p><h2 id="joy-task-modal-title">Task reminder</h2></div>
          <button class="joy-modal-close" type="button" data-joy-close-task aria-label="Close task reminder">×</button>
        </div>
        <form id="joy-task-detail-form">
          <label class="joy-task-title-field"><span>Task</span><input id="joy-task-detail-title" type="text" maxlength="500" required></label>
          <div class="joy-task-detail-grid">
            <label><span>Date</span><input id="joy-task-detail-date" type="date" required></label>
            <label><span>Time</span><input id="joy-task-detail-time" type="time" step="60" required></label>
            <label><span>Repeat</span>
              <select id="joy-task-detail-repeat">
                <option value="once">Once</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
            </label>
            <label class="joy-notify-switch joy-detail-notify"><span>Push</span><input id="joy-task-detail-notify" type="checkbox" checked><i aria-hidden="true"></i></label>
          </div>
          <div class="joy-weekday-picker" id="joy-task-detail-weekdays" hidden>
            ${WEEKDAYS.map((day) => `<button type="button" data-detail-weekday="${day.value}" aria-label="${day.label}" aria-pressed="false">${day.short}</button>`).join("")}
          </div>
          <p class="joy-task-status" id="joy-task-detail-status"></p>
          <div class="joy-snooze-actions" id="joy-snooze-actions">
            <span>Snooze</span>
            <button type="button" data-snooze-minutes="10">10 min</button>
            <button type="button" data-snooze-minutes="60">1 hour</button>
            <button type="button" data-snooze-minutes="1440">Tomorrow</button>
          </div>
          <div class="joy-task-modal-actions">
            <button class="joy-danger-link" type="button" id="joy-delete-task">Delete</button>
            <button class="joy-secondary-link" type="button" id="joy-remove-reminder">Turn off reminder</button>
            <button class="primary-button" type="submit">Save</button>
          </div>
        </form>
      </section>
    `;
    document.body.append(modal);
    elements.taskModal = modal;
    elements.taskDetailForm = modal.querySelector("#joy-task-detail-form");
    elements.taskDetailTitle = modal.querySelector("#joy-task-detail-title");
    elements.taskDetailDate = modal.querySelector("#joy-task-detail-date");
    elements.taskDetailTime = modal.querySelector("#joy-task-detail-time");
    elements.taskDetailRepeat = modal.querySelector("#joy-task-detail-repeat");
    elements.taskDetailNotify = modal.querySelector("#joy-task-detail-notify");
    elements.taskDetailWeekdays = modal.querySelector("#joy-task-detail-weekdays");
    elements.taskDetailStatus = modal.querySelector("#joy-task-detail-status");
    elements.snoozeActions = modal.querySelector("#joy-snooze-actions");
    elements.removeReminder = modal.querySelector("#joy-remove-reminder");
    elements.deleteTask = modal.querySelector("#joy-delete-task");
  }

  function installFocusModal() {
    if (document.querySelector("#joy-focus-modal")) return;
    const modal = document.createElement("div");
    modal.className = "modal-backdrop joy-focus-modal-backdrop";
    modal.id = "joy-focus-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="modal joy-focus-modal" role="dialog" aria-modal="true" aria-labelledby="joy-focus-title">
        <div class="modal-heading">
          <div><p class="section-kicker">Joy Tasks</p><h2 id="joy-focus-title">Focus reminders</h2></div>
          <button class="joy-modal-close" type="button" data-joy-close-focus aria-label="Close focus reminders">×</button>
        </div>
        <form id="joy-focus-form">
          <label class="joy-focus-enabled"><span><strong>Random focus reminders</strong><small>Gentle notifications inside your active hours</small></span><input id="joy-focus-enabled" type="checkbox"><i aria-hidden="true"></i></label>
          <label><span>Message</span><input id="joy-focus-message" type="text" maxlength="200" value="Stay focused"></label>
          <div class="joy-focus-grid">
            <label><span>Start</span><input id="joy-focus-start" type="time" value="08:00"></label>
            <label><span>End</span><input id="joy-focus-end" type="time" value="23:30"></label>
            <label><span>Min minutes</span><input id="joy-focus-min" type="number" min="5" max="1440" value="60"></label>
            <label><span>Max minutes</span><input id="joy-focus-max" type="number" min="5" max="1440" value="180"></label>
          </div>
          <p class="joy-focus-next" id="joy-focus-next">Focus reminders are off.</p>
          <div class="modal-actions"><button class="secondary-button" type="button" data-joy-close-focus>Cancel</button><button class="primary-button" type="submit">Save focus</button></div>
        </form>
      </section>
    `;
    document.body.append(modal);
    elements.focusModal = modal;
    elements.focusForm = modal.querySelector("#joy-focus-form");
    elements.focusEnabled = modal.querySelector("#joy-focus-enabled");
    elements.focusMessage = modal.querySelector("#joy-focus-message");
    elements.focusStart = modal.querySelector("#joy-focus-start");
    elements.focusEnd = modal.querySelector("#joy-focus-end");
    elements.focusMin = modal.querySelector("#joy-focus-min");
    elements.focusMax = modal.querySelector("#joy-focus-max");
    elements.focusNext = modal.querySelector("#joy-focus-next");
  }

  function bindEvents() {
    elements.bell.addEventListener("click", () => setComposerOpen(!composerOpen));
    elements.repeat.addEventListener("change", () => toggleWeekdayPicker(elements.repeat, elements.weekdays));
    elements.taskDetailRepeat.addEventListener("change", () => toggleWeekdayPicker(elements.taskDetailRepeat, elements.taskDetailWeekdays));

    elements.weekdays.addEventListener("click", (event) => toggleWeekdayButton(event, "weekday"));
    elements.taskDetailWeekdays.addEventListener("click", (event) => toggleWeekdayButton(event, "detailWeekday"));

    elements.form.addEventListener("submit", handleQuickAdd, true);
    elements.filters.forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.taskFilter)));
    elements.focusButton.addEventListener("click", openFocusModal);

    elements.list.addEventListener("click", (event) => {
      if (event.target.closest('input[type="checkbox"], button, a')) return;
      const row = event.target.closest(".task-row");
      const taskId = row?.querySelector("input[data-task-id]")?.dataset.taskId;
      if (taskId) openTaskModal(taskId);
    });

    elements.taskDetailForm.addEventListener("submit", saveTaskDetails);
    elements.removeReminder.addEventListener("click", removeCurrentReminder);
    elements.deleteTask.addEventListener("click", deleteCurrentTask);
    elements.snoozeActions.addEventListener("click", handleSnoozeClick);
    elements.focusForm.addEventListener("submit", saveFocusSettings);

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-joy-close-task]")) closeTaskModal();
      if (event.target.closest("[data-joy-close-focus]")) closeFocusModal();
      if (event.target === elements.taskModal) closeTaskModal();
      if (event.target === elements.focusModal) closeFocusModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!elements.taskModal.hidden) closeTaskModal();
      else if (!elements.focusModal.hidden) closeFocusModal();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void syncReminders();
    });
  }

  function observeTaskList() {
    new MutationObserver(() => {
      if (decorating) return;
      root.clearTimeout(syncTimer);
      syncTimer = root.setTimeout(decorateTaskRows, 0);
    }).observe(elements.list, { childList: true, subtree: true });
  }

  async function handleQuickAdd(event) {
    const rawText = elements.input.value.trim();
    if (!rawText) return;
    const parsed = parseNaturalTask(rawText);
    const shouldHandle = composerOpen || parsed.intent;
    if (!shouldHandle) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!composerOpen && parsed.intent && !parsed.complete) {
      setComposerOpen(true);
      applyParsedSchedule(parsed);
      elements.hint.textContent = "Choose a time so Joy knows exactly when to remind you.";
      elements.time.focus();
      return;
    }

    const title = (parsed.title || rawText).trim();
    const dueAt = parsed.complete && !composerOpen
      ? parsed.dueAt
      : scheduleTimestamp(elements.date.value, elements.time.value);
    const repeatType = parsed.complete && !composerOpen ? parsed.repeatType : elements.repeat.value;
    const repeatDays = parsed.complete && !composerOpen
      ? parsed.repeatDays
      : selectedWeekdays(elements.weekdays, "weekday");

    if (!title || !Number.isFinite(dueAt)) {
      showMessage("Choose a valid date and time");
      return;
    }
    if (repeatType === "weekly" && !repeatDays.length) {
      showMessage("Choose at least one weekday");
      return;
    }

    await createReminderTask({
      title,
      dueAt,
      repeatType,
      repeatDays,
      notificationEnabled: elements.notify.checked,
    });
  }

  async function createReminderTask(input) {
    const taskId = createId();
    const now = new Date();
    const task = {
      id: taskId,
      title: input.title,
      createdDate: vietnamDateKey(now),
      createdAt: now.toISOString(),
      done: false,
      completedAt: null,
    };
    const meta = normalizeLocalReminder({
      taskId,
      dueAt: new Date(input.dueAt).toISOString(),
      repeatType: input.repeatType,
      repeatDays: input.repeatDays,
      notificationEnabled: input.notificationEnabled,
      status: "scheduled",
      dirty: true,
      updatedAt: now.toISOString(),
    });

    saveTasks([...readTasks(), task]);
    saveLocalReminder(meta);
    elements.input.value = "";
    setComposerOpen(false);
    showMessage("Reminder saved · syncing");

    try {
      await request("/api/tasks", { method: "POST", body: JSON.stringify(task) });
      const payload = await request("/api/task-reminders", {
        method: "POST",
        body: JSON.stringify(reminderToRequest(meta)),
      });
      if (payload.reminder) saveLocalReminder({ ...payload.reminder, dirty: false });
      showMessage("Reminder saved");
    } catch {
      showMessage("Saved here · it will sync when Joy is online");
    }
    root.location.reload();
  }

  async function syncReminders() {
    try {
      const local = readReminderStore();
      for (const meta of local.values()) {
        if (!meta.dirty) continue;
        const task = findTask(meta.taskId);
        if (!task) continue;
        try {
          await request("/api/tasks", { method: "POST", body: JSON.stringify(task) });
        } catch (error) {
          if (error.status !== 409) throw error;
        }
        try {
          const saved = await request("/api/task-reminders", {
            method: "POST",
            body: JSON.stringify(reminderToRequest(meta)),
          });
          if (saved.reminder) local.set(meta.taskId, normalizeLocalReminder({ ...saved.reminder, dirty: false }));
        } catch {
          // Keep the dirty local reminder for the next sync.
        }
      }

      const payload = await request("/api/task-reminders");
      const cloud = new Map((payload.reminders || [])
        .map((item) => [String(item.taskId), normalizeLocalReminder({ ...item, dirty: false })]));
      const merged = new Map();
      for (const [taskId, meta] of local) {
        if (meta.dirty) merged.set(taskId, meta);
      }
      for (const [taskId, meta] of cloud) {
        if (!merged.has(taskId)) merged.set(taskId, meta);
      }
      reminders = merged;
      writeReminderStore(reminders);
      decorateTaskRows();
    } catch {
      reminders = readReminderStore();
      decorateTaskRows();
    }
  }

  function decorateTaskRows() {
    if (decorating) return;
    decorating = true;
    try {
      const tasks = new Map(readTasks().map((task) => [String(task.id), task]));
      elements.list.querySelectorAll(".task-row").forEach((row) => {
        const input = row.querySelector("input[data-task-id]");
        const taskId = String(input?.dataset.taskId || "");
        if (!taskId) return;
        row.dataset.joyTaskId = taskId;
        row.classList.add("joy-task-row");
        const task = tasks.get(taskId);
        const meta = reminders.get(taskId);
        let metaLine = row.querySelector(".joy-task-meta");
        if (meta) {
          if (!metaLine) {
            metaLine = document.createElement("span");
            metaLine.className = "joy-task-meta";
            row.append(metaLine);
          }
          metaLine.textContent = reminderLabel(meta);
          metaLine.dataset.state = reminderState(meta);
          row.classList.toggle("joy-task-repeating", meta.repeatType !== "once");
          row.classList.toggle("joy-task-overdue", reminderState(meta) === "overdue");
        } else {
          metaLine?.remove();
          row.classList.remove("joy-task-repeating", "joy-task-overdue");
        }
        if (task?.done) row.classList.add("completed");
      });
      applyFilter();
    } finally {
      decorating = false;
    }
  }

  function setFilter(filter) {
    activeFilter = ["today", "upcoming", "repeating"].includes(filter) ? filter : "today";
    root.localStorage.setItem(FILTER_STORAGE_KEY, activeFilter);
    updateFilterButtons();
    applyFilter();
  }

  function readFilter() {
    try {
      const value = root.localStorage.getItem(FILTER_STORAGE_KEY);
      return ["today", "upcoming", "repeating"].includes(value) ? value : "today";
    } catch {
      return "today";
    }
  }

  function updateFilterButtons() {
    (elements.filters || []).forEach((button) => {
      const active = button.dataset.taskFilter === activeFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function applyFilter() {
    const endToday = endOfVietnamDay(Date.now());
    let visibleCount = 0;
    elements.list.querySelectorAll(".task-row").forEach((row) => {
      const taskId = row.dataset.joyTaskId || row.querySelector("input[data-task-id]")?.dataset.taskId;
      const meta = reminders.get(String(taskId));
      let visible = true;
      if (activeFilter === "upcoming") visible = Boolean(meta && effectiveDue(meta) > endToday);
      if (activeFilter === "repeating") visible = Boolean(meta && meta.repeatType !== "once");
      if (activeFilter === "today") visible = !meta || effectiveDue(meta) <= endToday;
      row.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    let empty = elements.list.querySelector(".joy-filter-empty");
    if (!visibleCount && elements.list.querySelector(".task-row")) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "task-empty joy-filter-empty";
        elements.list.append(empty);
      }
      empty.innerHTML = activeFilter === "upcoming"
        ? "<strong>No upcoming reminders</strong><span>Your future reminders will appear here.</span>"
        : activeFilter === "repeating"
          ? "<strong>No repeating tasks</strong><span>Choose daily or weekly when adding a reminder.</span>"
          : "<strong>Nothing due today</strong><span>You are clear for now.</span>";
    } else {
      empty?.remove();
    }
  }

  function openTaskModal(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    const meta = reminders.get(String(taskId));
    editingTaskId = String(taskId);
    elements.taskDetailTitle.value = String(task.title || "");

    if (meta) {
      const due = vietnamInputParts(effectiveDue(meta));
      elements.taskDetailDate.value = due.date;
      elements.taskDetailTime.value = due.time;
      elements.taskDetailRepeat.value = meta.repeatType;
      elements.taskDetailNotify.checked = meta.notificationEnabled;
      setSelectedWeekdays(elements.taskDetailWeekdays, "detailWeekday", meta.repeatDays);
      elements.taskDetailStatus.textContent = reminderLabel(meta);
      elements.removeReminder.hidden = false;
      elements.snoozeActions.hidden = task.done;
    } else {
      const defaults = defaultSchedule();
      elements.taskDetailDate.value = defaults.date;
      elements.taskDetailTime.value = defaults.time;
      elements.taskDetailRepeat.value = "once";
      elements.taskDetailNotify.checked = true;
      setSelectedWeekdays(elements.taskDetailWeekdays, "detailWeekday", []);
      elements.taskDetailStatus.textContent = "This is a normal task. Save to add a reminder.";
      elements.removeReminder.hidden = true;
      elements.snoozeActions.hidden = true;
    }

    toggleWeekdayPicker(elements.taskDetailRepeat, elements.taskDetailWeekdays);
    elements.taskModal.hidden = false;
    document.body.classList.add("modal-open");
    root.setTimeout(() => elements.taskDetailTitle.focus(), 0);
  }

  function closeTaskModal() {
    editingTaskId = "";
    elements.taskModal.hidden = true;
    releaseModalLock();
  }

  async function saveTaskDetails(event) {
    event.preventDefault();
    const taskId = editingTaskId;
    const task = findTask(taskId);
    if (!task) return;
    const title = elements.taskDetailTitle.value.trim();
    const dueAt = scheduleTimestamp(elements.taskDetailDate.value, elements.taskDetailTime.value);
    const repeatType = elements.taskDetailRepeat.value;
    const repeatDays = selectedWeekdays(elements.taskDetailWeekdays, "detailWeekday");
    if (!title || !Number.isFinite(dueAt)) return showMessage("Choose a valid task, date and time");
    if (repeatType === "weekly" && !repeatDays.length) return showMessage("Choose at least one weekday");

    updateLocalTask(taskId, { title });
    const existing = reminders.get(taskId);
    const meta = normalizeLocalReminder({
      ...(existing || {}),
      taskId,
      dueAt: new Date(dueAt).toISOString(),
      repeatType,
      repeatDays,
      notificationEnabled: elements.taskDetailNotify.checked,
      snoozedUntil: null,
      status: "scheduled",
      dirty: true,
      updatedAt: new Date().toISOString(),
    });
    saveLocalReminder(meta);
    showMessage("Saving reminder…");

    try {
      const payload = existing
        ? await request("/api/task-reminders", {
            method: "PATCH",
            body: JSON.stringify({ ...reminderToRequest(meta), title }),
          })
        : await request("/api/task-reminders", {
            method: "POST",
            body: JSON.stringify(reminderToRequest(meta)),
          });
      if (existing && title !== task.title && !payload.reminder) throw new Error("TASK_UPDATE_FAILED");
      if (!existing && title !== task.title) {
        await request("/api/task-reminders", {
          method: "PATCH",
          body: JSON.stringify({ ...reminderToRequest(meta), title }),
        });
      }
      if (payload.reminder) saveLocalReminder({ ...payload.reminder, dirty: false });
      showMessage("Reminder updated");
    } catch {
      showMessage("Saved here · it will sync when Joy is online");
    }
    closeTaskModal();
    root.location.reload();
  }

  async function removeCurrentReminder() {
    const taskId = editingTaskId;
    if (!taskId || !reminders.has(taskId)) return;
    reminders.delete(taskId);
    writeReminderStore(reminders);
    try {
      await request("/api/task-reminders", { method: "DELETE", body: JSON.stringify({ taskId }) });
      showMessage("Reminder turned off");
    } catch {
      showMessage("Reminder hidden here");
    }
    closeTaskModal();
    root.location.reload();
  }

  async function deleteCurrentTask() {
    const taskId = editingTaskId;
    const task = findTask(taskId);
    if (!task || !root.confirm(`Delete “${task.title}”?`)) return;
    saveTasks(readTasks().filter((item) => String(item.id) !== taskId));
    reminders.delete(taskId);
    writeReminderStore(reminders);
    try {
      await request("/api/tasks/delete", { method: "POST", body: JSON.stringify({ id: taskId }) });
      showMessage("Task deleted");
    } catch {
      showMessage("Task deleted here");
    }
    closeTaskModal();
    root.location.reload();
  }

  async function handleSnoozeClick(event) {
    const button = event.target.closest("[data-snooze-minutes]");
    if (!button || !editingTaskId) return;
    const minutes = Number(button.dataset.snoozeMinutes);
    const meta = reminders.get(editingTaskId);
    if (!meta) return;
    const snoozedUntil = Date.now() + minutes * 60_000;
    saveLocalReminder({ ...meta, snoozedUntil: new Date(snoozedUntil).toISOString(), status: "scheduled", dirty: false });
    try {
      await request("/api/task-reminders/action", {
        method: "POST",
        body: JSON.stringify({ taskId: editingTaskId, action: "snooze", minutes }),
      });
      showMessage(minutes === 1440 ? "Snoozed until tomorrow" : `Snoozed for ${minutes < 60 ? `${minutes} minutes` : "1 hour"}`);
    } catch {
      showMessage("Could not snooze this reminder");
    }
    closeTaskModal();
    root.location.reload();
  }

  async function openFocusModal() {
    elements.focusModal.hidden = false;
    document.body.classList.add("modal-open");
    elements.focusNext.textContent = "Checking focus settings…";
    try {
      const payload = await request("/api/focus-reminder");
      const focus = payload.focus || {};
      elements.focusEnabled.checked = Boolean(focus.enabled);
      elements.focusMessage.value = focus.message || "Stay focused";
      elements.focusStart.value = focus.startTime || "08:00";
      elements.focusEnd.value = focus.endTime || "23:30";
      elements.focusMin.value = Number(focus.minMinutes || 60);
      elements.focusMax.value = Number(focus.maxMinutes || 180);
      elements.focusNext.textContent = focus.enabled && focus.nextAt
        ? `Next reminder: ${formatFullDateTime(Date.parse(focus.nextAt))}`
        : "Focus reminders are off.";
      elements.focusButton.classList.toggle("active", Boolean(focus.enabled));
    } catch {
      elements.focusNext.textContent = "Focus settings are temporarily unavailable.";
    }
  }

  function closeFocusModal() {
    elements.focusModal.hidden = true;
    releaseModalLock();
  }

  async function saveFocusSettings(event) {
    event.preventDefault();
    const minMinutes = Number(elements.focusMin.value);
    const maxMinutes = Number(elements.focusMax.value);
    if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes) || maxMinutes < minMinutes) {
      return showMessage("Max minutes must be greater than min minutes");
    }
    try {
      const payload = await request("/api/focus-reminder", {
        method: "PUT",
        body: JSON.stringify({
          enabled: elements.focusEnabled.checked,
          message: elements.focusMessage.value.trim() || "Stay focused",
          startTime: elements.focusStart.value,
          endTime: elements.focusEnd.value,
          minMinutes,
          maxMinutes,
        }),
      });
      elements.focusButton.classList.toggle("active", Boolean(payload.focus?.enabled));
      showMessage(payload.focus?.enabled ? "Focus reminders are on" : "Focus reminders are off");
      closeFocusModal();
    } catch {
      showMessage("Focus settings could not be saved");
    }
  }

  function releaseModalLock() {
    if (document.querySelector('.modal-backdrop:not([hidden])')) return;
    document.body.classList.remove("modal-open");
  }

  function setComposerOpen(open) {
    composerOpen = Boolean(open);
    elements.composer.hidden = !composerOpen;
    elements.bell.classList.toggle("active", composerOpen);
    elements.bell.setAttribute("aria-expanded", String(composerOpen));
    if (composerOpen) {
      fillDefaultSchedule();
      elements.hint.textContent = Notification.permission === "granted"
        ? "Joy will notify you at the selected time."
        : "Set the time now. Enable Joy notifications from the wolf menu to receive push alerts.";
    }
  }

  function fillDefaultSchedule() {
    const defaults = defaultSchedule();
    elements.date.value = defaults.date;
    elements.time.value = defaults.time;
    elements.repeat.value = "once";
    elements.notify.checked = true;
    setSelectedWeekdays(elements.weekdays, "weekday", []);
    toggleWeekdayPicker(elements.repeat, elements.weekdays);
  }

  function applyParsedSchedule(parsed) {
    if (Number.isFinite(parsed.dueAt)) {
      const values = vietnamInputParts(parsed.dueAt);
      elements.date.value = values.date;
      elements.time.value = values.time;
    }
    elements.repeat.value = parsed.repeatType || "once";
    setSelectedWeekdays(elements.weekdays, "weekday", parsed.repeatDays || []);
    toggleWeekdayPicker(elements.repeat, elements.weekdays);
  }

  function toggleWeekdayPicker(select, picker) {
    picker.hidden = select.value !== "weekly";
  }

  function toggleWeekdayButton(event, datasetKey) {
    const selector = datasetKey === "weekday" ? "[data-weekday]" : "[data-detail-weekday]";
    const button = event.target.closest(selector);
    if (!button) return;
    const active = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("active", active);
  }

  function selectedWeekdays(container, datasetKey) {
    const selector = datasetKey === "weekday" ? "[data-weekday]" : "[data-detail-weekday]";
    return [...container.querySelectorAll(`${selector}[aria-pressed="true"]`)]
      .map((button) => Number(datasetKey === "weekday" ? button.dataset.weekday : button.dataset.detailWeekday))
      .filter((value) => value >= 1 && value <= 7);
  }

  function setSelectedWeekdays(container, datasetKey, values) {
    const selected = new Set((values || []).map(Number));
    const selector = datasetKey === "weekday" ? "[data-weekday]" : "[data-detail-weekday]";
    container.querySelectorAll(selector).forEach((button) => {
      const value = Number(datasetKey === "weekday" ? button.dataset.weekday : button.dataset.detailWeekday);
      const active = selected.has(value);
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("active", active);
    });
  }

  function parseNaturalTask(rawText) {
    const original = String(rawText || "").trim();
    const plain = removeTones(original.toLowerCase());
    const reminderWords = /\b(nhac|remind|reminder)\b/.test(plain);
    const daily = /\b(hang ngay|moi ngay|ngay nao cung|every day|daily)\b/.test(plain);
    const weekly = /\b(hang tuan|moi tuan|tuan nao cung|every week|weekly)\b/.test(plain);
    const repeatType = daily ? "daily" : weekly ? "weekly" : "once";
    const repeatDays = parseWeekdays(plain);

    const relative = parseRelativeMinutes(plain);
    let dueAt = Number.isFinite(relative) ? Date.now() + relative * 60_000 : NaN;
    let dateKey = parseNaturalDate(plain);
    const time = parseNaturalTime(plain);
    if (!Number.isFinite(dueAt) && time) {
      if (!dateKey) {
        const candidate = scheduleTimestamp(vietnamDateKey(), time);
        dateKey = candidate > Date.now() ? vietnamDateKey() : addVietnamDays(vietnamDateKey(), 1);
      }
      dueAt = scheduleTimestamp(dateKey, time);
    }

    if (!Number.isFinite(dueAt) && repeatType !== "once" && time) {
      dueAt = scheduleTimestamp(dateKey || vietnamDateKey(), time);
      if (dueAt <= Date.now()) dueAt += 24 * 60 * 60 * 1000;
    }

    const vagueTime = /\b(ti nua|lat nua|chieu|toi nay|this evening|later)\b/.test(plain) && !time && !Number.isFinite(relative);
    const intent = reminderWords
      || daily
      || weekly
      || Number.isFinite(relative)
      || Boolean(time && (dateKey || /\b(hom nay|mai|mot|today|tomorrow|thu|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(plain)))
      || vagueTime;

    return {
      intent,
      complete: intent && Number.isFinite(dueAt),
      dueAt,
      repeatType,
      repeatDays,
      title: cleanNaturalTitle(original),
    };
  }

  function parseRelativeMinutes(text) {
    if (/\b(nua tieng|half an hour)\b/.test(text)) return 30;
    let match = text.match(/(\d+(?:[.,]\d+)?)\s*(phut|p|min|mins|minute|minutes)\s*(nua|later|from now)?/);
    if (match && /\b(nua|later|from now)\b/.test(match[0])) return Math.round(Number(match[1].replace(",", ".")));
    match = text.match(/(\d+(?:[.,]\d+)?)\s*(tieng|gio|hour|hours|h)\s*(ruoi)?\s*(nua|later|from now)?/);
    if (match && /\b(nua|later|from now)\b/.test(match[0])) {
      return Math.round(Number(match[1].replace(",", ".")) * 60 + (match[3] ? 30 : 0));
    }
    return NaN;
  }

  function parseNaturalTime(text) {
    let match = text.match(/\b([01]?\d|2[0-3])\s*(?:h|gio|:)(?:\s*([0-5]?\d))?\s*(sang|chieu|toi|am|pm)?\b/);
    if (!match) match = text.match(/\b([1-9]|1[0-2])\s*(sang|chieu|toi|am|pm)\b/);
    if (!match) return "";
    let hour = Number(match[1]);
    let minute = 0;
    let daypart = "";
    if (match.length >= 4) {
      minute = match[2] && /^\d+$/.test(match[2]) ? Number(match[2]) : 0;
      daypart = match[3] || (match[2] && !/^\d+$/.test(match[2]) ? match[2] : "");
    } else {
      daypart = match[2] || "";
    }
    if (["chieu", "toi", "pm"].includes(daypart) && hour < 12) hour += 12;
    if (["sang", "am"].includes(daypart) && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return "";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function parseNaturalDate(text) {
    if (/\b(hom nay|today)\b/.test(text)) return vietnamDateKey();
    if (/\b(ngay mai|mai|tomorrow)\b/.test(text)) return addVietnamDays(vietnamDateKey(), 1);
    if (/\b(ngay kia|mot|day after tomorrow)\b/.test(text)) return addVietnamDays(vietnamDateKey(), 2);

    const explicit = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if (explicit) {
      const nowYear = Number(vietnamDateKey().slice(0, 4));
      let year = Number(explicit[3] || nowYear);
      if (year < 100) year += 2000;
      return `${year}-${String(Number(explicit[2])).padStart(2, "0")}-${String(Number(explicit[1])).padStart(2, "0")}`;
    }

    const weekdays = [
      [1, /\b(thu 2|thu hai|monday)\b/],
      [2, /\b(thu 3|thu ba|tuesday)\b/],
      [3, /\b(thu 4|thu tu|wednesday)\b/],
      [4, /\b(thu 5|thu nam|thursday)\b/],
      [5, /\b(thu 6|thu sau|friday)\b/],
      [6, /\b(thu 7|thu bay|saturday)\b/],
      [7, /\b(chu nhat|sunday)\b/],
    ];
    const matched = weekdays.find(([, pattern]) => pattern.test(text));
    return matched ? nextWeekdayDate(matched[0]) : "";
  }

  function parseWeekdays(text) {
    const result = [];
    const patterns = [
      [1, /\b(thu 2|thu hai|monday)\b/],
      [2, /\b(thu 3|thu ba|tuesday)\b/],
      [3, /\b(thu 4|thu tu|wednesday)\b/],
      [4, /\b(thu 5|thu nam|thursday)\b/],
      [5, /\b(thu 6|thu sau|friday)\b/],
      [6, /\b(thu 7|thu bay|saturday)\b/],
      [7, /\b(chu nhat|sunday)\b/],
    ];
    patterns.forEach(([day, pattern]) => { if (pattern.test(text)) result.push(day); });
    return result;
  }

  function cleanNaturalTitle(text) {
    let title = String(text || "")
      .replace(/\b(nhắc|nhac|remind)\s+(tôi|toi|me)\s*/gi, "")
      .replace(/\b(hằng ngày|hang ngay|mỗi ngày|moi ngay|every day|daily|hằng tuần|hang tuan|mỗi tuần|moi tuan|every week|weekly)\b/gi, "")
      .replace(/\b(hôm nay|hom nay|ngày mai|ngay mai|mai|ngày kia|ngay kia|mốt|mot|today|tomorrow)\b/gi, "")
      .replace(/\b(thứ\s*[2-7]|thu\s*[2-7]|thứ hai|thu hai|thứ ba|thu ba|thứ tư|thu tu|thứ năm|thu nam|thứ sáu|thu sau|thứ bảy|thu bay|chủ nhật|chu nhat|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
      .replace(/\b\d+(?:[.,]\d+)?\s*(phút|phut|p|min|mins|minute|minutes|tiếng|tieng|giờ|gio|hour|hours|h)(?:\s*rưỡi|\s*ruoi)?\s*(nữa|nua|later|from now)?\b/gi, "")
      .replace(/\b([01]?\d|2[0-3])\s*(h|giờ|gio|:)(?:\s*[0-5]?\d)?\s*(sáng|sang|chiều|chieu|tối|toi|am|pm)?\b/gi, "")
      .replace(/\b([1-9]|1[0-2])\s*(sáng|sang|chiều|chieu|tối|toi|am|pm)\b/gi, "")
      .replace(/\b(vào|vao|lúc|luc|at|on)\b/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "")
      .trim();
    return title || String(text || "").trim();
  }

  function reminderLabel(meta) {
    const due = effectiveDue(meta);
    const state = reminderState(meta);
    const time = formatTime(due);
    if (meta.snoozedUntil && Date.parse(meta.snoozedUntil) > Date.now()) return `⏰ Snoozed until ${formatFullDateTime(due)}`;
    if (meta.repeatType === "daily") return `↻ Every day · ${time}`;
    if (meta.repeatType === "weekly") {
      const days = (meta.repeatDays || []).map((day) => WEEKDAYS[day - 1]?.label.slice(0, 3)).filter(Boolean).join(", ");
      return `↻ ${days || "Every week"} · ${time}`;
    }
    if (state === "overdue") return `⚠ Overdue · ${formatFullDateTime(due)}`;
    return `🔔 ${friendlyDate(due)} · ${time}`;
  }

  function reminderState(meta) {
    if (meta.snoozedUntil && Date.parse(meta.snoozedUntil) > Date.now()) return "snoozed";
    if (meta.repeatType === "once" && effectiveDue(meta) < Date.now()) return "overdue";
    if (meta.repeatType !== "once") return "repeating";
    return "scheduled";
  }

  function effectiveDue(meta) {
    const snoozed = Date.parse(meta?.snoozedUntil || "");
    return Number.isFinite(snoozed) && snoozed > Date.now() ? snoozed : Date.parse(meta?.dueAt || "");
  }

  function normalizeLocalReminder(value) {
    return {
      taskId: String(value?.taskId || ""),
      dueAt: new Date(Date.parse(value?.dueAt || "") || Date.now()).toISOString(),
      repeatType: ["daily", "weekly"].includes(value?.repeatType) ? value.repeatType : "once",
      repeatDays: [...new Set((value?.repeatDays || []).map(Number).filter((day) => day >= 1 && day <= 7))].sort((a, b) => a - b),
      notificationEnabled: value?.notificationEnabled !== false,
      snoozedUntil: value?.snoozedUntil || null,
      lastNotifiedAt: value?.lastNotifiedAt || null,
      status: String(value?.status || "scheduled"),
      dirty: Boolean(value?.dirty),
      updatedAt: value?.updatedAt || new Date().toISOString(),
    };
  }

  function reminderToRequest(meta) {
    return {
      taskId: meta.taskId,
      dueAt: meta.dueAt,
      repeatType: meta.repeatType,
      repeatDays: meta.repeatDays,
      notificationEnabled: meta.notificationEnabled,
    };
  }

  function readReminderStore() {
    try {
      const value = JSON.parse(root.localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
      const list = Array.isArray(value) ? value : Object.values(value || {});
      return new Map(list.map(normalizeLocalReminder).filter((item) => item.taskId).map((item) => [item.taskId, item]));
    } catch {
      return new Map();
    }
  }

  function writeReminderStore(store) {
    reminders = store instanceof Map ? store : reminders;
    root.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify([...reminders.values()]));
  }

  function saveLocalReminder(value) {
    const meta = normalizeLocalReminder(value);
    reminders.set(meta.taskId, meta);
    writeReminderStore(reminders);
  }

  function readTasks() {
    try {
      const tasks = JSON.parse(root.localStorage.getItem(TASK_STORAGE_KEY) || "[]");
      return Array.isArray(tasks) ? tasks : [];
    } catch {
      return [];
    }
  }

  function saveTasks(tasks) {
    root.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  }

  function findTask(taskId) {
    return readTasks().find((task) => String(task?.id) === String(taskId));
  }

  function updateLocalTask(taskId, patch) {
    saveTasks(readTasks().map((task) => String(task?.id) === String(taskId) ? { ...task, ...patch } : task));
  }

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await root.fetch(path, { ...options, headers, credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `REQUEST_FAILED_${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function defaultSchedule() {
    const now = Date.now();
    const next = new Date(Math.ceil((now + 10 * 60_000) / (30 * 60_000)) * 30 * 60_000);
    return vietnamInputParts(next.getTime());
  }

  function scheduleTimestamp(date, time) {
    const parsed = Date.parse(`${date}T${time}:00+07:00`);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function vietnamInputParts(timestamp) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(timestamp)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }

  function vietnamDateKey(value = new Date()) {
    return vietnamInputParts(value instanceof Date ? value.getTime() : value).date;
  }

  function addVietnamDays(dateKey, days) {
    const timestamp = Date.parse(`${dateKey}T12:00:00+07:00`) + Number(days) * 24 * 60 * 60 * 1000;
    return vietnamDateKey(timestamp);
  }

  function nextWeekdayDate(targetDay) {
    const today = vietnamDateKey();
    const current = new Date(`${today}T12:00:00+07:00`).getUTCDay();
    const currentIso = current === 0 ? 7 : current;
    let delta = targetDay - currentIso;
    if (delta < 0) delta += 7;
    return addVietnamDays(today, delta);
  }

  function endOfVietnamDay(timestamp) {
    const date = vietnamDateKey(timestamp);
    return Date.parse(`${date}T23:59:59.999+07:00`);
  }

  function friendlyDate(timestamp) {
    const date = vietnamDateKey(timestamp);
    const today = vietnamDateKey();
    if (date === today) return "Today";
    if (date === addVietnamDays(today, 1)) return "Tomorrow";
    return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "2-digit", month: "short" }).format(new Date(timestamp));
  }

  function formatTime(timestamp) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(timestamp));
  }

  function formatFullDateTime(timestamp) {
    return `${friendlyDate(timestamp)} · ${formatTime(timestamp)}`;
  }

  function removeTones(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
  }

  function createId() {
    return root.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function showMessage(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    root.clearTimeout(showMessage.timer);
    showMessage.timer = root.setTimeout(() => { elements.toast.hidden = true; }, 2800);
  }

  function bellSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})(window);
