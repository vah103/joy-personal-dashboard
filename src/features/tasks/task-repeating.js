(function registerJoyTaskRepeating(root) {
  const FILTER_STORAGE_KEY = "joy-dashboard-task-filter-v1";

  function create({
    elements,
    getReminders,
    readTasks,
    reminderLabel,
    reminderState,
    effectiveDue,
    endOfVietnamDay,
    renderEmptyState,
  }) {
    let activeFilter = readFilter();
    let decorating = false;
    let syncTimer = 0;

    function observeTaskList() {
      new MutationObserver(() => {
        if (decorating) return;
        root.clearTimeout(syncTimer);
        syncTimer = root.setTimeout(decorateTaskRows, 0);
      }).observe(elements.list, { childList: true, subtree: true });
    }

    function decorateTaskRows() {
      if (decorating) return;
      decorating = true;
      try {
        const reminders = getReminders();
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
      const reminders = getReminders();
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

      renderEmptyState(activeFilter, visibleCount);
    }

    return Object.freeze({
      observeTaskList,
      decorateTaskRows,
      setFilter,
      updateFilterButtons,
      applyFilter,
    });
  }

  root.JoyTaskRepeating = Object.freeze({ create });
})(window);
