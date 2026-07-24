const STORAGE_KEY = "joy-dashboard-sample";
const TODO_STORAGE_KEY = "joy-dashboard-todos-v1";
const TODO_PENDING_COMPLETIONS_KEY = "joy-dashboard-todo-pending-completions-v1";
const SCRATCHPAD_KEY = "joy-dashboard-scratchpad";
const SCRATCHPAD_META_KEY = "joy-dashboard-scratchpad-cloud-meta-v1";
const SCRATCHPAD_CONFLICT_BACKUP_KEY = "joy-dashboard-scratchpad-conflict-backup-v1";
const PROJECT_PENDING_ARCHIVES_KEY = "joy-dashboard-project-pending-archives-v1";
const GOOGLE_CLIENT_ID = "711309621878-a4tq37k2bnojpsmtthf37c903ktbupia.apps.googleusercontent.com";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_INBOX_URL = "https://mail.google.com/mail/u/0/#inbox";
const CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
const GMAIL_AUTO_REFRESH_MS = 60_000;
const SALES_AUTO_REFRESH_MS = 60_000;
const WEATHER_REFRESH_MS = 15 * 60_000;
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current=temperature_2m,apparent_temperature,weather_code&hourly=precipitation_probability,precipitation,weather_code&timezone=Asia%2FHo_Chi_Minh&forecast_days=1";

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
    progress: 32,
    accent: "blue",
    focus: "Speaking fluency",
    next: "Complete a Part 2 mock",
  },
];

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
  scratchpadVersion: 0,
  scratchpadUpdatedAt: 0,
  scratchpadReady: false,
  scratchpadSaving: false,
  projectsReady: false,
};

let toastTimer;
let scratchSaveTimer;
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
  scratchpad: document.querySelector("#scratchpad-input"),
  scratchpadStatus: document.querySelector("#scratchpad-status"),
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
  const name = String(project.name || "").trim();
  const focus = String(project.focus || "").trim();
  const next = String(project.next || project.nextAction || "").trim();
  if (!name || !focus || !next) return null;

  const now = new Date().toISOString();
  return {
    id: String(project.id || createProjectId()),
    name,
    focus,
    next,
    progress: Math.min(100, Math.max(0, Math.round(Number(project.progress) || 0))),
    accent: project.accent === "blue" ? "blue" : "slate",
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

function loadScratchpadMeta() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SCRATCHPAD_META_KEY));
    return saved && typeof saved === "object"
      ? {
          version: Number(saved.version || 0),
          updatedAt: Number(saved.updatedAt || 0),
        }
      : { version: 0, updatedAt: 0 };
  } catch {
    return { version: 0, updatedAt: 0 };
  }
}

function saveScratchpadMeta(scratchpad) {
  const meta = {
    version: Number(scratchpad?.version || 0),
    updatedAt: Number(scratchpad?.updatedAt || 0),
  };
  accountSync.scratchpadVersion = meta.version;
  accountSync.scratchpadUpdatedAt = meta.updatedAt;
  window.localStorage.setItem(SCRATCHPAD_META_KEY, JSON.stringify(meta));
}

function loadScratchpad() {
  try {
    elements.scratchpad.value = window.localStorage.getItem(SCRATCHPAD_KEY) || "";
    const meta = loadScratchpadMeta();
    accountSync.scratchpadVersion = meta.version;
    accountSync.scratchpadUpdatedAt = meta.updatedAt;
    elements.scratchpadStatus.textContent = CLOUD_BACKEND ? "Local" : "Saved";
  } catch {
    elements.scratchpadStatus.textContent = "Unavailable";
  }
}

function saveScratchpadLocally(content) {
  window.localStorage.setItem(SCRATCHPAD_KEY, content);
}

async function saveCloudScratchpad() {
  if (!CLOUD_BACKEND || !accountSync.connected || accountSync.scratchpadSaving) return;
  accountSync.scratchpadSaving = true;
  elements.scratchpadStatus.textContent = "Syncing";

  try {
    const content = elements.scratchpad.value;
    const payload = await backendRequest("/api/scratchpad", {
      method: "PUT",
      body: JSON.stringify({
        content,
        baseVersion: accountSync.scratchpadVersion,
      }),
    });
    saveScratchpadMeta(payload.scratchpad);
    saveScratchpadLocally(payload.scratchpad.content);
    elements.scratchpadStatus.textContent = "Synced";
  } catch (error) {
    if (error.status === 409) {
      try {
        window.localStorage.setItem(SCRATCHPAD_CONFLICT_BACKUP_KEY, elements.scratchpad.value);
        const latest = await backendRequest("/api/scratchpad");
        const cloud = latest.scratchpad;
        elements.scratchpad.value = cloud.content || "";
        saveScratchpadLocally(elements.scratchpad.value);
        saveScratchpadMeta(cloud);
        elements.scratchpadStatus.textContent = "Updated";
        showToast("Scratchpad changed on another device · local draft backed up");
      } catch {
        elements.scratchpadStatus.textContent = "Offline";
      }
    } else {
      elements.scratchpadStatus.textContent = error.status === 401 ? "Local" : "Offline";
    }
  } finally {
    accountSync.scratchpadSaving = false;
  }
}

function queueScratchpadSave() {
  elements.scratchpadStatus.textContent = accountSync.connected ? "Saving" : "Local";
  window.clearTimeout(scratchSaveTimer);
  scratchSaveTimer = window.setTimeout(async () => {
    try {
      saveScratchpadLocally(elements.scratchpad.value);
      if (accountSync.connected) {
        await saveCloudScratchpad();
      } else {
        elements.scratchpadStatus.textContent = "Local";
      }
    } catch {
      elements.scratchpadStatus.textContent = "Not saved";
    }
  }, 700);
}

async function syncCloudScratchpad({ silent = false } = {}) {
  if (!CLOUD_BACKEND || !accountSync.connected) return false;
  if (!silent) elements.scratchpadStatus.textContent = "Syncing";

  try {
    const localContent = window.localStorage.getItem(SCRATCHPAD_KEY) || "";
    const localMeta = loadScratchpadMeta();
    const payload = await backendRequest("/api/scratchpad");
    const cloud = payload.scratchpad;

    if (!cloud.exists) {
      if (localContent) {
        accountSync.scratchpadVersion = 0;
        elements.scratchpad.value = localContent;
        await saveCloudScratchpad();
      } else {
        saveScratchpadMeta(cloud);
        elements.scratchpadStatus.textContent = "Synced";
      }
      accountSync.scratchpadReady = true;
      return true;
    }

    if (localContent && localContent !== cloud.content && localMeta.version === cloud.version) {
      accountSync.scratchpadVersion = cloud.version;
      elements.scratchpad.value = localContent;
      await saveCloudScratchpad();
      accountSync.scratchpadReady = true;
      return true;
    }

    if (localContent && localContent !== cloud.content && localMeta.version === 0) {
      window.localStorage.setItem(SCRATCHPAD_CONFLICT_BACKUP_KEY, localContent);
    }

    elements.scratchpad.value = cloud.content || "";
    saveScratchpadLocally(elements.scratchpad.value);
    saveScratchpadMeta(cloud);
    accountSync.scratchpadReady = true;
    elements.scratchpadStatus.textContent = "Synced";
    return true;
  } catch (error) {
    if (!silent) {
      elements.scratchpadStatus.textContent = error.status === 401 ? "Local" : "Offline";
    }
    return false;
  }
}

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

function weatherDetails(code) {
  if (code === 0) return { label: "Clear sky", icon: "☀" };
  if (code === 1) return { label: "Mostly clear", icon: "☀" };
  if (code === 2) return { label: "Partly cloudy", icon: "☁" };
  if (code === 3) return { label: "Overcast", icon: "☁" };
  if ([45, 48].includes(code)) return { label: "Foggy", icon: "≋" };
  if (code >= 51 && code <= 57) return { label: "Light drizzle", icon: "☂" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", icon: "☂" };
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { label: "Snow", icon: "❄" };
  if (code >= 95) return { label: "Thunderstorm", icon: "ϟ" };
  return { label: "Current weather", icon: "◌" };
}

async function loadWeather() {
  try {
    const response = await window.fetch(WEATHER_ENDPOINT, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
    const payload = await response.json();
    const current = payload?.current;
    const temperature = Number(current?.temperature_2m);
    const apparent = Number(current?.apparent_temperature);
    const code = Number(current?.weather_code);
    if (!Number.isFinite(temperature) || !Number.isFinite(code)) throw new Error("Weather data is incomplete");

    const details = weatherDetails(code);
    elements.weatherTemperature.textContent = `${Math.round(temperature)}°`;
    elements.weatherIcon.textContent = details.icon;
    elements.weatherCondition.textContent = Number.isFinite(apparent)
      ? `${details.label} · Feels ${Math.round(apparent)}°`
      : details.label;

    const rainSummary = window.JoyWeather?.summarizeRainForecast(
      payload?.hourly,
      new Date(),
    ) || {
      state: "unavailable",
      text: "Rain forecast unavailable",
    };

    const showRainNotice = rainSummary.state === "rain";

    elements.weatherRainNotice.hidden = !showRainNotice;
    elements.weatherRainNotice.textContent = rainSummary.text;
    elements.weatherRainNotice.dataset.state = rainSummary.state;
  } catch {
    elements.weatherTemperature.textContent = "—";
    elements.weatherIcon.textContent = "◌";
    elements.weatherCondition.textContent = "Weather unavailable";
    elements.weatherRainNotice.hidden = true;
    elements.weatherRainNotice.textContent = "";
    elements.weatherRainNotice.dataset.state = "unavailable";
  }
}

function isEmailPinned(id) {
  return state.gmailPinnedIds.includes(String(id));
}

function sortGmailMessages(messages) {
  return [...messages].sort((a, b) => {
    const aIndex = state.gmailPinnedIds.indexOf(String(a.id));
    const bIndex = state.gmailPinnedIds.indexOf(String(b.id));
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return 0;
  });
}

function renderBrief() {
  const dueCount = state.tasks.filter((task) => !task.done).length;
  const taskLabel = `${dueCount} open ${dueCount === 1 ? "task" : "tasks"}`;
  let emailLabel = "Gmail not connected";
  if (["authorizing", "loading-messages"].includes(gmail.status)) emailLabel = "checking Gmail";
  if (gmail.status === "connected") {
    const count = gmail.messages.filter((message) => message.unread).length;
    emailLabel = count ? `${count} new ${count === 1 ? "email" : "emails"}` : "no new email";
  }
  const viewingCount = sales.status === "ready" ? sales.viewings.length : 0;
  const viewingLabel = sales.status === "ready"
    ? `${viewingCount} upcoming ${viewingCount === 1 ? "viewing" : "viewings"}`
    : "sales awaiting sync";
  elements.brief.innerHTML = `You have <strong>${viewingLabel}</strong>, <strong>${taskLabel}</strong>, and <strong>${emailLabel}</strong>.`;
}

function makeButton(label, action, className = "secondary-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function renderGmailNotice({ icon = "G", title, copy, buttonLabel, action, error = false }) {
  const card = document.createElement("div");
  card.className = `gmail-connect${error ? " gmail-connect-error" : ""}`;

  const badge = document.createElement("span");
  badge.className = "gmail-brand";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = icon;

  const heading = document.createElement("h3");
  heading.textContent = title;

  const description = document.createElement("p");
  description.textContent = copy;

  card.append(badge, heading, description);
  if (buttonLabel && action) card.append(makeButton(buttonLabel, action, "primary-button gmail-connect-button"));

  const privacy = document.createElement("small");
  privacy.textContent = "Read-only access · Joy cannot send or delete email";
  card.append(privacy);
  elements.email.replaceChildren(card);
}

function senderName(from) {
  const withoutAddress = String(from || "Unknown sender").replace(/\s*<[^>]+>\s*$/, "").replace(/^"|"$/g, "").trim();
  return withoutAddress || String(from || "Unknown sender").split("@")[0];
}

function senderInitials(name) {
  const words = String(name).split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : words[0]?.slice(0, 2) || "?").toUpperCase();
}

function formatEmailDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
  return new Intl.DateTimeFormat("en-US", sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric" }).format(date);
}

function renderGmailMessage(message) {
  const article = document.createElement("article");
  article.className = "gmail-message";
  article.classList.toggle("pinned", isEmailPinned(message.id));

  const avatar = document.createElement("div");
  avatar.className = "sender-avatar";
  avatar.textContent = senderInitials(message.sender);

  const copy = document.createElement("div");
  copy.className = "email-copy";

  const meta = document.createElement("div");
  meta.className = "email-meta";
  const sender = document.createElement("strong");
  sender.textContent = message.sender;
  const time = document.createElement("time");
  time.dateTime = message.date || "";
  time.textContent = formatEmailDate(message.date);
  meta.append(sender, time);

  const subject = document.createElement("h3");
  subject.textContent = message.subject || "(No subject)";
  const snippet = document.createElement("p");
  snippet.textContent = message.snippet || "No preview available.";

  const open = document.createElement("a");
  open.className = "gmail-message-link";
  open.href = `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.threadId)}`;
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.textContent = "Open ↗";

  const messageActions = document.createElement("div");
  messageActions.className = "gmail-message-actions";

  const pinned = isEmailPinned(message.id);
  const pin = makeButton("", "toggle-email-pin", "gmail-square-button gmail-pin-button");
  pin.dataset.emailId = message.id;
  pin.setAttribute("aria-pressed", String(pinned));
  pin.setAttribute("aria-label", pinned ? "Unpin email" : "Pin email");
  pin.title = pinned ? "Remove pin" : "Keep this email at the top";
  pin.innerHTML = `<svg class="gmail-pin-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path class="gmail-pin-head" d="M9 3.5h6v4l2.5 2.5v1.5h-11V10L9 7.5Z"></path>
    <path d="M12 11.5V21"></path>
  </svg>`;

  const read = makeButton("", "dismiss-email", "gmail-square-button gmail-read-button");
  read.dataset.emailId = message.id;
  read.setAttribute("aria-label", "Done with this email");
  read.title = "Đã đọc · remove from Joy";

  messageActions.append(open, pin, read);

  copy.append(meta, subject, snippet, messageActions);
  article.append(avatar, copy);
  return article;
}

function renderEmail() {
  if (gmail.status === "sdk-loading") {
    renderGmailNotice({ icon: "…", title: "Loading Gmail", copy: "Joy is checking the secure connection." });
    return;
  }

  if (gmail.status === "authorizing") {
    renderGmailNotice({ icon: "…", title: "Waiting for Google", copy: "Choose the Gmail account you want Joy to read." });
    return;
  }

  if (gmail.status === "loading-messages") {
    renderGmailNotice({ icon: "↻", title: "Checking for new mail", copy: "Joy is looking only for email received after tracking started." });
    return;
  }

  if (gmail.status === "error") {
    renderGmailNotice({
      icon: "!",
      title: "Gmail could not connect",
      copy: gmail.error || "Please try connecting again.",
      buttonLabel: "Try again",
      action: "connect-gmail",
      error: true,
    });
    return;
  }

  if (gmail.status !== "connected") {
    renderGmailNotice({
      title: CLOUD_BACKEND ? "Connect Gmail once" : "Connect your Gmail",
      copy: CLOUD_BACKEND
        ? "Joy will only surface email that arrives after tracking starts."
        : "Joy will show up to five new inbox messages received from now on.",
      buttonLabel: CLOUD_BACKEND ? "Connect once" : "Connect Gmail",
      action: "connect-gmail",
    });
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "gmail-inbox";
  const toolbar = document.createElement("div");
  toolbar.className = "gmail-toolbar";
  const status = document.createElement("div");
  status.className = "gmail-status";
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  const statusCopy = document.createElement("strong");
  statusCopy.textContent = gmail.messages.length
    ? `${CLOUD_BACKEND ? "Auto · " : ""}${gmail.messages.length} new ${gmail.messages.length === 1 ? "message" : "messages"}`
    : `${CLOUD_BACKEND ? "Auto · " : ""}No new mail`;
  status.append(dot, statusCopy);

  const actions = document.createElement("div");
  actions.className = "gmail-actions";
  actions.append(makeButton("Refresh", "refresh-gmail", "gmail-action"));
  actions.append(makeButton("Disconnect", "disconnect-gmail", "gmail-action"));
  toolbar.append(status, actions);
  wrapper.append(toolbar);

  if (gmail.messages.length) {
    const list = document.createElement("div");
    list.className = "gmail-list";
    sortGmailMessages(gmail.messages).forEach((message) => list.append(renderGmailMessage(message)));
    wrapper.append(list);
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-state gmail-empty";
    const check = document.createElement("span");
    check.textContent = "✓";
    const title = document.createElement("strong");
    title.textContent = "No new mail";
    const copy = document.createElement("p");
    copy.textContent = "Joy will show only email received after tracking started.";
    empty.append(check, title, copy);
    wrapper.append(empty);
  }

  elements.email.replaceChildren(wrapper);
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
      copy.textContent = "Joy is checking the Appointments sheet.";
    } else if (sales.status === "authorization-required") {
      title.textContent = "Connect the viewing sheet once";
      copy.textContent = "Approve read-only access so Joy can show live appointments.";
      notice.append(title, copy, makeButton("Connect Sheet", "connect-sales", "primary-button"));
      elements.sales.replaceChildren(notice);
      renderSalesModal();
      return;
    } else if (sales.status === "unavailable") {
      title.textContent = "Live sales stays private";
      copy.textContent = "Open the secure Joy Cloudflare app to see customer appointments.";
    } else {
      title.textContent = "Viewing schedule could not sync";
      copy.textContent = sales.errorCode === "SHEETS_API_DISABLED"
        ? "Google Sheets API still needs to be enabled for Joy."
        : "Check the Sheet connection, then try again.";
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
    copy.textContent = "Past appointments are hidden automatically.";
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

function renderSalesModal() {
  if (sales.status !== "ready" || !sales.viewings.length) {
    const empty = document.createElement("div");
    empty.className = "sales-modal-empty";
    empty.textContent = sales.status === "ready"
      ? "There are no upcoming appointments in the Sheet."
      : "The live appointment list is not available yet.";
    elements.salesModalContent.replaceChildren(empty);
    return;
  }

  const scroll = document.createElement("div");
  scroll.className = "sales-table-scroll";
  const table = document.createElement("table");
  table.className = "sales-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Customer", "Phone", "Viewing address", "Viewing time", "Before email", "Follow-up email"].forEach((label) => {
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
      viewing.viewingTime,
      viewing.beforeStatus || "—",
      viewing.afterStatus || "—",
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

async function backendRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await window.fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Joy server returned ${response.status}`);
    error.status = response.status;
    error.code = payload.error || "";
    throw error;
  }
  return payload;
}

async function fetchCloudSales({ silent = false } = {}) {
  if (!silent) {
    sales.status = "loading";
    renderBrief();
    renderSales();
  }

  try {
    const payload = await backendRequest("/api/sales/viewings");
    sales.viewings = Array.isArray(payload.viewings) ? payload.viewings : [];
    sales.fetchedAt = Number(payload.fetchedAt || Date.now());
    sales.errorCode = "";
    sales.status = "ready";
    startSalesAutoRefresh();
  } catch (error) {
    sales.viewings = [];
    sales.errorCode = error.code || "SALE_SYNC_FAILED";
    if (error.status === 401 || error.code === "SHEETS_AUTHORIZATION_REQUIRED") {
      sales.status = "authorization-required";
    } else {
      sales.status = "error";
    }
  }
  renderBrief();
  renderSales();
}

function startSalesAutoRefresh() {
  if (!CLOUD_BACKEND) return;
  window.clearInterval(salesAutoRefreshTimer);
  salesAutoRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") fetchCloudSales({ silent: true });
  }, SALES_AUTO_REFRESH_MS);
}

async function initializeCloudGmail() {
  gmail.status = "sdk-loading";
  renderBrief();
  renderEmail();
  try {
    const session = await backendRequest("/api/session");
    if (!session.connected) {
      accountSync.connected = false;
      accountSync.email = "";
      gmail.status = "disconnected";
      elements.scratchpadStatus.textContent = "Local";
      renderBrief();
      renderEmail();
      return;
    }
    accountSync.connected = true;
    accountSync.email = session.email || "";
    await syncCloudScratchpad();
    await syncCloudProjects();
    await fetchCloudEmails();
  } catch {
    gmail.status = "error";
    gmail.error = "Joy's secure Gmail service is not ready yet.";
    renderBrief();
    renderEmail();
  }
}

async function fetchCloudEmails({ silent = false } = {}) {
  if (!silent) {
    gmail.status = "loading-messages";
    renderBrief();
    renderEmail();
  }

  try {
    const payload = await backendRequest("/api/emails");
    gmail.messages = Array.isArray(payload.messages) ? payload.messages : [];
    gmail.hiddenCount = Number(payload.hiddenCount || 0);
    gmail.syncedAt = Number(payload.syncedAt || Date.now());
    state.gmailPinnedIds = gmail.messages.filter((message) => message.pinned).map((message) => String(message.id));
    gmail.status = "connected";
    gmail.error = "";
    saveState();
    renderBrief();
    renderEmail();
    startGmailAutoRefresh();
    if (payload.syncError && !gmail.messages.length && !silent) {
      showToast("Automatic Gmail sync is paused. Try Refresh, then reconnect if needed.");
    }
  } catch (error) {
    if (error.status === 401) {
      stopGmailAutoRefresh();
      gmail.status = "disconnected";
      gmail.error = "";
    } else if (!silent) {
      gmail.status = "error";
      gmail.error = "Joy could not reach the secure Gmail service. Please try again.";
    }
    renderBrief();
    renderEmail();
  }
}

function startGmailAutoRefresh() {
  if (!CLOUD_BACKEND) return;
  window.clearInterval(gmailAutoRefreshTimer);
  gmailAutoRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible" && gmail.status === "connected") {
      fetchCloudEmails({ silent: true });
    }
  }, GMAIL_AUTO_REFRESH_MS);
}

function stopGmailAutoRefresh() {
  window.clearInterval(gmailAutoRefreshTimer);
  gmailAutoRefreshTimer = null;
}

function gmailErrorMessage(status) {
  if (status === 401) return "Your Google session expired. Connect again to refresh it.";
  if (status === 403) return "Google blocked access. Add this Gmail address as a test user, then try again.";
  return "Joy could not reach Gmail. Check your connection and try again.";
}

async function gmailApi(path) {
  const response = await window.fetch(`${GMAIL_API_ROOT}${path}`, {
    headers: { Authorization: `Bearer ${gmail.accessToken}` },
  });
  if (!response.ok) {
    const error = new Error(gmailErrorMessage(response.status));
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function gmailHeader(message, name) {
  const headers = message.payload?.headers || [];
  return headers.find((header) => String(header.name).toLowerCase() === name.toLowerCase())?.value || "";
}

async function fetchGmailMessage(id) {
  const params = new URLSearchParams({ format: "metadata" });
  ["From", "Subject", "Date"].forEach((name) => params.append("metadataHeaders", name));
  const message = await gmailApi(`/messages/${encodeURIComponent(id)}?${params}`);
  return {
    id: message.id,
    threadId: message.threadId || message.id,
    sender: senderName(gmailHeader(message, "From")),
    subject: gmailHeader(message, "Subject"),
    date: gmailHeader(message, "Date"),
    snippet: message.snippet || "",
    unread: Array.isArray(message.labelIds) ? message.labelIds.includes("UNREAD") : true,
  };
}

async function fetchGmailMessages() {
  if (CLOUD_BACKEND) return fetchCloudEmails();
  if (!gmail.accessToken) return;
  gmail.status = "loading-messages";
  gmail.error = "";
  renderBrief();
  renderEmail();

  try {
    const query = new URLSearchParams({ maxResults: "25", q: "is:unread in:inbox" });
    const list = await gmailApi(`/messages?${query}`);
    const messageRefs = Array.isArray(list.messages) ? list.messages : [];
    const dismissed = new Set(state.gmailDismissedIds);
    const unreadIds = messageRefs.map(({ id }) => String(id)).filter((id) => !dismissed.has(id)).slice(0, 5);
    const pinnedIds = state.gmailPinnedIds.filter((id) => !dismissed.has(id));
    const ids = [...new Set([...pinnedIds, ...unreadIds])];
    const missingIds = [];
    const messages = (await Promise.all(ids.map(async (id) => {
      try {
        return await fetchGmailMessage(id);
      } catch (error) {
        if (error.status === 404) {
          missingIds.push(id);
          return null;
        }
        throw error;
      }
    }))).filter(Boolean);

    if (missingIds.length) {
      state.gmailPinnedIds = state.gmailPinnedIds.filter((id) => !missingIds.includes(id));
      saveState();
    }

    gmail.messages = sortGmailMessages(messages);
    gmail.status = "connected";
    renderBrief();
    renderEmail();
  } catch (error) {
    if (error.status === 401) {
      gmail.accessToken = null;
      gmail.expiresAt = 0;
    }
    gmail.status = "error";
    gmail.error = error.message || gmailErrorMessage(error.status);
    renderBrief();
    renderEmail();
  }
}

function handleGoogleToken(response) {
  if (!response || response.error || !response.access_token) {
    gmail.status = "error";
    gmail.error = "Google did not grant access. Please choose your account and try again.";
    renderBrief();
    renderEmail();
    return;
  }

  const scopeChecker = window.google?.accounts?.oauth2?.hasGrantedAllScopes;
  if (scopeChecker && !scopeChecker(response, GMAIL_SCOPE)) {
    gmail.status = "error";
    gmail.error = "Read-only Gmail permission was not approved.";
    renderBrief();
    renderEmail();
    return;
  }

  gmail.accessToken = response.access_token;
  gmail.expiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
  fetchGmailMessages();
}

function initializeGoogleIdentity() {
  try {
    gmail.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GMAIL_SCOPE,
      callback: handleGoogleToken,
      error_callback: () => {
        gmail.status = "disconnected";
        gmail.error = "";
        renderBrief();
        renderEmail();
      },
    });
    gmail.status = "disconnected";
    renderBrief();
    renderEmail();
  } catch {
    gmail.status = "error";
    gmail.error = "Google sign-in could not start. Refresh the page and try again.";
    renderBrief();
    renderEmail();
  }
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) {
    initializeGoogleIdentity();
    return;
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = initializeGoogleIdentity;
  script.onerror = () => {
    gmail.status = "error";
    gmail.error = "Google sign-in was blocked. Disable any blocker for this page, then refresh.";
    renderBrief();
    renderEmail();
  };
  document.head.append(script);
}

function connectGmail() {
  if (CLOUD_BACKEND) {
    window.location.assign("/auth/start");
    return;
  }
  if (!gmail.tokenClient) {
    gmail.status = "error";
    gmail.error = "Google sign-in is not ready yet. Refresh the page and try again.";
    renderEmail();
    return;
  }
  gmail.status = "authorizing";
  gmail.error = "";
  renderBrief();
  renderEmail();
  gmail.tokenClient.requestAccessToken();
}

function refreshGmail() {
  if (CLOUD_BACKEND) {
    fetchCloudEmails();
    return;
  }
  if (!gmail.accessToken || Date.now() >= gmail.expiresAt - 60_000) {
    connectGmail();
    return;
  }
  fetchGmailMessages();
}

async function disconnectGmail() {
  if (CLOUD_BACKEND) {
    try {
      await backendRequest("/api/disconnect", { method: "POST" });
      stopGmailAutoRefresh();
      gmail.accessToken = null;
      gmail.messages = [];
      gmail.hiddenCount = 0;
      gmail.status = "disconnected";
      accountSync.connected = false;
      accountSync.email = "";
      accountSync.scratchpadReady = false;
      accountSync.projectsReady = false;
      elements.scratchpadStatus.textContent = "Local";
      state.gmailPinnedIds = [];
      saveState();
      renderBrief();
      renderEmail();
      showToast("Gmail disconnected");
    } catch {
      showToast("Joy could not disconnect Gmail");
    }
    return;
  }
  const token = gmail.accessToken;
  gmail.accessToken = null;
  gmail.expiresAt = 0;
  gmail.messages = [];
  gmail.status = "disconnected";
  gmail.error = "";
  renderBrief();
  renderEmail();

  if (token && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(token, () => showToast("Gmail disconnected"));
  } else {
    showToast("Gmail disconnected");
  }
}

async function toggleEmailPin(id) {
  const emailId = String(id || "");
  if (!emailId) return;
  const willPin = !isEmailPinned(emailId);

  if (!willPin) {
    state.gmailPinnedIds = state.gmailPinnedIds.filter((item) => item !== emailId);
  } else {
    state.gmailPinnedIds = [emailId, ...state.gmailPinnedIds.filter((item) => item !== emailId)].slice(0, 50);
  }

  gmail.messages = sortGmailMessages(gmail.messages);
  saveState();
  renderEmail();
  showToast(willPin ? "Email pinned to the top" : "Email unpinned");

  if (CLOUD_BACKEND) {
    try {
      await backendRequest("/api/emails/pin", {
        method: "POST",
        body: JSON.stringify({ id: emailId, pinned: willPin }),
      });
    } catch {
      showToast("Pin could not be saved");
      fetchCloudEmails({ silent: true });
    }
  }
}

async function dismissEmail(id) {
  const emailId = String(id || "");
  if (!emailId) return;

  state.gmailDismissedIds = [...state.gmailDismissedIds.filter((item) => item !== emailId), emailId].slice(-200);
  state.gmailPinnedIds = state.gmailPinnedIds.filter((item) => item !== emailId);
  gmail.messages = gmail.messages.filter((message) => String(message.id) !== emailId);
  if (CLOUD_BACKEND) gmail.hiddenCount += 1;
  saveState();
  renderBrief();
  renderEmail();
  showToast("Done · removed from Joy");

  if (CLOUD_BACKEND) {
    try {
      await backendRequest("/api/emails/dismiss", {
        method: "POST",
        body: JSON.stringify({ id: emailId }),
      });
    } catch {
      showToast("Read status could not be saved");
      fetchCloudEmails({ silent: true });
    }
  }
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

function openProjectDeleteConfirmation(id) {
  const projectId = String(id || "");
  const project = state.projects.find(
    (item) => String(item.id) === projectId,
  );

  if (!project) {
    showToast("Project could not be found");
    return;
  }

  pendingProjectDeleteId = projectId;
  elements.projectDeleteName.textContent = project.name;
  elements.projectDeleteModal.hidden = false;
  document.body.classList.add("modal-open");

  window.setTimeout(() => {
    elements.projectDeleteConfirm?.focus();
  }, 0);
}

function closeProjectDeleteConfirmation() {
  pendingProjectDeleteId = "";
  elements.projectDeleteModal.hidden = true;

  if (
    elements.modal.hidden
    && elements.salesModal.hidden
    && elements.taskHistoryModal.hidden
  ) {
    document.body.classList.remove("modal-open");
  }
}

async function confirmProjectDelete() {
  const id = String(pendingProjectDeleteId || "");
  const project = state.projects.find(
    (item) => String(item.id) === id,
  );

  if (!id || !project) {
    closeProjectDeleteConfirmation();
    return;
  }

  state.projects = state.projects.filter(
    (item) => String(item.id) !== id,
  );

  queueProjectArchive(id);
  saveState();
  closeProjectDeleteConfirmation();
  renderBrief();
  renderProjects();
  showToast(`${project.name} removed from Active Projects`);

  if (!CLOUD_BACKEND || !accountSync.connected) return;

  try {
    await backendRequest("/api/projects/archive", {
      method: "POST",
      body: JSON.stringify({ id }),
    });

    clearProjectArchive(id);
    showToast(`${project.name} removed · synced`);
  } catch (error) {
    if (error.status === 404) {
      clearProjectArchive(id);
      return;
    }

    showToast(`${project.name} removed here · will sync when online`);
  }
}

function openSalesModal() {
  renderSalesModal();
  elements.salesModal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => elements.salesModal.querySelector("[data-action='close-sales']")?.focus(), 0);
}

function closeSalesModal() {
  elements.salesModal.hidden = true;
  if (
    elements.modal.hidden
    && elements.taskHistoryModal.hidden
    && elements.projectDeleteModal.hidden
  ) document.body.classList.remove("modal-open");
}

async function syncCloudProjects({ silent = false } = {}) {
  if (!CLOUD_BACKEND || !accountSync.connected) return false;

  try {
    const localProjects = state.projects.map(normalizeProject).filter(Boolean);
    if (localProjects.length) {
      await backendRequest("/api/projects/import", {
        method: "POST",
        body: JSON.stringify({ projects: localProjects }),
      });
    }

    for (const id of loadPendingProjectArchives()) {
      try {
        await backendRequest("/api/projects/archive", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
        clearProjectArchive(id);
      } catch (error) {
        if (error.status === 404) clearProjectArchive(id);
        else throw error;
      }
    }

    const payload = await backendRequest("/api/projects");
    state.projects = Array.isArray(payload.projects)
      ? payload.projects.map(normalizeProject).filter((project) => project && !project.archived)
      : [];
    accountSync.projectsReady = true;
    saveState();
    renderProjects();
    return true;
  } catch (error) {
    if (!silent && error.status !== 401) {
      showToast("Projects are offline · changes stay on this device");
    }
    return false;
  }
}

async function syncCloudTasks({ silent = false } = {}) {
  if (!CLOUD_BACKEND) return false;
  try {
    // Existing local tasks are imported once by stable id. D1 keeps its copy authoritative
    // when an id already exists, so an older browser cache cannot undo cloud changes.
    if (state.tasks.length) {
      await backendRequest("/api/tasks/import", {
        method: "POST",
        body: JSON.stringify({ tasks: state.tasks }),
      });
    }
    for (const id of loadPendingTaskCompletions()) {
      try {
        await backendRequest("/api/tasks/complete", { method: "POST", body: JSON.stringify({ id }) });
        clearTaskCompletion(id);
      } catch (error) {
        if (error.status === 404) clearTaskCompletion(id);
        else throw error;
      }
    }
    const payload = await backendRequest("/api/tasks");
    state.tasks = Array.isArray(payload.tasks) ? payload.tasks.map(normalizeTask).filter(Boolean) : [];
    saveState();
    renderBrief();
    renderTasks();
    renderTaskHistory();
    return true;
  } catch (error) {
    if (!silent && error.status !== 401) showToast("To-do is offline · changes stay on this device");
    return false;
  }
}

function openTaskHistory() {
  renderTaskHistory();
  elements.taskHistoryModal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => elements.taskHistoryModal.querySelector("[data-action='close-task-history']")?.focus(), 0);
}

function closeTaskHistory() {
  elements.taskHistoryModal.hidden = true;
  if (
    elements.modal.hidden
    && elements.salesModal.hidden
    && elements.projectDeleteModal.hidden
  ) document.body.classList.remove("modal-open");
}

elements.quickAddForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = elements.quickAddForm.elements.task;
  const title = input.value.trim();
  if (!title) return;
  const now = new Date();
  state.tasks.push({
    id: createTaskId(),
    title,
    createdDate: vietnamDateKey(now),
    createdAt: now.toISOString(),
    done: false,
    completedAt: null,
  });
  input.value = "";
  saveState();
  render();
  input.focus();
  if (CLOUD_BACKEND) {
    try {
      await backendRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify(state.tasks.at(-1)),
      });
      showToast(`Task synced · ${formatTaskDate(vietnamDateKey(now))}`);
    } catch (error) {
      showToast(error.status === 401 ? "Saved here · connect Google to sync" : "Saved here · will sync when online");
    }
  } else {
    showToast(`Task added · ${formatTaskDate(vietnamDateKey(now))}`);
  }
});

elements.scratchpad.addEventListener("input", queueScratchpadSave);

elements.projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.projectForm);
  const name = String(form.get("name") || "").trim();
  const focus = String(form.get("focus") || "").trim();
  const next = String(form.get("next") || "").trim();
  if (!name || !focus || !next) return;

  const now = new Date().toISOString();
  const project = normalizeProject({
    id: createProjectId(),
    name,
    focus,
    next,
    progress: 10,
    accent: "slate",
    createdAt: now,
    updatedAt: now,
  });
  if (!project) return;

  state.projects.push(project);
  saveState();
  closeProjectForm();
  render();
  showToast(accountSync.connected ? `${name} added · syncing` : `${name} saved locally`);

  if (CLOUD_BACKEND && accountSync.connected) {
    try {
      const payload = await backendRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify(project),
      });
      const saved = normalizeProject(payload.project);
      if (saved) {
        state.projects = state.projects.map((item) => item.id === saved.id ? saved : item);
        saveState();
        renderProjects();
      }
      showToast(`${name} added · synced`);
    } catch (error) {
      showToast(error.status === 401
        ? `${name} saved here · connect Google to sync`
        : `${name} saved here · will sync when online`);
    }
  }
});

elements.taskList.addEventListener("change", async (event) => {
  const input = event.target.closest("input[data-task-id]");
  if (!input) return;
  const task = state.tasks.find((item) => String(item.id) === String(input.dataset.taskId));
  if (!task) return;
  task.done = true;
  task.completedAt = new Date().toISOString();
  queueTaskCompletion(task.id);
  saveState();
  render();
  if (CLOUD_BACKEND) {
    try {
      await backendRequest("/api/tasks/complete", {
        method: "POST",
        body: JSON.stringify({ id: task.id }),
      });
      clearTaskCompletion(task.id);
      showToast("Task completed · synced");
    } catch {
      showToast("Task completed here · will sync when online");
    }
  } else {
    showToast("Task completed");
  }
});

document.addEventListener("click", async (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;

  if (action === "open-project-form") openProjectForm();
  if (action === "close-project-form") closeProjectForm();
  if (action === "connect-gmail") connectGmail();
  if (action === "refresh-gmail") refreshGmail();
  if (action === "disconnect-gmail") disconnectGmail();
  if (action === "toggle-email-pin") toggleEmailPin(control.dataset.emailId);
  if (action === "dismiss-email") dismissEmail(control.dataset.emailId);
  if (action === "open-sales") openSalesModal();
  if (action === "close-sales") closeSalesModal();
  if (action === "open-sale-manager") window.location.assign("/sale-manager.html");
  if (action === "open-task-history") openTaskHistory();
  if (action === "close-task-history") closeTaskHistory();
  if (action === "open-finance-preview") showToast("Finance detail popups will be designed next");
  if (action === "refresh-sales") fetchCloudSales();
  if (action === "connect-sales") window.location.assign("/auth/start");
  if (action === "request-delete-project") {
    openProjectDeleteConfirmation(control.dataset.id);
  }
  if (action === "cancel-delete-project") {
    closeProjectDeleteConfirmation();
  }
  if (action === "confirm-delete-project") {
    await confirmProjectDelete();
  }
  if (action === "view-day") document.querySelector("#to-do").scrollIntoView({ behavior: "smooth", block: "center" });
  if (action === "view-inbox") window.open(GMAIL_INBOX_URL, "_blank", "noopener,noreferrer");
  if (action === "notifications") showToast("2 sample notifications");
  if (action === "sample-settings") showToast("Settings will be available in the live version");
});

elements.modal.addEventListener("mousedown", (event) => {
  if (event.target === elements.modal) closeProjectForm();
});

elements.salesModal.addEventListener("mousedown", (event) => {
  if (event.target === elements.salesModal) closeSalesModal();
});

elements.taskHistoryModal.addEventListener("mousedown", (event) => {
  if (event.target === elements.taskHistoryModal) closeTaskHistory();
});

elements.projectDeleteModal.addEventListener("mousedown", (event) => {
  if (event.target === elements.projectDeleteModal) {
    closeProjectDeleteConfirmation();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (!elements.projectDeleteModal.hidden) {
    closeProjectDeleteConfirmation();
  } else if (!elements.taskHistoryModal.hidden) {
    closeTaskHistory();
  } else if (!elements.salesModal.hidden) {
    closeSalesModal();
  } else if (!elements.modal.hidden) {
    closeProjectForm();
  }
});

const sections = [...document.querySelectorAll("#overview, #email, #sales, #projects, #finance, #to-do")];
const navigationLinks = [...document.querySelectorAll('.nav-list a[href^="#"], .mobile-nav a[href^="#"]')];
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navigationLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
  }, { rootMargin: "-30% 0px -60%", threshold: [0, 0.25, 0.5] });
  sections.forEach((section) => observer.observe(section));
}

loadScratchpad();
renderHeader();
render();
startTodoDayRefresh();
loadWeather();
window.setInterval(loadWeather, WEATHER_REFRESH_MS);
if (CLOUD_BACKEND) {
  initializeCloudGmail();
  fetchCloudSales();
  syncCloudTasks({ silent: true });
} else {
  loadGoogleIdentity();
}

document.addEventListener("visibilitychange", () => {
  if (CLOUD_BACKEND && document.visibilityState === "visible" && gmail.status === "connected") {
    fetchCloudEmails({ silent: true });
  }
  if (CLOUD_BACKEND && document.visibilityState === "visible" && sales.status === "ready") {
    fetchCloudSales({ silent: true });
  }
  if (CLOUD_BACKEND && document.visibilityState === "visible") {
    syncCloudTasks({ silent: true });
    if (accountSync.connected) syncCloudScratchpad({ silent: true });
    if (accountSync.connected) syncCloudProjects({ silent: true });
  }
});
