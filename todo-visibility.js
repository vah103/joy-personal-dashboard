(function registerJoyTodo(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";
  const COMPLETED_TASK_VISIBLE_DAYS = 2;

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
})(typeof window !== "undefined" ? window : globalThis);
