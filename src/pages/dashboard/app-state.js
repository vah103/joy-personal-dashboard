const DASHBOARD_CONFIG = window.JoyDashboardConfig || {};
const STORAGE_KEY = "joy-dashboard-sample";
const TODO_STORAGE_KEY = "joy-dashboard-todos-v1";
const TODO_PENDING_COMPLETIONS_KEY = "joy-dashboard-todo-pending-completions-v1";
const PROJECT_PENDING_ARCHIVES_KEY = "joy-dashboard-project-pending-archives-v1";
const GOOGLE_CLIENT_ID = String(DASHBOARD_CONFIG.google?.clientId || "");
const GMAIL_SCOPE = String(DASHBOARD_CONFIG.google?.gmailScope || "https://www.googleapis.com/auth/gmail.readonly");
const GMAIL_API_ROOT = String(DASHBOARD_CONFIG.google?.gmailApiRoot || "https://gmail.googleapis.com/gmail/v1/users/me");
const GMAIL_INBOX_URL = String(DASHBOARD_CONFIG.google?.inboxUrl || "https://mail.google.com/mail/u/0/#inbox");
const CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
const GMAIL_AUTO_REFRESH_MS = Number(DASHBOARD_CONFIG.refresh?.gmailMs || 60_000);
const SALES_AUTO_REFRESH_MS = Number(DASHBOARD_CONFIG.refresh?.salesMs || 60_000);
const WEATHER_REFRESH_MS = Number(DASHBOARD_CONFIG.weather?.refreshMinutes || 15) * 60_000;
const VIETNAM_TIME_ZONE = String(DASHBOARD_CONFIG.timeZone || "Asia/Ho_Chi_Minh");
const weatherParameters = new URLSearchParams({
  latitude: String(DASHBOARD_CONFIG.weather?.latitude ?? 21.0285),
  longitude: String(DASHBOARD_CONFIG.weather?.longitude ?? 105.8542),
  current: "temperature_2m,apparent_temperature,weather_code",
  hourly: "precipitation_probability,precipitation,weather_code",
  timezone: VIETNAM_TIME_ZONE,
  forecast_days: "1",
});
const WEATHER_ENDPOINT = `https://api.open-meteo.com/v1/forecast?${weatherParameters}`;

const seedProjects = Array.isArray(DASHBOARD_CONFIG.seedProjects)
  ? DASHBOARD_CONFIG.seedProjects.map((project) => ({ ...project }))
  : [];
const TURTLEBOT_PROJECT_KEY = "turtlebot4";

function projectIdentity(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function canonicalManagedProject(name) {
  if (projectIdentity(name) !== TURTLEBOT_PROJECT_KEY) return null;
  return seedProjects.find((project) => projectIdentity(project.name) === TURTLEBOT_PROJECT_KEY) || null;
}

const seedTasks = [];

const state = loadState();
const gmail = {
  status: "sdk-loading",
  tokenClient: null,
  accessToken: null,
  expiresAt: 0,
  messages: [],
  hiddenCount: 0,
  syncedAt: 0,
  error: "",
};
const sales = {
  status: CLOUD_BACKEND ? "loading" : "unavailable",
  viewings: [],
  fetchedAt: 0,
  errorCode: "",
};
const accountSync = {
  connected: false,
  email: "",
  projectsReady: false,
};

let toastTimer;
let gmailAutoRefreshTimer;
let salesAutoRefreshTimer;
let taskDayRefreshTimer;
let lastRenderedTodoDate = vietnamDateKey();
let pendingProjectDeleteId = "";

const elements = {
  brief: document.querySelector("#brief-copy"),
  email: document.querySelector("#email-content"),
  greeting: document.querySelector("#greeting"),
  modal: document.querySelector("#project-modal"),
  projectForm: document.querySelector("#project-form"),
  projectList: document.querySelector("#project-list"),
  projectDeleteModal: document.querySelector("#project-delete-modal"),
  projectDeleteName: document.querySelector("#project-delete-name"),
  projectDeleteConfirm: document.querySelector("[data-action='confirm-delete-project']"),
  quickAddForm: document.querySelector("#quick-add-form"),
  taskCount: document.querySelector("#task-count"),
  taskHistoryContent: document.querySelector("#task-history-content"),
  taskHistoryModal: document.querySelector("#task-history-modal"),
  taskHistorySummary: document.querySelector("#task-history-summary"),
  taskList: document.querySelector("#task-list"),
  todayLabel: document.querySelector("#today-label"),
  toast: document.querySelector("#toast"),
  weatherCondition: document.querySelector("#weather-condition"),
  weatherIcon: document.querySelector("#weather-icon"),
  weatherTemperature: document.querySelector("#weather-temperature"),
  weatherRainNotice: document.querySelector("#weather-rain-notice"),
  sales: document.querySelector("#sales-content"),
  salesCount: document.querySelector("#sales-count"),
  salesModal: document.querySelector("#sales-modal"),
  salesModalContent: document.querySelector("#sales-modal-content"),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeProject(project) {
  if (!project || typeof project !== "object") return null;
  const submittedName = String(project.name || "").trim();
  const managedProject = canonicalManagedProject(submittedName);
  const name = String(managedProject?.name || submittedName).trim();
  const focus = String(managedProject?.focus || project.focus || "").trim();
  const next = String(managedProject?.next || project.next || project.nextAction || "").trim();
  if (!name || !focus || !next) return null;

  const now = new Date().toISOString();
  return {
    id: String(project.id || createProjectId()),
    name,
    focus,
    next,
    progress: Math.min(100, Math.max(0, Math.round(Number(
      managedProject?.progress ?? project.progress,
    ) || 0))),
    accent: (managedProject?.accent || project.accent) === "blue" ? "blue" : "slate",
    archived: Boolean(project.archived),
    createdAt: String(project.createdAt || now),
    updatedAt: String(project.updatedAt || project.createdAt || now),
  };
}

function normalizeTask(task) {
  if (!task || typeof task !== "object") return null;
  const title = String(task.title || "").trim();
  if (!title) return null;
  return {
    id: String(task.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    title,
    createdDate: /^\d{4}-\d{2}-\d{2}$/.test(String(task.createdDate || "")) ? task.createdDate : vietnamDateKey(),
    createdAt: String(task.createdAt || new Date().toISOString()),
    done: Boolean(task.done),
    completedAt: task.completedAt ? String(task.completedAt) : null,
  };
}

function loadTasks() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(TODO_STORAGE_KEY));
    if (!Array.isArray(saved)) return clone(seedTasks);
    return saved.map(normalizeTask).filter(Boolean);
  } catch {
    window.localStorage.removeItem(TODO_STORAGE_KEY);
    return clone(seedTasks);
  }
}

function loadPendingProjectArchives() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROJECT_PENDING_ARCHIVES_KEY));
    return Array.isArray(saved) ? [...new Set(saved.map(String).filter(Boolean))] : [];
  } catch {
    return [];
  }
}

function savePendingProjectArchives(ids) {
  window.localStorage.setItem(
    PROJECT_PENDING_ARCHIVES_KEY,
    JSON.stringify([...new Set(ids.map(String).filter(Boolean))]),
  );
}

function queueProjectArchive(id) {
  savePendingProjectArchives([...loadPendingProjectArchives(), String(id)]);
}

function clearProjectArchive(id) {
  savePendingProjectArchives(
    loadPendingProjectArchives().filter((item) => item !== String(id)),
  );
}

function loadPendingTaskCompletions() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(TODO_PENDING_COMPLETIONS_KEY));
    return Array.isArray(saved) ? [...new Set(saved.map(String).filter(Boolean))] : [];
  } catch {
    return [];
  }
}

function savePendingTaskCompletions(ids) {
  window.localStorage.setItem(TODO_PENDING_COMPLETIONS_KEY, JSON.stringify([...new Set(ids.map(String))]));
}

function queueTaskCompletion(id) {
  savePendingTaskCompletions([...loadPendingTaskCompletions(), String(id)]);
}

function clearTaskCompletion(id) {
  savePendingTaskCompletions(loadPendingTaskCompletions().filter((item) => item !== String(id)));
}

function loadState() {
  const fallback = {
    tasks: loadTasks(),
    projects: clone(seedProjects).map(normalizeProject).filter(Boolean),
    gmailDismissedIds: [],
    gmailPinnedIds: [],
  };

  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    return {
      tasks: fallback.tasks,
      projects: Array.isArray(saved.projects) ? saved.projects.map(normalizeProject).filter(Boolean) : fallback.projects.map(normalizeProject).filter(Boolean),
      gmailDismissedIds: Array.isArray(saved.gmailDismissedIds) ? saved.gmailDismissedIds.map(String).slice(-200) : [],
      gmailPinnedIds: Array.isArray(saved.gmailPinnedIds) ? saved.gmailPinnedIds.map(String).slice(-50) : [],
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return fallback;
  }
}

function saveState() {
  const dashboardState = {
    projects: state.projects,
    gmailDismissedIds: state.gmailDismissedIds,
    gmailPinnedIds: state.gmailPinnedIds,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboardState));
  window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(state.tasks));
}
