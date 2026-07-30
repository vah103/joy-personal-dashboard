function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function vietnamDateKey(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatTaskDate(dateKey, includeYear = false) {
  const [year, month, day] = String(dateKey || "").split("-");
  if (!year || !month || !day) return "—";
  return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const dateOrder = String(b.createdDate).localeCompare(String(a.createdDate));
    if (dateOrder) return dateOrder;
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

function createProjectId() {
  return window.crypto?.randomUUID?.() || `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createTaskId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
