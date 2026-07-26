(function installJoyTaskReminderEvents(root) {
  const REMINDER_STORAGE_KEY = "joy-dashboard-task-reminders-v1";
  const nativeFetch = root.fetch.bind(root);

  root.fetch = async function joyTaskReminderFetch(input, init = undefined) {
    const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
    const requestUrl = request?.url || String(input || "");
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    const url = new URL(requestUrl, root.location.href);
    const response = await nativeFetch(input, init);

    if (url.pathname !== "/api/task-reminders" || method !== "GET" || !response.ok) {
      return response;
    }

    try {
      const payload = await response.clone().json();
      if (!Array.isArray(payload.reminders)) return response;
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      return new Response(JSON.stringify({
        ...payload,
        reminders: payload.reminders.filter((item) => !item?.done),
      }), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  };

  function removeLocalReminder(taskId) {
    try {
      const stored = JSON.parse(root.localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
      const list = Array.isArray(stored) ? stored : Object.values(stored || {});
      root.localStorage.setItem(
        REMINDER_STORAGE_KEY,
        JSON.stringify(list.filter((item) => String(item?.taskId || "") !== String(taskId))),
      );
    } catch {
      // The server still prevents completed tasks from being reminded.
    }
  }

  function start() {
    const list = document.querySelector("#task-list");
    if (!list) return;

    list.addEventListener("click", (event) => {
      const checkmark = event.target.closest?.(".checkmark");
      if (checkmark) {
        const input = checkmark.closest(".task-row")?.querySelector('input[type="checkbox"][data-task-id]');
        if (!input || input.disabled) return;

        // The visible square is a span placed over the real checkbox. Toggle the
        // input explicitly so reminder row handlers cannot swallow the label click.
        event.preventDefault();
        event.stopImmediatePropagation();
        input.checked = !input.checked;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      const row = event.target.closest?.(".task-row");
      if (!row || event.target.closest('input[type="checkbox"], button, a')) return;
      // Task rows are labels, so cancel their default checkbox toggle when opening details.
      event.preventDefault();
    }, true);

    list.addEventListener("change", (event) => {
      const input = event.target.closest?.("input[data-task-id]");
      if (!input?.checked) return;
      const taskId = String(input.dataset.taskId || "");
      if (!taskId) return;
      removeLocalReminder(taskId);
      void root.fetch("/api/task-reminders/action", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: "complete" }),
      }).catch(() => null);
    });

    const requestedTaskId = new URL(root.location.href).searchParams.get("task");
    if (!requestedTaskId) return;

    let opened = false;
    const openRequestedTask = () => {
      if (opened) return;
      const input = [...list.querySelectorAll("input[data-task-id]")]
        .find((item) => String(item.dataset.taskId) === String(requestedTaskId));
      const row = input?.closest(".task-row");
      const target = row?.querySelector(".task-title") || row;
      if (!target) return;
      opened = true;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      root.setTimeout(() => target.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: root,
      })), 250);
    };

    openRequestedTask();
    if (!opened) {
      const observer = new MutationObserver(() => {
        openRequestedTask();
        if (opened) observer.disconnect();
      });
      observer.observe(list, { childList: true, subtree: true });
      root.setTimeout(() => observer.disconnect(), 8000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window);
