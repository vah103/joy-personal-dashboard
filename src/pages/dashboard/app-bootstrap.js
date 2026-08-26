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
    if (accountSync.connected) syncCloudProjects({ silent: true });
  }
});

const SALE_ROOM_SUMMARY_AI_ENDPOINT = "/api/sales/room-summary/polish";
const SALE_ROOM_SERVICE_KEYS = Object.freeze({
  "điện": "electricity",
  electricity: "electricity",
  "nước": "water",
  water: "water",
  "mạng": "internet",
  internet: "internet",
  "dịch vụ chung": "common",
  "common services": "common",
  "gửi xe": "parking",
  parking: "parking",
  "tủ lạnh": "fridge",
  fridge: "fridge",
  "giặt sấy": "laundry",
  laundry: "laundry",
  "khác": "other",
  other: "other",
});
let saleRoomAiRequestSequence = 0;

function normalizedRoomLabel(value) {
  return String(value || "").replace(/:\s*$/, "").trim().toLocaleLowerCase("vi");
}

function saleRoomPreviewStatus() {
  return document.querySelector(".sales-assistant-panel[data-assistant-panel=\"summary\"] .sale-room-preview-heading strong");
}

function setSaleRoomPreviewStatus(message) {
  const status = saleRoomPreviewStatus();
  if (status) status.textContent = message;
}

function roomSummarySection(card, labels) {
  const accepted = (Array.isArray(labels) ? labels : [labels]).map(normalizedRoomLabel);
  return [...card.querySelectorAll(".room-share-section")].find((section) => (
    accepted.includes(normalizedRoomLabel(section.querySelector(".room-share-section-title")?.textContent))
  )) || null;
}

function roomSummaryFurniture(card) {
  const row = [...card.querySelectorAll(".room-share-detail-row")].find((item) => {
    const label = normalizedRoomLabel(item.querySelector("strong")?.textContent);
    return label === "nội thất" || label === "furniture";
  });
  return {
    row,
    value: row?.querySelector(".room-share-detail-value")?.textContent?.trim() || "",
  };
}

function collectSaleRoomPolishInput(card) {
  const furniture = roomSummaryFurniture(card).value;
  const services = [...card.querySelectorAll(".room-share-services li")].map((item) => {
    const label = normalizedRoomLabel(item.querySelector("strong")?.textContent);
    const key = SALE_ROOM_SERVICE_KEYS[label] || "";
    const value = item.querySelector(".room-share-service-value")?.textContent?.trim() || "";
    return key && value ? { key, value } : null;
  }).filter(Boolean);
  const notes = [...card.querySelectorAll(".room-share-notes li")]
    .map((item) => item.querySelector(".room-share-note-value")?.textContent?.trim() || item.textContent.trim())
    .filter(Boolean);
  if (!furniture && !services.length && !notes.length) return null;
  return { furniture, services, notes };
}

function editableRoomText(className, value) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = value;
  span.contentEditable = "true";
  span.spellcheck = false;
  return span;
}

function applySaleRoomServices(card, services) {
  if (!Array.isArray(services)) return;
  const section = roomSummarySection(card, ["Services", "Dịch vụ"]);
  const list = section?.querySelector(".room-share-services");
  if (!list) return;
  list.replaceChildren();
  for (const service of services) {
    if (!service?.label || !service?.value) continue;
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = `${service.label}:`;
    item.append(label, document.createTextNode(" "), editableRoomText("room-share-service-value", service.value));
    list.append(item);
  }
  if (!list.children.length) section.remove();
}

function applySaleRoomNotes(card, notes) {
  if (!Array.isArray(notes)) return;
  const section = roomSummarySection(card, ["Notes", "Lưu ý"]);
  const list = section?.querySelector(".room-share-notes");
  if (!list) return;
  list.replaceChildren();
  for (const note of notes) {
    const value = String(note || "").trim();
    if (!value) continue;
    const item = document.createElement("li");
    item.append(editableRoomText("room-share-note-value", value));
    list.append(item);
  }
  if (!list.children.length) section.remove();
}

function applySaleRoomAiPolish(card, polish) {
  if (!polish || typeof polish !== "object") return;
  const furniture = roomSummaryFurniture(card);
  if (furniture.row && typeof polish.furniture === "string" && polish.furniture.trim()) {
    const value = furniture.row.querySelector(".room-share-detail-value");
    if (value) value.textContent = polish.furniture.trim();
  }
  applySaleRoomServices(card, polish.services);
  applySaleRoomNotes(card, polish.notes);
}

async function runSaleRoomAiPolish(sequence) {
  const input = document.querySelector("#room-summary-input");
  const card = document.querySelector("#room-summary-card");
  if (!input || !card || card.classList.contains("is-empty")) return;

  const rawSnapshot = input.value;
  const summary = collectSaleRoomPolishInput(card);
  if (!summary) return;
  setSaleRoomPreviewStatus("AI is polishing the text…");

  try {
    const response = await fetch(SALE_ROOM_SUMMARY_AI_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary }),
    });
    const payload = await response.json().catch(() => ({}));
    if (sequence !== saleRoomAiRequestSequence || input.value !== rawSnapshot) return;
    if (!response.ok || !payload.applied || !payload.polish) {
      setSaleRoomPreviewStatus("Ready to screenshot");
      return;
    }
    applySaleRoomAiPolish(card, payload.polish);
    setSaleRoomPreviewStatus("AI polish complete");
  } catch {
    if (sequence === saleRoomAiRequestSequence && input.value === rawSnapshot) {
      setSaleRoomPreviewStatus("Ready to screenshot");
    }
  }
}

document.addEventListener("click", (event) => {
  if (event.target.closest("#room-summary-clear")) {
    saleRoomAiRequestSequence += 1;
    return;
  }
  if (!event.target.closest("#room-summary-generate")) return;
  const sequence = ++saleRoomAiRequestSequence;
  window.setTimeout(() => runSaleRoomAiPolish(sequence), 0);
});

import("/sale-english-ui.js?v=joy-sale-english-ui-v1").catch(() => {});
