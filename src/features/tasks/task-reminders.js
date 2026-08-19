(function registerJoyTaskReminders(root) {
  const CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
  if (!CLOUD_BACKEND) return;

  const WEEKDAYS = [
    { value: 1, short: "M", label: "Monday" },
    { value: 2, short: "T", label: "Tuesday" },
    { value: 3, short: "W", label: "Wednesday" },
    { value: 4, short: "T", label: "Thursday" },
    { value: 5, short: "F", label: "Friday" },
    { value: 6, short: "S", label: "Saturday" },
    { value: 7, short: "S", label: "Sunday" },
  ];

  const core = root.JoyTaskReminderCore?.create({ weekdays: WEEKDAYS });
  if (!core || !root.JoyTaskRepeating?.create || !root.JoyTaskFocus?.create) {
    console.error("Joy task modules failed to load");
    return;
  }

  const {
    parseNaturalTask,
    reminderLabel,
    reminderState,
    effectiveDue,
    normalizeLocalReminder,
    reminderToRequest,
    readReminderStore,
    writeReminderStore,
    saveLocalReminder: saveReminderInStore,
    readTasks,
    saveTasks,
    findTask,
    updateLocalTask,
    request,
    defaultSchedule,
    scheduleTimestamp,
    vietnamInputParts,
    vietnamDateKey,
    endOfVietnamDay,
    formatFullDateTime,
    createId,
  } = core;

  let reminders = new Map();
  let composerOpen = false;
  let editingTaskId = "";
  let repeatingController = null;
  let focusController = null;

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
    repeatingController = root.JoyTaskRepeating.create({
      elements,
      getReminders: () => reminders,
      readTasks,
      reminderLabel,
      reminderState,
      effectiveDue,
      endOfVietnamDay,
      renderEmptyState: renderFilterEmptyState,
    });
    focusController = root.JoyTaskFocus.create({
      elements,
      request,
      showMessage,
      formatFullDateTime,
      releaseModalLock,
    });

    installQuickAddControls();
    installFilters();
    installTaskModal();
    installFocusModal();
    bindEvents();
    repeatingController.observeTaskList();
    repeatingController.decorateTaskRows();
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
    repeatingController.updateFilterButtons();
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
    elements.filters.forEach((button) => button.addEventListener("click", () => repeatingController.setFilter(button.dataset.taskFilter)));
    elements.focusButton.addEventListener("click", focusController.open);

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
    elements.focusForm.addEventListener("submit", focusController.save);

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-joy-close-task]")) closeTaskModal();
      if (event.target.closest("[data-joy-close-focus]")) focusController.close();
      if (event.target === elements.taskModal) closeTaskModal();
      if (event.target === elements.focusModal) focusController.close();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!elements.taskModal.hidden) closeTaskModal();
      else if (!elements.focusModal.hidden) focusController.close();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void syncReminders();
    });
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
      const cloud = new Map((payload.reminders || []).map((item) => [String(item.taskId), normalizeLocalReminder({ ...item, dirty: false })]));
      const merged = new Map();
      for (const [taskId, meta] of local) {
        if (meta.dirty) merged.set(taskId, meta);
      }
      for (const [taskId, meta] of cloud) {
        if (!merged.has(taskId)) merged.set(taskId, meta);
      }
      reminders = merged;
      writeReminderStore(reminders);
      repeatingController.decorateTaskRows();
    } catch {
      reminders = readReminderStore();
      repeatingController.decorateTaskRows();
    }
  }

  function renderFilterEmptyState(activeFilter, visibleCount) {
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

  function saveLocalReminder(value) {
    return saveReminderInStore(reminders, value);
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
