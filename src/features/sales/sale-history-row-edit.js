const HISTORY_CONTENT_SELECTOR = "#sales-history-content";
const DISPLAY_ROW_SELECTOR = ".sales-history-table tbody tr:not(.sales-history-edit-row)";
const EDIT_CONTROL_SELECTOR = '[data-action="edit-sale-viewing"]';

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

function decorateRows(content) {
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installHistoryRowEditing, { once: true });
} else {
  installHistoryRowEditing();
}
