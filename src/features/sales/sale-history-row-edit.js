const HISTORY_CONTENT_SELECTOR = "#sales-history-content";
const DISPLAY_ROW_SELECTOR = ".sales-history-table tbody tr:not(.sales-history-edit-row)";
const EDIT_CONTROL_SELECTOR = '[data-action="edit-sale-viewing"]';
const CANCEL_CONTROL_SELECTOR = '[data-action="cancel-sale-viewing-edit"]';
const COMMISSION_ENDPOINT = "/api/sales/viewings/commission";

let commissionStates = new Map();
let commissionSyncPromise = null;

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

function viewingIdForRow(row) {
  return String(
    row?.dataset.viewingId
    || row?.querySelector(EDIT_CONTROL_SELECTOR)?.dataset.viewingId
    || "",
  ).trim();
}

function commissionStateForRow(row) {
  return commissionStates.get(viewingIdForRow(row)) || "none";
}

function applyCommissionState(row) {
  const state = commissionStateForRow(row);
  row.dataset.commissionState = state;
  const button = row.querySelector(".sales-history-close-button");
  if (!button) return;
  button.dataset.commissionState = state;
  button.disabled = state === "received";
  button.title = state === "pending"
    ? "Đã chốt, chưa nhận hoa hồng. Bấm lần nữa khi đã nhận tiền."
    : state === "received"
      ? "Đã nhận hoa hồng."
      : "Chốt khách này.";
}

async function syncCommissionStates() {
  if (commissionSyncPromise) return commissionSyncPromise;
  commissionSyncPromise = (async () => {
    try {
      const response = await fetch(COMMISSION_ENDPOINT, { credentials: "same-origin" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "VIEWING_COMMISSION_LOAD_FAILED");
      commissionStates = new Map(
        (Array.isArray(payload.states) ? payload.states : [])
          .filter((item) => item?.viewingId && ["pending", "received"].includes(item.state))
          .map((item) => [String(item.viewingId), item.state]),
      );
      const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
      if (content) decorateRows(content);
    } catch {
      // Commission color is helpful metadata; history remains usable if it cannot load.
    } finally {
      commissionSyncPromise = null;
    }
  })();
  return commissionSyncPromise;
}

function combinedReminderLabel(status, reminder, followup) {
  if (status === "Đã huỷ") return "Đã huỷ";
  if (followup === "Đã gửi") return "Đã follow-up";
  if (status === "Đã qua" && followup === "Chờ gửi") return "Chờ follow-up";
  if (status === "Sắp tới" && reminder === "Đã gửi") return "Đã nhắc";
  if (status === "Sắp tới" && reminder === "Chờ gửi") return "Chờ nhắc";
  if (status === "Sắp tới" && reminder === "Không nhắc") return "Không nhắc trước";
  if (reminder === "Đã gửi") return "Đã nhắc";
  if (followup === "Chờ gửi") return "Chờ follow-up";
  return "—";
}

function mergeReminderColumns(content) {
  const table = content.querySelector(".sales-history-table");
  if (!table) return;

  const headers = [...table.querySelectorAll("thead th")];
  if (headers.length >= 8) {
    headers[5].textContent = "Nhắc";
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
        ? "Chạm để sửa lịch hẹn này"
        : "Nhấp đúp hoặc nhấn Enter để sửa lịch hẹn này",
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

  const customer = row.querySelector('[data-history-field="customerName"]')?.value.trim() || "lịch hẹn này";
  if (!window.confirm(`Xóa lịch hẹn của ${customer}?`)) return;

  row.querySelectorAll("button").forEach((control) => { control.disabled = true; });
  setDeleteMessage(row, "Đang xóa…");

  try {
    const response = await fetch("/api/sales/viewings/delete", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "VIEWING_DELETE_FAILED");
    commissionStates.delete(id);
    refreshHistory();
  } catch {
    row.querySelectorAll("button").forEach((control) => { control.disabled = false; });
    button.disabled = false;
    setDeleteMessage(row, "Chưa xóa được. Hãy thử lại.");
  }
}

async function advanceCommissionState(row, button) {
  const id = viewingIdForRow(row);
  if (!id || commissionStateForRow(row) === "received") return;

  button.disabled = true;
  setDeleteMessage(row, "Đang cập nhật trạng thái chốt…");

  try {
    const response = await fetch(COMMISSION_ENDPOINT, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "VIEWING_COMMISSION_UPDATE_FAILED");

    const state = ["pending", "received"].includes(payload.state) ? payload.state : "none";
    if (state === "none") throw new Error("VIEWING_COMMISSION_STATE_INVALID");
    commissionStates.set(id, state);
    applyCommissionState(row);
    setDeleteMessage(
      row,
      state === "pending"
        ? "Đã chốt · chưa nhận hoa hồng."
        : "Đã nhận hoa hồng.",
    );
  } catch {
    button.disabled = false;
    setDeleteMessage(row, "Chưa cập nhật được trạng thái chốt. Hãy thử lại.");
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
  remove.textContent = "Xóa";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteViewing(row, remove);
  });

  const close = document.createElement("button");
  close.type = "button";
  close.className = "sales-history-close-button";
  close.textContent = "Chốt";
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    advanceCommissionState(row, close);
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
    ? "Chạm vào một dòng để chỉnh sửa"
    : "Nhấp đúp vào một dòng để chỉnh sửa";
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
        syncCommissionStates();
      }, 0);
    }

    const assistantLauncher = event.target.closest?.('[data-action="open-sales-assistant"]');
    if (assistantLauncher) {
      window.setTimeout(() => {
        const historyPanel = document.querySelector('[data-assistant-panel="history"]');
        if (historyPanel && !historyPanel.hidden) {
          refreshHistory();
          syncCommissionStates();
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
