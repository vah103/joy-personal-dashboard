function renderProjects() {
  if (!state.projects.length) {
    elements.projectList.innerHTML = `<div class="project-empty"><strong>No active projects</strong><p>Add a project whenever your focus changes.</p></div>`;
    return;
  }

  elements.projectList.innerHTML = state.projects
    .map((project) => `<article class="project-card">
      <div class="project-top">
        <strong>${escapeHtml(project.name)}</strong>
        <div><span>${Number(project.progress) || 0}%</span><button type="button" aria-label="Delete ${escapeHtml(project.name)}" title="Delete project" data-action="request-delete-project" data-id="${escapeHtml(project.id)}">×</button></div>
      </div>
      <div class="progress-track"><span class="${project.accent === "blue" ? "blue" : "slate"}" style="width:${Math.min(100, Math.max(0, Number(project.progress) || 0))}%"></span></div>
      <dl>
        <div><dt>Current focus</dt><dd>${escapeHtml(project.focus)}</dd></div>
        <div><dt>Next action</dt><dd>${escapeHtml(project.next)}</dd></div>
      </dl>
    </article>`)
    .join("");
}

function renderTasks() {
  const now = new Date();
  lastRenderedTodoDate = vietnamDateKey(now);

  const visibleTasks = sortTasks(state.tasks.filter((task) => {
    const shouldShowTask = window.JoyTodo?.shouldShowTask;

    return typeof shouldShowTask === "function"
      ? shouldShowTask(task, now)
      : !task.done;
  }));

  const openCount = state.tasks.filter((task) => !task.done).length;
  elements.taskCount.textContent = `${openCount} open`;

  if (!visibleTasks.length) {
    elements.taskList.innerHTML = `<div class="task-empty"><strong>Your list is clear</strong><span>Add a task above whenever something comes up.</span></div>`;
    return;
  }

  elements.taskList.innerHTML = visibleTasks
    .map((task) => `<label class="task-row ${task.done ? "completed" : ""}">
      <input
        type="checkbox"
        data-task-id="${escapeHtml(task.id)}"
        aria-label="${task.done ? "Completed" : "Complete"} ${escapeHtml(task.title)}"
        ${task.done ? "checked disabled" : ""}
      />
      <span class="checkmark" aria-hidden="true"></span>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <time datetime="${escapeHtml(task.createdDate)}" title="Created ${formatTaskDate(task.createdDate, true)}">${formatTaskDate(task.createdDate)}</time>
    </label>`)
    .join("");
}

function startTodoDayRefresh() {
  window.clearInterval(taskDayRefreshTimer);

  taskDayRefreshTimer = window.setInterval(() => {
    const currentDate = vietnamDateKey();

    if (currentDate === lastRenderedTodoDate) return;

    lastRenderedTodoDate = currentDate;
    renderBrief();
    renderTasks();
  }, 60_000);
}

function renderTaskHistory() {
  const tasks = sortTasks(state.tasks);
  const completedCount = tasks.filter((task) => task.done).length;
  const openCount = tasks.length - completedCount;
  elements.taskHistorySummary.textContent = `${tasks.length} total · ${openCount} open · ${completedCount} completed`;

  if (!tasks.length) {
    elements.taskHistoryContent.innerHTML = `<div class="task-history-empty"><strong>History starts today</strong><p>Tasks you add will stay here, even after they are completed.</p></div>`;
    return;
  }

  const groups = new Map();
  tasks.forEach((task) => {
    if (!groups.has(task.createdDate)) groups.set(task.createdDate, []);
    groups.get(task.createdDate).push(task);
  });

  elements.taskHistoryContent.innerHTML = [...groups.entries()].map(([dateKey, dayTasks]) => `
    <section class="task-history-group">
      <h3><time datetime="${escapeHtml(dateKey)}">${formatTaskDate(dateKey, true)}</time></h3>
      <div class="task-history-list">
        ${dayTasks.map((task) => `<div class="history-task-row ${task.done ? "completed" : ""}">
          <span class="history-check" aria-hidden="true">${task.done ? "✓" : ""}</span>
          <span class="history-task-title">${escapeHtml(task.title)}</span>
          <span class="history-task-state">${task.done ? "Completed" : "Open"}</span>
        </div>`).join("")}
      </div>
    </section>`).join("");
}

function renderSales() {
  elements.salesCount.textContent = sales.status === "ready"
    ? `${sales.viewings.length} ${sales.viewings.length === 1 ? "viewing" : "viewings"}`
    : sales.status === "loading" ? "Loading" : "Not synced";

  if (sales.status !== "ready") {
    const notice = document.createElement("div");
    notice.className = "sales-notice";
    const title = document.createElement("strong");
    const copy = document.createElement("p");

    if (sales.status === "loading") {
      title.textContent = "Loading viewing schedule";
      copy.textContent = "Joy is loading your saved appointments.";
    } else if (sales.status === "authorization-required") {
      title.textContent = "Joy session expired";
      copy.textContent = "Sign in to Joy again to load your private appointment history.";
      notice.append(title, copy);
      elements.sales.replaceChildren(notice);
      renderSalesModal();
      return;
    } else if (sales.status === "unavailable") {
      title.textContent = "Live sales stays private";
      copy.textContent = "Open the secure Joy Cloudflare app to see customer appointments.";
    } else {
      title.textContent = "Viewing schedule could not load";
      copy.textContent = "Joy could not reach the appointment database. Try again in a moment.";
      notice.append(title, copy, makeButton("Try again", "refresh-sales", "secondary-button"));
      elements.sales.replaceChildren(notice);
      renderSalesModal();
      return;
    }

    notice.append(title, copy);
    elements.sales.replaceChildren(notice);
    renderSalesModal();
    return;
  }

  if (!sales.viewings.length) {
    const empty = document.createElement("div");
    empty.className = "sales-empty";
    const check = document.createElement("span");
    check.textContent = "✓";
    const title = document.createElement("strong");
    title.textContent = "No upcoming viewings";
    const copy = document.createElement("p");
    copy.textContent = "Past appointments stay available in Sale Assistant history.";
    empty.append(check, title, copy);
    elements.sales.replaceChildren(empty);
    renderSalesModal();
    return;
  }

  const scroll = document.createElement("div");
  scroll.className = "viewing-list-scroll";
  const columns = document.createElement("div");
  columns.className = "viewing-columns";
  ["Viewing time", "Customer", "Room address"].forEach((label) => {
    const span = document.createElement("span");
    span.textContent = label;
    columns.append(span);
  });
  scroll.append(columns);

  sales.viewings.forEach((viewing) => {
    const row = document.createElement("article");
    row.className = "viewing-row";
    const time = document.createElement("time");
    time.dateTime = viewing.viewingAt;
    time.textContent = formatViewingTime(viewing.viewingAt);
    const customer = document.createElement("strong");
    customer.textContent = viewing.customerName;
    const address = document.createElement("span");
    address.textContent = viewing.viewingAddress;
    row.append(time, customer, address);
    scroll.append(row);
  });

  elements.sales.replaceChildren(scroll);
  renderSalesModal();
}

function formatViewingTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("day")} ${part("month")} · ${part("hour")}:${part("minute")}`;
}

function saleNotificationState(viewing, kind) {
  const notified = kind === "reminder" ? viewing.reminderNotifiedAt : viewing.followupNotifiedAt;
  const scheduled = kind === "reminder" ? viewing.reminderAt : viewing.followupAt;
  if (notified) return "Sent";
  if (!scheduled) return kind === "reminder" ? "Skipped" : "—";
  return "Pending";
}

function renderSalesModal() {
  if (sales.status !== "ready" || !sales.viewings.length) {
    const empty = document.createElement("div");
    empty.className = "sales-modal-empty";
    empty.textContent = sales.status === "ready"
      ? "There are no upcoming appointments. Open Assistant → Lịch sử to see past viewings."
      : "The appointment list is not available yet.";
    elements.salesModalContent.replaceChildren(empty);
    return;
  }

  const scroll = document.createElement("div");
  scroll.className = "sales-table-scroll";
  const table = document.createElement("table");
  table.className = "sales-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Customer", "Phone", "Viewing address", "Viewing time", "30 min reminder", "Follow-up"].forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.append(th);
  });
  head.append(headRow);

  const body = document.createElement("tbody");
  sales.viewings.forEach((viewing) => {
    const row = document.createElement("tr");
    [
      viewing.customerName,
      viewing.phone || "—",
      viewing.viewingAddress,
      formatViewingTime(viewing.viewingAt),
      saleNotificationState(viewing, "reminder"),
      saleNotificationState(viewing, "followup"),
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  scroll.append(table);
  elements.salesModalContent.replaceChildren(scroll);
}

function render() {
  renderBrief();
  renderEmail();
  renderProjects();
  renderTasks();
  renderTaskHistory();
  renderSales();
}
