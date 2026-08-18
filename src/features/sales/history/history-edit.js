import {
  applyCommissionState,
  forgetCommissionState,
  handleCloseDeal,
  syncCommissionStates,
} from "./close-deal.js";

const HISTORY_CONTENT_SELECTOR = "#sales-history-content";
const DISPLAY_ROW_SELECTOR = ".sales-history-table tbody tr:not(.sales-history-edit-row)";
const EDIT_CONTROL_SELECTOR = '[data-action="edit-sale-viewing"]';
const CANCEL_CONTROL_SELECTOR = '[data-action="cancel-sale-viewing-edit"]';

function isCoarsePointer() {
  return window.matchMedia?.("(pointer: coarse)")?.matches === true;
}

function editableDisplayRow(target) {
  const row = target?.closest?.(DISPLAY_ROW_SELECTOR);
  if (!row?.closest(HISTORY_CONTENT_SELECTOR)) return null;
  return row.querySelector(EDIT_CONTROL_SELECTOR) ? row : null;
}

function startRowEdit(row) {
  row?.querySelector(EDIT_CONTROL_SELECTOR)?.click();
}

function refreshHistory() {
  document.querySelector("#sales-history-refresh")?.click();
}

function matchesLabel(value, ...labels) {
  return labels.includes(String(value || "").trim());
}

function combinedReminderLabel(status, reminder, followup) {
  if (matchesLabel(status, "Đã huỷ", "Cancelled")) return "Cancelled";
  if (matchesLabel(followup, "Đã gửi", "Sent")) return "Follow-up sent";
  if (matchesLabel(status, "Đã qua", "Past") && matchesLabel(followup, "Chờ gửi", "Pending")) return "Follow-up pending";
  if (matchesLabel(status, "Sắp tới", "Upcoming") && matchesLabel(reminder, "Đã gửi", "Sent")) return "Reminder sent";
  if (matchesLabel(status, "Sắp tới", "Upcoming") && matchesLabel(reminder, "Chờ gửi", "Pending")) return "Reminder pending";
  if (matchesLabel(status, "Sắp tới", "Upcoming") && matchesLabel(reminder, "Không nhắc", "No reminder")) return "No advance reminder";
  if (matchesLabel(reminder, "Đã gửi", "Sent")) return "Reminder sent";
  if (matchesLabel(followup, "Chờ gửi", "Pending")) return "Follow-up pending";
  return "—";
}

function mergeReminderColumns(content) {
  const table = content.querySelector(".sales-history-table");
  if (!table) return;

  const headers = [...table.querySelectorAll("thead th")];
  if (headers.length >= 8) {
    headers[5].textContent = "Reminder";
    headers[6].remove();
  }

  table.querySelectorAll("tbody tr").forEach((row) => {
    if (row.dataset.reminderMerged === "true") return;
    const cells = [...row.children];
    if (cells.length < 8) return;

    const status = cells[4].textContent.trim();
    const reminder = cells[5].textContent.trim();
    const followup = cells[6].textContent.trim();
    cells[5].textContent = combinedReminderLabel(status, reminder, followup);
    cells[6].remove();
    row.dataset.reminderMerged = "true";
  });
}

function decorateDisplayRows(content) {
  content.querySelectorAll(DISPLAY_ROW_SELECTOR).forEach((row) => {
    if (!row.querySelector(EDIT_CONTROL_SELECTOR)) return;
    applyCommissionState(row);
    row.dataset.historyEditable = "true";
    row.tabIndex = 0;
    row.setAttribute(
      "aria-label",
      isCoarsePointer()
        ? "Tap to edit this appointment"
        : "Double-click or press Enter to edit this appointment",
    );
  });
}

function editRow(content) {
  return content.querySelector(".sales-history-edit-row");
}

function cancelEditing(content) {
  editRow(content)?.querySelector(CANCEL_CONTROL_SELECTOR)?.click();
}

function setDeleteMessage(row, text) {
  const message = row.querySelector(".sales-history-edit-message");
  if (!message) return;
  message.textContent = text;
  message.hidden = !text;
}

async function deleteViewing(row, button) {
  const id = row.dataset.viewingId || "";
  if (!id) return;

  const customer = row.querySelector('[data-history-field="customerName"]')?.value.trim() || "this appointment";
  if (!window.confirm(`Delete the appointment for ${customer}?`)) return;

  row.querySelectorAll("button").forEach((control) => { control.disabled = true; });
  setDeleteMessage(row, "Deleting…");

  try {
    const response = await fetch("/api/sales/viewings/delete", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "VIEWING_DELETE_FAILED");
    forgetCommissionState(id);
    refreshHistory();
  } catch {
    row.querySelectorAll("button").forEach((control) => { control.disabled = false; });
    button.disabled = false;
    setDeleteMessage(row, "Could not delete the appointment. Please try again.");
  }
}

function decorateEditRow(content) {
  const row = editRow(content);
  if (!row) return;
  applyCommissionState(row);
  if (row.dataset.deleteReady === "true") return;
  row.dataset.deleteReady = "true";

  const controls = row.querySelector(".sales-history-edit-controls");
  const save = row.querySelector('[data-action="save-sale-viewing"]');
  const cancel = row.querySelector(CANCEL_CONTROL_SELECTOR);
  if (!controls || !save || !cancel) return;

  cancel.hidden = true;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "sales-history-delete-button";
  remove.textContent = "Delete";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteViewing(row, remove);
  });

  const close = document.createElement("button");
  close.type = "button";
  close.className = "sales-history-close-button";
  close.textContent = "Close deal";
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    handleCloseDeal(row, close, setDeleteMessage);
  });

  controls.insertBefore(remove, save);
  controls.insertBefore(close, save);
  applyCommissionState(row);
}

function decorateRows(content) {
  mergeReminderColumns(content);
  decorateDisplayRows(content);
  decorateEditRow(content);
}

function ensureEditHint() {
  const headingCopy = document.querySelector(".sales-history-heading > div");
  if (!headingCopy || headingCopy.querySelector(".sales-history-edit-hint")) return;
  const hint = document.createElement("span");
  hint.className = "sales-history-edit-hint";
  hint.textContent = isCoarsePointer()
    ? "Tap a row to edit it"
    : "Double-click a row to edit it";
  headingCopy.append(hint);
}

function installHistoryRowEditing() {
  const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
  if (!content || content.dataset.rowEditReady === "true") return;
  content.dataset.rowEditReady = "true";
  ensureEditHint();
  decorateRows(content);

  const observer = new MutationObserver(() => decorateRows(content));
  observer.observe(content, { childList: true, subtree: true });

  content.addEventListener("dblclick", (event) => {
    if (isCoarsePointer()) return;
    const row = editableDisplayRow(event.target);
    if (!row) return;
    event.preventDefault();
    startRowEdit(row);
  });

  content.addEventListener("click", (event) => {
    if (!isCoarsePointer()) return;
    if (event.target.closest("button, input, a, select, textarea")) return;
    const row = editableDisplayRow(event.target);
    if (!row) return;
    startRowEdit(row);
  });

  content.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const row = editableDisplayRow(event.target);
    if (!row || event.target !== row) return;
    event.preventDefault();
    startRowEdit(row);
  });

  document.addEventListener("click", (event) => {
    const historyTab = event.target.closest?.('[data-assistant-mode="history"]');
    if (historyTab) {
      window.setTimeout(() => {
        refreshHistory();
        syncCommissionStates(decorateRows);
      }, 0);
    }

    const assistantLauncher = event.target.closest?.('[data-action="open-sales-assistant"]');
    if (assistantLauncher) {
      window.setTimeout(() => {
        const historyPanel = document.querySelector('[data-assistant-panel="history"]');
        if (historyPanel && !historyPanel.hidden) {
          refreshHistory();
          syncCommissionStates(decorateRows);
        }
      }, 0);
    }

    // startRowEdit() triggers the hidden Edit button programmatically. That click
    // bubbles after Sales Assistant has already replaced the display row with the
    // edit row, so treating it as an outside click would immediately cancel edit.
    if (event.target.closest?.(EDIT_CONTROL_SELECTOR)) return;
    const row = editRow(content);
    if (!row || row.contains(event.target)) return;
    cancelEditing(content);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installHistoryRowEditing, { once: true });
} else {
  installHistoryRowEditing();
}
