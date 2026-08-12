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

function decorateDisplayRows(content) {
  content.querySelectorAll(DISPLAY_ROW_SELECTOR).forEach((row) => {
    if (!row.querySelector(EDIT_CONTROL_SELECTOR)) return;
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
    document.querySelector("#sales-history-refresh")?.click();
  } catch {
    row.querySelectorAll("button").forEach((control) => { control.disabled = false; });
    button.disabled = false;
    setDeleteMessage(row, "Chưa xóa được. Hãy thử lại.");
  }
}

function decorateEditRow(content) {
  const row = editRow(content);
  if (!row || row.dataset.deleteReady === "true") return;
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
  controls.insertBefore(remove, save);
}

function decorateRows(content) {
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
