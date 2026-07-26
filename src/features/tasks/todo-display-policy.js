(function installJoyTodoDisplayPolicy(root) {
  const previous = root.JoyTodo;
  if (!previous) return;

  const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function calendarDayNumber(dateKey) {
    const [year, month, day] = String(dateKey || "").split("-").map(Number);
    if (!year || !month || !day) return null;
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  }

  function displayedTaskDate(task) {
    const createdDate = String(task?.createdDate || "").trim();
    if (DATE_KEY_PATTERN.test(createdDate)) return createdDate;
    return previous.vietnamDateKey(task?.createdAt || task?.completedAt || new Date());
  }

  function shouldShowTask(task, now = new Date()) {
    if (!task?.done) return true;

    const taskDay = calendarDayNumber(displayedTaskDate(task));
    const currentDay = calendarDayNumber(previous.vietnamDateKey(now));
    if (taskDay === null || currentDay === null) return false;

    const elapsedCalendarDays = currentDay - taskDay;
    return elapsedCalendarDays >= 0 && elapsedCalendarDays <= 1;
  }

  root.JoyTodo = Object.freeze({
    ...previous,
    shouldShowTask,
  });
})(typeof window !== "undefined" ? window : globalThis);
