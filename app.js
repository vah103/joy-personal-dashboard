const STORAGE_KEY = "joy-dashboard-sample";

const seedProjects = [
  {
    id: 1,
    name: "TurtleBot 4",
    progress: 38,
    accent: "slate",
    focus: "Localization & Nav2",
    next: "Run a map localization test",
  },
  {
    id: 2,
    name: "IELTS",
    progress: 62,
    accent: "blue",
    focus: "Speaking fluency",
    next: "Complete a Part 2 mock",
  },
];

const seedTasks = [
  { id: 1, title: "Prepare commands for tomorrow’s lab", time: "9:00 AM", priority: "High" },
  { id: 2, title: "Reply to room viewing inquiry", time: "11:00 AM", priority: "Medium", done: true },
  { id: 3, title: "Practice IELTS Speaking for 30 minutes", time: "7:00 PM", priority: "Low" },
];

const state = loadState();
let toastTimer;

const elements = {
  brief: document.querySelector("#brief-copy"),
  email: document.querySelector("#email-content"),
  greeting: document.querySelector("#greeting"),
  modal: document.querySelector("#project-modal"),
  pendingStatus: document.querySelector("#pending-status"),
  projectForm: document.querySelector("#project-form"),
  projectList: document.querySelector("#project-list"),
  quickAddForm: document.querySelector("#quick-add-form"),
  taskCount: document.querySelector("#task-count"),
  taskList: document.querySelector("#task-list"),
  todayLabel: document.querySelector("#today-label"),
  toast: document.querySelector("#toast"),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  const fallback = {
    tasks: clone(seedTasks),
    projects: clone(seedProjects),
    emailDone: false,
    pendingConfirmed: false,
  };

  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    return {
      tasks: Array.isArray(saved.tasks) ? saved.tasks : fallback.tasks,
      projects: Array.isArray(saved.projects) ? saved.projects : fallback.projects,
      emailDone: Boolean(saved.emailDone),
      pendingConfirmed: Boolean(saved.pendingConfirmed),
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return fallback;
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderHeader() {
  const now = new Date();
  const hour = now.getHours();
  const daypart = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  elements.todayLabel.textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  elements.greeting.textContent = `Good ${daypart}, Vanh.`;
}

function renderBrief() {
  const dueCount = state.tasks.filter((task) => !task.done).length;
  const taskLabel = `${dueCount} ${dueCount === 1 ? "task" : "tasks"} due today`;
  const emailLabel = state.emailDone ? "no important email" : "1 important email";
  elements.brief.innerHTML = `You have <strong>2 customer viewings</strong>, <strong>${taskLabel}</strong>, and <strong>${emailLabel}</strong>.`;
}

function renderEmail() {
  elements.email.innerHTML = state.emailDone
    ? `<div class="empty-state">
        <span>✓</span><strong>You’re all caught up</strong>
        <p>No priority emails need your attention.</p>
        <button type="button" data-action="restore-email">Restore sample email</button>
      </div>`
    : `<article class="email-item">
        <div class="sender-avatar">MT</div>
        <div class="email-copy">
          <div class="email-meta"><strong>Dr. Minh Tran</strong><time>8:42 AM</time></div>
          <h3>TurtleBot 4 project review</h3>
          <p>Could you send the latest navigation test results before Friday?</p>
          <div class="button-row">
            <button class="primary-button" type="button" data-action="open-email">Open email</button>
            <button class="secondary-button" type="button" data-action="complete-email">Mark done</button>
          </div>
        </div>
      </article>`;
}

function renderProjects() {
  if (!state.projects.length) {
    elements.projectList.innerHTML = `<div class="project-empty"><strong>No active projects</strong><p>Add a project whenever your focus changes.</p></div>`;
    return;
  }

  elements.projectList.innerHTML = state.projects
    .map((project) => `<article class="project-card">
      <div class="project-top">
        <strong>${escapeHtml(project.name)}</strong>
        <div><span>${Number(project.progress) || 0}%</span><button type="button" aria-label="Archive ${escapeHtml(project.name)}" title="Archive project" data-action="archive-project" data-id="${Number(project.id)}">×</button></div>
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
  const doneCount = state.tasks.filter((task) => task.done).length;
  elements.taskCount.textContent = `${doneCount} of ${state.tasks.length} done`;

  if (!state.tasks.length) {
    elements.taskList.innerHTML = `<div class="task-empty">Nothing on your list yet.</div>`;
    return;
  }

  elements.taskList.innerHTML = state.tasks
    .map((task) => `<label class="task-row ${task.done ? "completed" : ""}">
      <input type="checkbox" data-task-id="${Number(task.id)}" ${task.done ? "checked" : ""} />
      <span class="checkmark" aria-hidden="true"></span>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <time>${escapeHtml(task.time)}</time>
      <span class="priority ${String(task.priority).toLowerCase()}">${escapeHtml(task.priority)}</span>
    </label>`)
    .join("");
}

function renderSales() {
  elements.pendingStatus.textContent = state.pendingConfirmed ? "Confirmed" : "Pending";
  elements.pendingStatus.classList.toggle("confirmed", state.pendingConfirmed);
  elements.pendingStatus.classList.toggle("pending", !state.pendingConfirmed);
}

function render() {
  renderBrief();
  renderEmail();
  renderProjects();
  renderTasks();
  renderSales();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function openProjectForm() {
  elements.modal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => elements.projectForm.elements.name.focus(), 0);
}

function closeProjectForm() {
  elements.modal.hidden = true;
  document.body.classList.remove("modal-open");
  elements.projectForm.reset();
}

elements.quickAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = elements.quickAddForm.elements.task;
  const title = input.value.trim();
  if (!title) return;
  state.tasks.push({ id: Date.now(), title, time: "Today", priority: "Medium", done: false });
  input.value = "";
  saveState();
  render();
  showToast("Task added to today");
});

elements.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(elements.projectForm);
  const name = String(form.get("name") || "").trim();
  const focus = String(form.get("focus") || "").trim();
  const next = String(form.get("next") || "").trim();
  if (!name || !focus || !next) return;
  state.projects.push({ id: Date.now(), name, focus, next, progress: 10, accent: "slate" });
  saveState();
  closeProjectForm();
  render();
  showToast(`${name} added to Projects`);
});

elements.taskList.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-task-id]");
  if (!input) return;
  const task = state.tasks.find((item) => item.id === Number(input.dataset.taskId));
  if (!task) return;
  task.done = input.checked;
  saveState();
  render();
});

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;

  if (action === "open-project-form") openProjectForm();
  if (action === "close-project-form") closeProjectForm();
  if (action === "complete-email") {
    state.emailDone = true;
    saveState();
    render();
    showToast("Email marked as done");
  }
  if (action === "restore-email") {
    state.emailDone = false;
    saveState();
    render();
  }
  if (action === "toggle-viewing") {
    state.pendingConfirmed = !state.pendingConfirmed;
    saveState();
    render();
    showToast(state.pendingConfirmed ? "Viewing confirmed" : "Viewing moved to pending");
  }
  if (action === "archive-project") {
    const id = Number(control.dataset.id);
    const project = state.projects.find((item) => item.id === id);
    state.projects = state.projects.filter((item) => item.id !== id);
    saveState();
    render();
    showToast(`${project?.name || "Project"} archived`);
  }
  if (action === "view-day") document.querySelector("#to-do").scrollIntoView({ behavior: "smooth", block: "center" });
  if (action === "open-email") showToast("Opening email is disabled in sample mode");
  if (action === "view-inbox") showToast("Live email connection comes next");
  if (action === "open-sales") showToast("Live sales data comes next");
  if (action === "room-highlight") showToast("Room A12 · sample information");
  if (action === "notifications") showToast("2 sample notifications");
  if (action === "sample-settings") showToast("Settings will be available in the live version");
});

elements.modal.addEventListener("mousedown", (event) => {
  if (event.target === elements.modal) closeProjectForm();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.modal.hidden) closeProjectForm();
});

const sections = [...document.querySelectorAll("#overview, #email, #sales, #projects, #to-do")];
const navigationLinks = [...document.querySelectorAll('.nav-list a[href^="#"], .mobile-nav a[href^="#"]')];
const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  navigationLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
}, { rootMargin: "-30% 0px -60%", threshold: [0, 0.25, 0.5] });
sections.forEach((section) => observer.observe(section));

renderHeader();
render();
