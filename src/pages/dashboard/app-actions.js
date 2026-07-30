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
