(function registerJoyTodo(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";
  const COMPLETED_TASK_VISIBLE_DAYS = 2;
  const TODO_STORAGE_KEY = "joy-dashboard-todos-v1";
  const TODO_PENDING_DELETIONS_KEY = "joy-dashboard-todo-pending-deletions-v1";
  const TASK_DELETE_ENDPOINT = "/api/tasks/delete";

  function vietnamDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );

    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function calendarDayNumber(dateKey) {
    const [year, month, day] = String(dateKey || "")
      .split("-")
      .map(Number);

    if (!year || !month || !day) return null;

    return Math.floor(
      Date.UTC(year, month - 1, day) / 86_400_000,
    );
  }

  function shouldShowTask(task, now = new Date()) {
    if (!task?.done) return true;
    if (!task.completedAt) return false;

    const completedDate = vietnamDateKey(task.completedAt);
    const currentDate = vietnamDateKey(now);

    const completedDay = calendarDayNumber(completedDate);
    const currentDay = calendarDayNumber(currentDate);

    if (completedDay === null || currentDay === null) {
      return false;
    }

    const elapsedCalendarDays = currentDay - completedDay;

    /*
     * Completed on day 23:
     * - day 23: elapsed 0 → visible
     * - day 24: elapsed 1 → visible
     * - day 25: elapsed 2 → hidden
     */
    return elapsedCalendarDays >= 0
      && elapsedCalendarDays < COMPLETED_TASK_VISIBLE_DAYS;
  }

  root.JoyTodo = Object.freeze({
    shouldShowTask,
    vietnamDateKey,
  });

  if (typeof document === "undefined" || typeof root.fetch !== "function") return;

  const nativeFetch = root.fetch.bind(root);

  function loadPendingTaskDeletions() {
    try {
      const saved = JSON.parse(root.localStorage.getItem(TODO_PENDING_DELETIONS_KEY));
      return Array.isArray(saved)
        ? [...new Set(saved.map(String).filter(Boolean))]
        : [];
    } catch {
      return [];
    }
  }

  function savePendingTaskDeletions(ids) {
    try {
      root.localStorage.setItem(
        TODO_PENDING_DELETIONS_KEY,
        JSON.stringify([...new Set(ids.map(String).filter(Boolean))]),
      );
    } catch {
      // The task is still removed from the current page when storage is unavailable.
    }
  }

  function queueTaskDeletion(id) {
    savePendingTaskDeletions([...loadPendingTaskDeletions(), String(id)]);
  }

  function clearTaskDeletion(id) {
    savePendingTaskDeletions(
      loadPendingTaskDeletions().filter((item) => item !== String(id)),
    );
  }

  function isCloudDashboard() {
    return document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
  }

  function removeTaskFromLocalStorage(id) {
    try {
      const tasks = JSON.parse(root.localStorage.getItem(TODO_STORAGE_KEY));
      if (!Array.isArray(tasks)) return;
      root.localStorage.setItem(
        TODO_STORAGE_KEY,
        JSON.stringify(tasks.filter((task) => String(task?.id) !== String(id))),
      );
    } catch {
      // A cloud deletion can still succeed even when local storage is unavailable.
    }
  }

  function filteredTaskPayload(payload, pendingIds) {
    if (!payload || !Array.isArray(payload.tasks) || !pendingIds.size) return payload;
    return {
      ...payload,
      tasks: payload.tasks.filter((task) => !pendingIds.has(String(task?.id))),
    };
  }

  root.fetch = async function joyTodoFetch(input, init = undefined) {
    const request = typeof Request !== "undefined" && input instanceof Request
      ? input
      : null;
    const requestUrl = request?.url || String(input || "");
    const url = new URL(requestUrl, root.location.href);
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    const pendingIds = new Set(loadPendingTaskDeletions());
    let nextInit = init;

    if (
      url.pathname === "/api/tasks/import"
      && method === "POST"
      && pendingIds.size
      && typeof init?.body === "string"
    ) {
      try {
        const payload = JSON.parse(init.body);
        nextInit = {
          ...init,
          body: JSON.stringify(filteredTaskPayload(payload, pendingIds)),
        };
      } catch {
        // Preserve the original request when its body is not JSON.
      }
    }

    const response = await nativeFetch(input, nextInit);

    if (
      url.pathname === "/api/tasks"
      && method === "GET"
      && pendingIds.size
      && response.ok
    ) {
      try {
        const payload = filteredTaskPayload(await response.clone().json(), pendingIds);
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        return new Response(JSON.stringify(payload), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch {
        return response;
      }
    }

    return response;
  };

  async function deleteCloudTask(id) {
    const response = await nativeFetch(TASK_DELETE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`TASK_DELETE_FAILED_${response.status}`);
    }
  }

  async function flushPendingTaskDeletions() {
    if (!isCloudDashboard()) return;

    for (const id of loadPendingTaskDeletions()) {
      try {
        await deleteCloudTask(id);
        clearTaskDeletion(id);
      } catch {
        // Keep the id queued and retry on the next page load.
      }
    }
  }

  function installDeleteButtonStyles() {
    if (document.querySelector("#joy-task-delete-styles")) return;

    const style = document.createElement("style");
    style.id = "joy-task-delete-styles";
    style.textContent = `
      .task-delete-button {
        width: 30px;
        height: 30px;
        display: inline-grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: #92989d;
        cursor: pointer;
      }
      .task-delete-button:hover,
      .task-delete-button:focus-visible {
        background: var(--danger-soft, #f4e6e4);
        color: var(--danger, #a75c52);
      }
      .task-delete-button:disabled {
        opacity: .55;
        cursor: wait;
      }
      .task-delete-button svg {
        width: 15px;
        height: 15px;
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.8;
        pointer-events: none;
      }
      .task-row.joy-task-removing {
        opacity: .45;
        pointer-events: none;
      }
      @media (max-width: 760px) {
        .task-delete-button {
          width: 34px;
          height: 34px;
        }
      }
    `;
    document.head.append(style);
  }

  function decorateTaskRows() {
    const list = document.querySelector("#task-list");
    if (!list) return;

    list.querySelectorAll(".task-row").forEach((row) => {
      if (row.querySelector(".task-delete-button")) return;

      const taskInput = row.querySelector("input[data-task-id]");
      const id = String(taskInput?.dataset.taskId || "").trim();
      if (!id) return;

      const title = row.querySelector(".task-title")?.textContent?.trim() || "this task";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "task-delete-button";
      button.dataset.joyDeleteTask = id;
      button.setAttribute("aria-label", `Delete ${title}`);
      button.title = "Delete task";
      button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16"/>
          <path d="M9 7V4h6v3"/>
          <path d="M7 7l1 13h8l1-13"/>
          <path d="M10 11v5M14 11v5"/>
        </svg>
      `;
      row.append(button);
    });
  }

  function updateOpenTaskCount() {
    const pill = document.querySelector("#task-count");
    if (!pill) return;
    const openTasks = document.querySelectorAll(
      "#task-list .task-row:not(.completed):not(.joy-task-removing)",
    ).length;
    pill.textContent = `${openTasks} open`;
  }

  async function handleTaskDeletion(button) {
    const id = String(button.dataset.joyDeleteTask || "").trim();
    const row = button.closest(".task-row");
    const title = row?.querySelector(".task-title")?.textContent?.trim() || "this task";
    if (!id || !row) return;

    const confirmed = root.confirm(`Delete “${title}”?`);
    if (!confirmed) return;

    button.disabled = true;
    row.classList.add("joy-task-removing");
    removeTaskFromLocalStorage(id);
    updateOpenTaskCount();

    if (isCloudDashboard()) {
      queueTaskDeletion(id);
      try {
        await deleteCloudTask(id);
        clearTaskDeletion(id);
      } catch {
        // The queued id prevents the task from returning and will retry later.
      }
    }

    root.location.reload();
  }

  function startTaskDeletionUi() {
    installDeleteButtonStyles();
    decorateTaskRows();

    const list = document.querySelector("#task-list");
    if (list) {
      new MutationObserver(decorateTaskRows).observe(list, {
        childList: true,
        subtree: true,
      });
    }

    document.addEventListener("click", (event) => {
      const button = event.target.closest?.(".task-delete-button");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      void handleTaskDeletion(button);
    }, true);

    void flushPendingTaskDeletions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTaskDeletionUi, { once: true });
  } else {
    startTaskDeletionUi();
  }
})(typeof window !== "undefined" ? window : globalThis);
