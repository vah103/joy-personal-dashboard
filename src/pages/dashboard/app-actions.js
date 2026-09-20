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

import("/daily-day.js?v=joy-daily-day-v11").then(() => {
  document.querySelector("#joy-daily-day-columns-v1")?.remove();
  document.querySelector("#joy-daily-day-layout-v2")?.remove();

  const style = document.createElement("style");
  style.id = "joy-daily-day-layout-v2";
  style.textContent = `
    /* Template schedule: three stable reading zones, aligned from the top. */
    #daily-day-templates-modal .dd-detail > .dd-section {
      margin: 10px 0 10px !important;
      font-size: 15px !important;
    }

    #daily-day-templates-modal .dd-detail .dd-timeline {
      gap: 10px !important;
      padding-left: 16px !important;
      padding-right: 6px !important;
    }

    #daily-day-templates-modal .dd-detail .dd-timeline::before {
      left: 4px !important;
      top: 22px !important;
      bottom: 22px !important;
    }

    #daily-day-templates-modal .dd-detail .dd-timeline-row {
      min-height: 76px !important;
      height: auto !important;
      padding: 12px 14px !important;
      grid-template-columns: 68px 132px minmax(0, 1fr) !important;
      column-gap: 14px !important;
      align-items: start !important;
      border-radius: 12px !important;
      overflow: visible !important;
    }

    #daily-day-templates-modal .dd-detail .dd-timeline-row::before {
      left: -16px !important;
      top: 25px !important;
      transform: none !important;
    }

    #daily-day-templates-modal .dd-detail .dd-timeline-row > strong:first-child {
      min-width: 52px !important;
      margin-top: 0 !important;
      padding: 5px 8px !important;
      font-size: 12.5px !important;
      line-height: 1.25 !important;
    }

    #daily-day-templates-modal .dd-detail .dd-timeline-row > strong:nth-child(2) {
      padding-top: 5px !important;
      color: #2c4a5b !important;
      font-size: 13.5px !important;
      line-height: 1.35 !important;
      font-weight: 800 !important;
    }

    /* Short schedules stay as one clean left-aligned column. */
    #daily-day-templates-modal .dd-detail .dd-template-items {
      min-width: 0 !important;
      padding-top: 3px !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 7px !important;
      align-content: start !important;
      color: #5f737c !important;
      font-size: 12px !important;
      line-height: 1.4 !important;
    }

    #daily-day-templates-modal .dd-detail .dd-template-items > span {
      min-width: 0 !important;
      min-height: 20px !important;
      width: 100% !important;
      display: flex !important;
      align-items: center !important;
      white-space: normal !important;
      break-inside: avoid-column !important;
      -webkit-column-break-inside: avoid !important;
      margin: 0 !important;
    }

    #daily-day-templates-modal .dd-detail .dd-template-items > span::before {
      flex: 0 0 auto !important;
      margin: 0 6px 0 0 !important;
      font-size: 12px !important;
    }

    #daily-day-templates-modal .dd-detail .dd-workout-subheading {
      font-size: 13px !important;
    }

    #daily-day-templates-modal .dd-detail .dd-workout-tabs button {
      font-size: 11.5px !important;
    }

    /* Five or more items become two ordered vertical columns. The browser
       fills the left column first, then continues in the right column. */
    #daily-day-templates-modal .dd-detail .dd-template-items:has(> span:nth-of-type(5)) {
      display: block !important;
      column-count: 2 !important;
      column-fill: balance !important;
      column-gap: 28px !important;
      column-rule: 1px solid #d9e2e1 !important;
    }

    #daily-day-templates-modal .dd-detail .dd-template-items:has(> span:nth-of-type(5)) > span {
      margin: 0 0 7px !important;
    }

    #daily-day-templates-modal .dd-detail .dd-workout-wrap {
      column-span: all !important;
    }

    /* Apply the same reading rhythm to the main Daily Day view. */
    #daily-day-modal .dd-items:has(> .dd-check:nth-of-type(5)) {
      display: block !important;
      column-count: 2 !important;
      column-fill: balance !important;
      column-gap: 28px !important;
      column-rule: 1px solid #d9e2e1 !important;
    }

    #daily-day-modal .dd-items:has(> .dd-check:nth-of-type(5)) > .dd-check {
      width: 100% !important;
      box-sizing: border-box !important;
      margin: 0 0 7px !important;
      break-inside: avoid-column !important;
      -webkit-column-break-inside: avoid !important;
    }

    #daily-day-modal .dd-check {
      align-items: center !important;
      line-height: 1.35 !important;
    }

    @media (max-width: 980px) {
      #daily-day-templates-modal .dd-detail .dd-timeline-row {
        grid-template-columns: 62px 112px minmax(0, 1fr) !important;
        column-gap: 12px !important;
      }
    }

    @media (max-width: 760px) {
      #daily-day-templates-modal .dd-detail .dd-timeline-row {
        grid-template-columns: 58px minmax(0, 1fr) !important;
        min-height: 70px !important;
        padding: 12px !important;
      }

      #daily-day-templates-modal .dd-detail .dd-template-items {
        grid-column: 1 / -1 !important;
        padding: 4px 0 0 68px !important;
      }

      #daily-day-templates-modal .dd-detail .dd-template-items:has(> span:nth-of-type(5)),
      #daily-day-modal .dd-items:has(> .dd-check:nth-of-type(5)) {
        column-count: 1 !important;
        column-rule: 0 !important;
      }
    }
  `;
  document.head.append(style);
}).catch(() => {});
