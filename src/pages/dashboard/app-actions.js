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
        body: JSON.stringify({ id }),
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

import("/daily-day.js?v=joy-daily-day-v17").catch(() => {});

(function installDailyDayWorkoutEditor() {
  const STORAGE_KEY = "joy-daily-day-workout-values-v1";
  const read = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
  const write = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const dateKey = () => document.querySelector("#daily-day-modal .dd-week button.active")?.dataset.ddDate || "";
  const parseExercise = (text) => {
    const original = String(text || "").trim();
    let core = original; let reps = ""; let weight = ""; let sets = "";
    const repsMatch = core.match(/\s*\(([^)]+)\)\s*$/); if (repsMatch) { reps = repsMatch[1].trim(); core = core.slice(0, repsMatch.index).trim(); }
    const setsMatch = core.match(/^(.*?)(?:\s+([0-9]+(?:\.[0-9]+)?|…))?\s*x(\d+)\s*$/i);
    if (setsMatch) { core = setsMatch[1].trim(); weight = (setsMatch[2] || "").trim(); sets = setsMatch[3]; }
    else { const weightOnly = core.match(/^(.*\D)\s+([0-9]+(?:\.[0-9]+)?)\s*$/); if (weightOnly) { core = weightOnly[1].trim(); weight = weightOnly[2]; } }
    return { original, name: core, weight, sets, reps };
  };
  const formatExercise = (meta, values) => {
    const weight = Object.hasOwn(values, "weight") ? String(values.weight).trim() : meta.weight;
    const reps = Object.hasOwn(values, "reps") ? String(values.reps).trim() : meta.reps;
    let output = meta.name;
    if (meta.sets) output += weight ? ` ${weight}x${meta.sets}` : ` x${meta.sets}`;
    else if (weight) output += ` ${weight}`;
    if (reps) output += ` (${reps})`;
    return output;
  };
  const storeValues = (itemId, values) => { const day = dateKey(); if (!day) return; const data = read(); data[day] ||= {}; data[day][itemId] = values; write(data); };
  const clearValues = (itemId) => { const day = dateKey(); const data = read(); if (!data[day]) return; delete data[day][itemId]; if (!Object.keys(data[day]).length) delete data[day]; write(data); };
  const injectStyles = () => {
    if (document.querySelector("#joy-daily-day-workout-editor-style")) return;
    const style = document.createElement("style"); style.id = "joy-daily-day-workout-editor-style";
    style.textContent = "#daily-day-modal .dd-exercise-line{position:relative;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 26px;gap:6px;align-items:center;padding:5px 7px;border:1px solid #e2e7e3;border-radius:10px;background:#fff}#daily-day-modal .dd-exercise-line.editing{grid-column:1/-1}#daily-day-modal .dd-exercise-line .dd-check{min-width:0}#daily-day-modal .dd-exercise-line .dd-check span{white-space:normal}#daily-day-modal .dd-exercise-edit{width:26px;height:26px;padding:0;border:0;border-radius:8px;background:#edf3f1;color:#56787f;font:700 12px Nunito,system-ui;cursor:pointer}#daily-day-modal .dd-exercise-editor{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr auto auto;gap:7px;align-items:end;padding-top:7px;border-top:1px solid #e1e7e4}#daily-day-modal .dd-exercise-editor[hidden]{display:none}#daily-day-modal .dd-exercise-field{display:grid;gap:3px;color:#688087;font:700 9px Nunito,system-ui}#daily-day-modal .dd-exercise-field input{min-width:0;height:29px;padding:0 8px;border:1px solid #d5dfdc;border-radius:8px;background:#fff;color:#314e59;font:700 11px Nunito,system-ui;outline:none}#daily-day-modal .dd-exercise-field input:focus{border-color:#6e9999;box-shadow:0 0 0 2px rgba(110,153,153,.14)}#daily-day-modal .dd-exercise-save,#daily-day-modal .dd-exercise-reset{height:29px;padding:0 9px;border:1px solid #d5dfdc;border-radius:8px;font:800 10px Nunito,system-ui;cursor:pointer}#daily-day-modal .dd-exercise-save{border-color:#648d8d;background:#648d8d;color:#fff}#daily-day-modal .dd-exercise-reset{background:#f6f8f6;color:#64777e}@media(max-width:760px){#daily-day-modal .dd-exercise-editor{grid-template-columns:1fr 1fr}#daily-day-modal .dd-exercise-save,#daily-day-modal .dd-exercise-reset{width:100%}}";
    document.head.append(style);
  };
  const enhance = () => {
    injectStyles(); const day = dateKey(); const data = read()[day] || {};
    document.querySelectorAll("#daily-day-modal .dd-workout-items > .dd-check:not([data-dd-exercise-enhanced])").forEach((label) => {
      const checkbox = label.querySelector("input[data-dd-check]"); const text = label.querySelector("span"); if (!checkbox || !text) return;
      const itemId = checkbox.dataset.ddCheck; const meta = parseExercise(text.textContent); const saved = data[itemId] || {}; text.textContent = formatExercise(meta, saved); label.dataset.ddExerciseEnhanced = "true";
      const line = document.createElement("div"); line.className = "dd-exercise-line"; label.before(line); line.append(label);
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "dd-exercise-edit"; edit.textContent = "✎"; edit.title = "Sửa mức tạ / rep"; line.append(edit);
      const editor = document.createElement("div"); editor.className = "dd-exercise-editor"; editor.hidden = true; editor.innerHTML = `<label class="dd-exercise-field">Tạ<input data-dd-exercise-weight inputmode="decimal" value="${String(Object.hasOwn(saved, "weight") ? saved.weight : meta.weight).replace(/"/g, "&quot;")}"></label><label class="dd-exercise-field">Rep<input data-dd-exercise-reps inputmode="numeric" value="${String(Object.hasOwn(saved, "reps") ? saved.reps : meta.reps).replace(/"/g, "&quot;")}"></label><button type="button" class="dd-exercise-save">Lưu</button><button type="button" class="dd-exercise-reset">Mặc định</button>`; line.append(editor);
      edit.addEventListener("click", () => { editor.hidden = !editor.hidden; line.classList.toggle("editing", !editor.hidden); if (!editor.hidden) editor.querySelector("input")?.focus(); });
      editor.querySelector(".dd-exercise-save").addEventListener("click", () => { const values = { weight: editor.querySelector("[data-dd-exercise-weight]").value.trim(), reps: editor.querySelector("[data-dd-exercise-reps]").value.trim() }; storeValues(itemId, values); text.textContent = formatExercise(meta, values); editor.hidden = true; line.classList.remove("editing"); showToast("Đã lưu mức tạ và rep cho ngày này"); });
      editor.querySelector(".dd-exercise-reset").addEventListener("click", () => { clearValues(itemId); text.textContent = meta.original; editor.querySelector("[data-dd-exercise-weight]").value = meta.weight; editor.querySelector("[data-dd-exercise-reps]").value = meta.reps; editor.hidden = true; line.classList.remove("editing"); showToast("Đã khôi phục mức tạ và rep mặc định"); });
    });
  };
  const observer = new MutationObserver(() => window.requestAnimationFrame(enhance)); observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("click", (event) => { if (event.target.closest?.("#todo-title,[data-dd-date],[data-dd-workout],[data-dd-today]")) setTimeout(enhance, 0); });
})();
