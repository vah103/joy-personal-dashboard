(function installJoyTaskReminderEvents(root) {
  function start() {
    const list = document.querySelector("#task-list");
    if (!list) return;

    list.addEventListener("click", (event) => {
      const row = event.target.closest?.(".task-row");
      if (!row || event.target.closest('input[type="checkbox"], button, a')) return;
      // Task rows are labels, so cancel their default checkbox toggle when opening details.
      event.preventDefault();
    }, true);

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
