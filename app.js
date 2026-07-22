const STORAGE_KEY = "joy-dashboard-sample";
const GOOGLE_CLIENT_ID = "711309621878-a4tq37k2bnojpsmtthf37c903ktbupia.apps.googleusercontent.com";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_INBOX_URL = "https://mail.google.com/mail/u/0/#inbox";

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
const gmail = {
  status: "sdk-loading",
  tokenClient: null,
  accessToken: null,
  expiresAt: 0,
  messages: [],
  error: "",
};
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
    gmailDismissedIds: [],
    gmailPinnedIds: [],
    pendingConfirmed: false,
  };

  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    return {
      tasks: Array.isArray(saved.tasks) ? saved.tasks : fallback.tasks,
      projects: Array.isArray(saved.projects) ? saved.projects : fallback.projects,
      gmailDismissedIds: Array.isArray(saved.gmailDismissedIds) ? saved.gmailDismissedIds.map(String).slice(-200) : [],
      gmailPinnedIds: Array.isArray(saved.gmailPinnedIds) ? saved.gmailPinnedIds.map(String).slice(-50) : [],
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
  const taskLabel = `${dueCount} ${dueCount === 1 ? "task" : "tasks"} due today`;
  let emailLabel = "Gmail not connected";
  if (["authorizing", "loading-messages"].includes(gmail.status)) emailLabel = "checking Gmail";
  if (gmail.status === "connected") {
    const count = gmail.messages.filter((message) => message.unread).length;
    emailLabel = count ? `${count} unread ${count === 1 ? "email" : "emails"}` : "no unread email";
  }
  elements.brief.innerHTML = `You have <strong>2 customer viewings</strong>, <strong>${taskLabel}</strong>, and <strong>${emailLabel}</strong>.`;
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

  const pin = makeButton("", "toggle-email-pin", "gmail-square-button gmail-pin-button");
  pin.dataset.emailId = message.id;
  pin.setAttribute("aria-pressed", String(isEmailPinned(message.id)));
  pin.setAttribute("aria-label", isEmailPinned(message.id) ? "Unpin email" : "Pin email");
  pin.title = isEmailPinned(message.id) ? "Remove pin" : "Keep this email at the top";

  const read = makeButton("", "dismiss-email", "gmail-square-button gmail-read-button");
  read.dataset.emailId = message.id;
  read.setAttribute("aria-label", "Mark as read in Joy");
  read.title = "Hide this email from Joy";

  messageActions.append(open, pin, read);

  copy.append(meta, subject, snippet, messageActions);
  article.append(avatar, copy);
  return article;
}

function renderEmail() {
  if (gmail.status === "sdk-loading") {
    renderGmailNotice({ icon: "…", title: "Preparing Gmail", copy: "Joy is loading Google's secure sign-in." });
    return;
  }

  if (gmail.status === "authorizing") {
    renderGmailNotice({ icon: "…", title: "Waiting for Google", copy: "Choose the Gmail account you want Joy to read." });
    return;
  }

  if (gmail.status === "loading-messages") {
    renderGmailNotice({ icon: "↻", title: "Checking your inbox", copy: "Joy is loading up to five unread messages." });
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
      title: "Connect your Gmail",
      copy: "See up to five unread inbox messages here. Google will ask you to approve read-only access.",
      buttonLabel: "Connect Gmail",
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
    ? `${gmail.messages.length} ${gmail.messages.length === 1 ? "message" : "messages"}`
    : "Inbox is clear";
  status.append(dot, statusCopy);

  const actions = document.createElement("div");
  actions.className = "gmail-actions";
  actions.append(makeButton("Refresh", "refresh-gmail", "gmail-action"));
  if (state.gmailDismissedIds.length) actions.append(makeButton("Restore", "restore-dismissed-emails", "gmail-action"));
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
    title.textContent = "You’re all caught up";
    const copy = document.createElement("p");
    copy.textContent = "There are no unread messages in your inbox.";
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
  if (!gmail.accessToken || Date.now() >= gmail.expiresAt - 60_000) {
    connectGmail();
    return;
  }
  fetchGmailMessages();
}

function disconnectGmail() {
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

function toggleEmailPin(id) {
  const emailId = String(id || "");
  if (!emailId) return;

  if (isEmailPinned(emailId)) {
    state.gmailPinnedIds = state.gmailPinnedIds.filter((item) => item !== emailId);
    showToast("Email unpinned");
  } else {
    state.gmailPinnedIds = [emailId, ...state.gmailPinnedIds.filter((item) => item !== emailId)].slice(0, 50);
    showToast("Email pinned to the top");
  }

  gmail.messages = sortGmailMessages(gmail.messages);
  saveState();
  renderEmail();
}

function dismissEmail(id) {
  const emailId = String(id || "");
  if (!emailId) return;

  state.gmailDismissedIds = [...state.gmailDismissedIds.filter((item) => item !== emailId), emailId].slice(-200);
  state.gmailPinnedIds = state.gmailPinnedIds.filter((item) => item !== emailId);
  gmail.messages = gmail.messages.filter((message) => String(message.id) !== emailId);
  saveState();
  renderBrief();
  renderEmail();
  showToast("Email hidden from Joy");
}

function restoreDismissedEmails() {
  state.gmailDismissedIds = [];
  saveState();
  showToast("Hidden emails restored");
  fetchGmailMessages();
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
  if (action === "connect-gmail") connectGmail();
  if (action === "refresh-gmail") refreshGmail();
  if (action === "disconnect-gmail") disconnectGmail();
  if (action === "toggle-email-pin") toggleEmailPin(control.dataset.emailId);
  if (action === "dismiss-email") dismissEmail(control.dataset.emailId);
  if (action === "restore-dismissed-emails") restoreDismissedEmails();
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
  if (action === "view-inbox") window.open(GMAIL_INBOX_URL, "_blank", "noopener,noreferrer");
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
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navigationLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
  }, { rootMargin: "-30% 0px -60%", threshold: [0, 0.25, 0.5] });
  sections.forEach((section) => observer.observe(section));
}

renderHeader();
render();
loadGoogleIdentity();
