import { formatVietnamViewingTime } from "./appointment.js";
import { createCloseDealController, dealSavingNeedsReview } from "./close-deal.js";
import { appointmentErrorMessage } from "./errors.js";
import { saleApi } from "../shared/api.js";
import { vietnamDatetimeLocal, vietnamLocalToIso } from "../shared/format.js";
import { saleText, translateSaleUiRoot } from "../shared/i18n.js";

const HISTORY_CONTENT_SELECTOR = "#sales-history-content";
const DISPLAY_ROW_SELECTOR = ".sales-history-table tbody tr:not(.sales-history-edit-row)";
const VIEWINGS_ENDPOINT = "/api/sales/viewings";
const VIEWING_DELETE_ENDPOINT = "/api/sales/viewings/delete";

const state = {
  history: { items: [], loaded: false, installed: false, loadSeq: 0 },
  edit: { viewingId: "", dirty: false, saving: false, operationSeq: 0 },
};
let closeDealController = null;

function isCoarsePointer() {
  return window.matchMedia?.("(pointer: coarse)")?.matches === true;
}

function emitSalesChanged(kind) {
  window.dispatchEvent(new CustomEvent("joy:sales-changed", { detail: { kind } }));
}

function viewingById(id) {
  return state.history.items.find((viewing) => String(viewing.id) === String(id)) || null;
}

function historyStatusLabel(viewing) {
  if (viewing.dealSaved) return saleText("saleAssistant.closed", "Closed");
  if (viewing.dealSaving) {
    return dealSavingNeedsReview(viewing)
      ? saleText("saleAssistant.reviewDealSave", "Review deal save")
      : saleText("saleAssistant.savingDealState", "Saving deal");
  }
  if (viewing.status === "upcoming") return saleText("saleAssistant.upcoming", "Sắp tới");
  if (viewing.status === "cancelled") return saleText("saleAssistant.cancelled", "Đã huỷ");
  return saleText("saleAssistant.past", "Đã qua");
}

function reminderLabel(viewing) {
  if (viewing.dealSaved || viewing.dealSaving) return "—";
  if (viewing.status === "cancelled") return saleText("saleAssistant.reminderCancelled", "Cancelled");
  if (viewing.followupNotifiedAt) return saleText("saleAssistant.followupSent", "Follow-up sent");
  if (viewing.status === "past" && viewing.followupAt) return saleText("saleAssistant.followupPending", "Follow-up pending");
  if (viewing.status === "upcoming" && viewing.reminderNotifiedAt) return saleText("saleAssistant.reminderSent", "Reminder sent");
  if (viewing.status === "upcoming" && viewing.reminderAt) return saleText("saleAssistant.reminderPending", "Reminder pending");
  if (viewing.status === "upcoming" && !viewing.reminderAt) return saleText("saleAssistant.noAdvanceReminder", "No advance reminder");
  if (viewing.reminderNotifiedAt) return saleText("saleAssistant.reminderSent", "Reminder sent");
  if (viewing.followupAt) return saleText("saleAssistant.followupPending", "Follow-up pending");
  return "—";
}

function makeHistoryInput(field, value, { type = "text", maxLength = 0, required = false } = {}) {
  const input = document.createElement("input");
  input.className = "sales-history-edit-input";
  input.dataset.historyField = field;
  input.type = type;
  input.value = value || "";
  if (maxLength) input.maxLength = maxLength;
  if (required) input.required = true;
  if (type === "tel") input.inputMode = "tel";
  return input;
}

function appendHistoryCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function makeActionButton(label, action, viewing, className, { disabled = false, title = "" } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.historyAction = action;
  button.dataset.viewingId = viewing.id;
  button.textContent = label;
  button.disabled = disabled;
  if (title) button.title = title;
  return button;
}

function renderHistoryDisplayRow(viewing) {
  const savingReview = dealSavingNeedsReview(viewing);
  const editable = !viewing.dealSaved && !viewing.dealSaving;
  const row = document.createElement("tr");
  row.dataset.status = viewing.status;
  row.dataset.viewingId = viewing.id;
  row.dataset.dealSaved = viewing.dealSaved ? "true" : "false";
  row.dataset.dealSaving = viewing.dealSaving ? "true" : "false";
  row.dataset.dealReview = savingReview ? "true" : "false";
  row.dataset.historyEditable = editable ? "true" : "false";
  row.tabIndex = editable ? 0 : -1;
  row.setAttribute(
    "aria-label",
    editable
      ? isCoarsePointer()
        ? saleText("saleAssistant.tapEditAria", "Tap to edit this appointment")
        : saleText("saleAssistant.keyboardEditAria", "Double-click or press Enter to edit this appointment")
      : viewing.dealSaved
        ? saleText("saleAssistant.closedDealAria", "Closed deal")
        : savingReview
          ? saleText("saleAssistant.dealSaveReviewAria", "Deal save needs review")
          : saleText("saleAssistant.dealSaveProgressAria", "Deal save in progress"),
  );

  [
    formatVietnamViewingTime(viewing.viewingAt),
    viewing.customerName || "—",
    viewing.phone || "—",
    viewing.viewingAddress || "—",
    historyStatusLabel(viewing),
    reminderLabel(viewing),
  ].forEach((value) => appendHistoryCell(row, value));

  const actionCell = document.createElement("td");
  actionCell.className = "sales-history-actions-cell";
  if (editable) {
    actionCell.append(makeActionButton(saleText("saleAssistant.edit", "Edit"), "edit", viewing, "sales-history-edit-button"));
  }
  const closeLabel = viewing.dealSaved
    ? saleText("saleAssistant.dealSaved", "Deal saved")
    : viewing.dealSaving
      ? savingReview
        ? saleText("saleAssistant.reviewSave", "Review save")
        : saleText("saleAssistant.savingDeal", "Saving…")
      : saleText("saleAssistant.closeDealTitle", "Close deal");
  actionCell.append(makeActionButton(
    closeLabel,
    savingReview ? "review-deal" : "close-deal",
    viewing,
    "sales-history-close-button",
    {
      disabled: Boolean(viewing.dealSaved || (viewing.dealSaving && !savingReview)),
      title: viewing.dealSaved
        ? saleText("saleAssistant.dealSavedHelp", "Deal saved to Sale Manager.")
        : viewing.dealSaving
          ? savingReview
            ? saleText("saleAssistant.reviewResolveHelp", "Check Sale Manager and resolve this save.")
            : saleText("saleAssistant.dealSaveProgressHelp", "Deal save is in progress.")
          : saleText("saleAssistant.closeDealHelp", "Close this deal."),
    },
  ));
  row.append(actionCell);
  return row;
}

function renderHistoryEditRow(viewing) {
  const row = document.createElement("tr");
  row.className = "sales-history-edit-row";
  row.dataset.status = viewing.status;
  row.dataset.viewingId = viewing.id;
  row.dataset.dealSaved = "false";
  row.dataset.dealSaving = "false";

  const timeCell = document.createElement("td");
  timeCell.append(makeHistoryInput("viewingTime", vietnamDatetimeLocal(viewing.viewingAt), { type: "datetime-local", required: true }));
  row.append(timeCell);
  const customerCell = document.createElement("td");
  customerCell.append(makeHistoryInput("customerName", viewing.customerName, { maxLength: 100, required: true }));
  row.append(customerCell);
  const phoneCell = document.createElement("td");
  phoneCell.append(makeHistoryInput("phone", viewing.phone, { type: "tel", maxLength: 20 }));
  row.append(phoneCell);
  const addressCell = document.createElement("td");
  addressCell.append(makeHistoryInput("viewingAddress", viewing.viewingAddress, { maxLength: 220, required: true }));
  row.append(addressCell);
  appendHistoryCell(row, historyStatusLabel(viewing));
  appendHistoryCell(row, reminderLabel(viewing));

  const actionCell = document.createElement("td");
  actionCell.className = "sales-history-actions-cell";
  const controls = document.createElement("div");
  controls.className = "sales-history-edit-controls";
  controls.append(
    makeActionButton(saleText("saleAssistant.delete", "Delete"), "delete", viewing, "sales-history-delete-button"),
    makeActionButton(saleText("saleAssistant.save", "Save"), "save", viewing, "sales-history-save-button"),
  );
  const message = document.createElement("small");
  message.className = "sales-history-edit-message";
  message.hidden = true;
  controls.append(message);
  actionCell.append(controls);
  row.append(actionCell);
  return row;
}

function renderViewingHistory() {
  const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
  const count = document.querySelector("#sales-history-count");
  const hint = document.querySelector("#sales-history-edit-hint");
  if (!content || !count) return;

  const editingViewing = state.edit.viewingId ? viewingById(state.edit.viewingId) : null;
  if (state.edit.viewingId && (!editingViewing || editingViewing.dealSaved || editingViewing.dealSaving)) {
    state.edit.viewingId = "";
    state.edit.dirty = false;
  }
  count.textContent = saleText("saleAssistant.historyCount", `${state.history.items.length} lịch hẹn`, { count: state.history.items.length });
  if (hint) {
    hint.textContent = isCoarsePointer()
      ? saleText("saleAssistant.tapEditHint", "Tap a row to edit it")
      : saleText("saleAssistant.keyboardEditHint", "Double-click a row to edit it");
  }

  if (!state.history.items.length) {
    const empty = document.createElement("p");
    empty.className = "sales-history-empty";
    empty.textContent = saleText("saleAssistant.historyEmpty", "Chưa có lịch hẹn nào trong Joy.");
    content.replaceChildren(empty);
    translateSaleUiRoot(content);
    return;
  }

  const table = document.createElement("table");
  table.className = "sales-history-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  [
    saleText("saleAssistant.time", "Thời gian"),
    saleText("saleAssistant.customer", "Khách"),
    saleText("saleAssistant.phoneShort", "SĐT"),
    saleText("saleAssistant.address", "Địa chỉ"),
    saleText("saleAssistant.status", "Trạng thái"),
    saleText("saleAssistant.reminder", "Reminder"),
    "",
  ].forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.append(th);
  });
  head.append(headRow);

  const body = document.createElement("tbody");
  state.history.items.forEach((viewing) => {
    body.append(
      String(viewing.id) === String(state.edit.viewingId) && !viewing.dealSaved && !viewing.dealSaving
        ? renderHistoryEditRow(viewing)
        : renderHistoryDisplayRow(viewing),
    );
  });
  table.append(head, body);
  content.replaceChildren(table);
  translateSaleUiRoot(content);
}

async function loadViewingHistory({ force = false } = {}) {
  if (state.history.loaded && !force) {
    renderViewingHistory();
    return true;
  }
  const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
  const count = document.querySelector("#sales-history-count");
  if (!content || !count) return false;
  const requestSeq = ++state.history.loadSeq;
  content.textContent = saleText("saleAssistant.historyLoading", "Đang tải lịch sử…");
  count.textContent = saleText("saleAssistant.loading", "Đang tải…");
  try {
    const payload = await saleApi(VIEWINGS_ENDPOINT);
    if (requestSeq !== state.history.loadSeq) return false;
    state.history.items = Array.isArray(payload.history) ? payload.history : [];
    state.history.loaded = true;
    renderViewingHistory();
    return true;
  } catch {
    if (requestSeq !== state.history.loadSeq) return false;
    state.history.loaded = false;
    content.textContent = saleText("saleAssistant.historyLoadFailed", "Joy chưa tải được lịch sử. Hãy thử lại.");
    count.textContent = saleText("saleAssistant.loadFailed", "Không tải được");
    return false;
  }
}

function confirmDiscardEditing() {
  return !state.edit.dirty
    || window.confirm(saleText("saleAssistant.discardAppointmentChanges", "Discard unsaved appointment changes?"));
}

function cancelEditing({ force = false } = {}) {
  if (!state.edit.viewingId) return true;
  if (state.edit.saving && !force) return false;
  if (!force && !confirmDiscardEditing()) return false;
  state.edit.viewingId = "";
  state.edit.dirty = false;
  renderViewingHistory();
  return true;
}

function startEditing(id) {
  if (state.edit.saving) return;
  const viewing = viewingById(id);
  if (!viewing || viewing.dealSaved || viewing.dealSaving) return;
  if (state.edit.viewingId && String(state.edit.viewingId) !== String(id) && !cancelEditing()) return;
  state.edit.viewingId = String(id);
  state.edit.dirty = false;
  renderViewingHistory();
}

function setEditMessage(row, text) {
  const message = row?.querySelector(".sales-history-edit-message");
  if (!message) return;
  message.textContent = text;
  message.hidden = !text;
  translateSaleUiRoot(row);
}

function setHistoryEditBusy(row, busy) {
  if (!row) return;
  row.dataset.historyBusy = busy ? "true" : "false";
  row.querySelectorAll("input, button").forEach((control) => { control.disabled = busy; });
}

async function recoverViewingState(code) {
  if (!["VIEWING_ALREADY_CLOSED", "SALE_DEAL_SAVE_IN_PROGRESS", "SALE_DEAL_SAVE_REVIEW_REQUIRED"].includes(code)) {
    return false;
  }
  state.edit.viewingId = "";
  state.edit.dirty = false;
  state.history.loaded = false;
  await loadViewingHistory({ force: true });
  return true;
}

async function saveViewingHistoryEdit(row) {
  if (state.edit.saving) return;
  const id = String(row?.dataset.viewingId || "");
  const viewing = viewingById(id);
  if (!id || !viewing || viewing.dealSaved || viewing.dealSaving) return;
  const field = (name) => row.querySelector(`[data-history-field="${name}"]`);
  const customerName = field("customerName")?.value.trim() || "";
  const phone = field("phone")?.value.trim() || "";
  const viewingAddress = field("viewingAddress")?.value.trim() || "";
  const viewingAt = vietnamLocalToIso(field("viewingTime")?.value || "");
  if (!customerName || !viewingAddress || !viewingAt) {
    setEditMessage(row, saleText("saleAssistant.completeRequiredFields", "Điền đủ tên, địa chỉ và thời gian."));
    return;
  }

  const operationId = ++state.edit.operationSeq;
  state.edit.saving = true;
  setHistoryEditBusy(row, true);
  setEditMessage(row, saleText("saleAssistant.historySaving", "Đang lưu…"));
  try {
    await saleApi(VIEWINGS_ENDPOINT, {
      method: "PATCH",
      body: { id, customerName, phone, viewingAddress, viewingAt },
    });
    if (operationId !== state.edit.operationSeq) return;
    state.edit.viewingId = "";
    state.edit.dirty = false;
    state.history.loaded = false;
    await loadViewingHistory({ force: true });
    emitSalesChanged("viewing-updated");
  } catch (error) {
    if (operationId !== state.edit.operationSeq) return;
    if (await recoverViewingState(error.code)) return;
    setEditMessage(
      row,
      appointmentErrorMessage(error.code, "saleAssistant.editFailed", "Không thể cập nhật lịch hẹn. Hãy thử lại."),
    );
  } finally {
    if (operationId === state.edit.operationSeq) {
      state.edit.saving = false;
      if (String(state.edit.viewingId) === id && row?.isConnected) setHistoryEditBusy(row, false);
    }
  }
}

async function deleteViewing(row) {
  if (state.edit.saving) return;
  const id = String(row?.dataset.viewingId || "");
  const viewing = viewingById(id);
  if (!id || !viewing || viewing.dealSaved || viewing.dealSaving) return;
  const customer = row.querySelector('[data-history-field="customerName"]')?.value.trim()
    || viewing.customerName
    || saleText("saleAssistant.thisAppointment", "this appointment");
  if (!window.confirm(
    saleText("saleAssistant.confirmDeleteAppointment", `Delete the appointment for ${customer}?`, { customer }),
  )) return;

  const operationId = ++state.edit.operationSeq;
  state.edit.saving = true;
  setHistoryEditBusy(row, true);
  setEditMessage(row, saleText("saleAssistant.deleting", "Deleting…"));
  try {
    await saleApi(VIEWING_DELETE_ENDPOINT, { method: "DELETE", body: { id } });
    if (operationId !== state.edit.operationSeq) return;
    state.history.items = state.history.items.filter((item) => String(item.id) !== id);
    state.edit.viewingId = "";
    state.edit.dirty = false;
    renderViewingHistory();
    emitSalesChanged("viewing-deleted");
  } catch (error) {
    if (operationId !== state.edit.operationSeq) return;
    if (await recoverViewingState(error.code)) return;
    setEditMessage(
      row,
      appointmentErrorMessage(error.code, "saleAssistant.deleteFailed", "Không thể xóa lịch hẹn. Hãy thử lại."),
    );
  } finally {
    if (operationId === state.edit.operationSeq) {
      state.edit.saving = false;
      if (String(state.edit.viewingId) === id && row?.isConnected) setHistoryEditBusy(row, false);
    }
  }
}

function prepareCloseDealOpen(id) {
  if (state.edit.saving) return false;
  if (state.edit.viewingId && String(state.edit.viewingId) !== String(id) && !cancelEditing()) return false;
  return String(state.edit.viewingId) !== String(id);
}

function markReviewRequired(id) {
  const viewing = viewingById(id);
  if (!viewing) return;
  viewing.dealSaving = true;
  viewing.dealSavingSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  renderViewingHistory();
}

function applyReviewResolution(id, resolution) {
  const viewing = viewingById(id);
  if (!viewing) return;
  viewing.dealSaving = false;
  viewing.dealSavingSince = "";
  if (resolution === "saved") viewing.dealSaved = true;
  renderViewingHistory();
}

function getCloseDealController() {
  if (closeDealController) return closeDealController;
  closeDealController = createCloseDealController({
    getViewing: viewingById,
    prepareOpen: prepareCloseDealOpen,
    refreshHistory: async () => {
      state.history.loaded = false;
      return loadViewingHistory({ force: true });
    },
    recoverViewingState,
    markReviewRequired,
    applyReviewResolution,
    emitSalesChanged,
  });
  return closeDealController;
}

function displayRowFromTarget(target) {
  const row = target?.closest?.(DISPLAY_ROW_SELECTOR);
  if (!row?.closest(HISTORY_CONTENT_SELECTOR) || row.dataset.historyEditable !== "true") return null;
  return row;
}

function installHistory() {
  const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
  if (!content || state.history.installed) return;
  state.history.installed = true;
  const closeDeal = getCloseDealController();
  closeDeal.install();

  content.addEventListener("input", (event) => {
    if (event.target.closest?.(".sales-history-edit-row")) state.edit.dirty = true;
  });
  content.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-history-action]");
    if (control) {
      const id = String(control.dataset.viewingId || "");
      const row = control.closest("tr");
      const action = control.dataset.historyAction;
      if (action === "edit") startEditing(id);
      if (action === "save") void saveViewingHistoryEdit(row);
      if (action === "delete") void deleteViewing(row);
      if (action === "close-deal") closeDeal.open(id);
      if (action === "review-deal") closeDeal.openReview(id);
      return;
    }
    if (!isCoarsePointer() || event.target.closest("button, input, a, select, textarea")) return;
    const row = displayRowFromTarget(event.target);
    if (row) startEditing(row.dataset.viewingId || "");
  });
  content.addEventListener("dblclick", (event) => {
    if (isCoarsePointer() || event.target.closest("button, input, a, select, textarea")) return;
    const row = displayRowFromTarget(event.target);
    if (!row) return;
    event.preventDefault();
    startEditing(row.dataset.viewingId || "");
  });
  content.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const row = displayRowFromTarget(event.target);
    if (!row || event.target !== row) return;
    event.preventDefault();
    startEditing(row.dataset.viewingId || "");
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-history-action]")) return;
    if (event.target.closest?.("#sale-close-deal-modal")) return;
    const row = document.querySelector(".sales-history-edit-row");
    if (row && !row.contains(event.target)) cancelEditing();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || document.querySelector("#sale-close-deal-modal")?.hidden === false) return;
    cancelEditing();
  });
  window.addEventListener("joy:sale-history-leave-request", (event) => {
    if (!state.edit.viewingId) return;
    if (state.edit.saving || !cancelEditing()) event.preventDefault();
  });
  const translate = () => {
    renderViewingHistory();
    translateSaleUiRoot(document.querySelector(HISTORY_CONTENT_SELECTOR));
  };
  window.addEventListener("joy:i18n-ready", translate);
  window.addEventListener("joy:locale-changed", translate);
}

window.addEventListener("joy:sale-history-open", (event) => {
  installHistory();
  void loadViewingHistory({ force: event.detail?.force === true });
});
window.addEventListener("joy:sale-assistant-ready", installHistory);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installHistory, { once: true });
} else {
  installHistory();
}
