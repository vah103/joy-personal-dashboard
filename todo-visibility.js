(function registerJoyTodo(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";

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

  function shouldShowTask(task, now = new Date()) {
    if (!task?.done) return true;
    if (!task.completedAt) return false;

    const completedDate = vietnamDateKey(task.completedAt);
    const currentDate = vietnamDateKey(now);

    return Boolean(completedDate && completedDate === currentDate);
  }

  root.JoyTodo = Object.freeze({
    shouldShowTask,
    vietnamDateKey,
  });
})(typeof window !== "undefined" ? window : globalThis);
