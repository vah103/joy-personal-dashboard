import { formatVietnamViewingTime } from "./appointment.js";
import {
  formatVnd,
  vietnamDatetimeLocal,
  vietnamLocalToIso,
  vietnamMonthKey,
} from "../shared/format.js";

const HISTORY_CONTENT_SELECTOR = "#sales-history-content";
const DISPLAY_ROW_SELECTOR = ".sales-history-table tbody tr:not(.sales-history-edit-row)";
const CLOSE_DEAL_ENDPOINT = "/api/sales/viewings/close-deal";
const CLOSE_DEAL_REVIEW_ENDPOINT = "/api/sales/viewings/close-deal/review";
const VIEWINGS_ENDPOINT = "/api/sales/viewings";
const DEAL_LOCK_REVIEW_MS = 2 * 60 * 1000;

let viewingHistory = [];
let historyLoaded = false;
let editingViewingId = "";
let editingDirty = false;
let historyInstalled = false;
let historyLoadSeq = 0;
let closeDealSaving = false;
let closeDealOperationSeq = 0;
let reviewResolutionSaving = false;
let reviewOperationSeq = 0;

function isCoarsePointer() {
  return window.matchMedia?.("(pointer: coarse)")?.matches === true;
}

function translateRoot(root) {
  if (root) window.JoyI18n?.translateRoot?.(root);
}

function emitSalesChanged(kind) {
  window.dispatchEvent(new CustomEvent("joy:sales-changed", { detail: { kind } }));
}

function dealSavingNeedsReview(viewing) {
  if (!viewing?.dealSaving || !viewing.dealSavingSince) return false;
  const lockedAt = new Date(viewing.dealSavingSince).getTime();
  return Number.isFinite(lockedAt) && Date.now() - lockedAt >= DEAL_LOCK_REVIEW_MS;
}

function historyStatusLabel(viewing) {
  if (viewing.dealSaved) return "Closed";
  if (viewing.dealSaving) return dealSavingNeedsReview(viewing) ? "Review deal save" : "Saving deal";
  if (viewing.status === "upcoming") return "Sắp tới";
  if (viewing.status === "cancelled") return "Đã huỷ";
  return "Đã qua";
}

function reminderLabel(viewing) {
  if (viewing.dealSaved || viewing.dealSaving) return "—";
  if (viewing.status === "cancelled") return "Cancelled";
  if (viewing.followupNotifiedAt) return "Follow-up sent";
  if (viewing.status === "past" && viewing.followupAt) return "Follow-up pending";
  if (viewing.status === "upcoming" && viewing.reminderNotifiedAt) return "Reminder sent";
  if (viewing.status === "upcoming" && viewing.reminderAt) return "Reminder pending";
  if (viewing.status === "upcoming" && !viewing.reminderAt) return "No advance reminder";
  if (viewing.reminderNotifiedAt) return "Reminder sent";
  if (viewing.followupAt) return "Follow-up pending";
  return "—";
}

const APPOINTMENT_ERROR_MESSAGES = Object.freeze({
  VIEWING_ADDRESS_REQUIRED: "Vui lòng nhập địa chỉ xem phòng.",
  VIEWING_TIME_REQUIRED: "Vui lòng chọn thời gian hẹn.",
  VIEWING_TIME_IN_PAST: "Thời gian hẹn đã qua. Hãy chọn lại.",
  VIEWING_TIME_TOO_FAR: "Joy chỉ nhận lịch trong vòng 1 năm tới.",
  VIEWING_NOT_FOUND: "Không tìm thấy lịch hẹn này.",
  VIEWING_ID_REQUIRED: "Joy chưa xác định được lịch cần sửa.",
  VIEWING_ALREADY_CLOSED: "Deal đã được lưu. Lịch hẹn này không thể sửa hoặc xóa nữa.",
  SALE_DEAL_SAVE_IN_PROGRESS: "Deal đang được lưu. Hãy chờ trạng thái cập nhật.",
  SALE_DEAL_SAVE_REVIEW_REQUIRED: "Trạng thái lưu deal cần được kiểm tra trước khi thao tác tiếp.",
  AUTH_REQUIRED: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại Joy.",
});

function editErrorMessage(code) {
  return APPOINTMENT_ERROR_MESSAGES[code] || "Không thể cập nhật lịch hẹn. Hãy thử lại.";
}

function deleteErrorMessage(code) {
  return APPOINTMENT_ERROR_MESSAGES[code] || "Không thể xóa lịch hẹn. Hãy thử lại.";
}

function closeDealErrorMessage(code) {
  const messages = {
    ...APPOINTMENT_ERROR_MESSAGES,
    SALE_DEAL_CREATE_FAILED: "Could not save the deal. Please try again.",
    SHEETS_WRITE_AUTHORIZATION_REQUIRED: "Reconnect Google before saving the deal.",
    SHEETS_WRITE_ACCESS_DENIED: "Joy does not have permission to save this deal.",
  };
  return messages[code] || "Could not save the deal. Please try again.";
}

function reviewErrorMessage(code) {
  return APPOINTMENT_ERROR_MESSAGES[code] || "Could not resolve the deal review. Please try again.";
}

function viewingById(id) {
  return viewingHistory.find((viewing) => String(viewing.id) === String(id)) || null;
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
        ? "Tap to edit this appointment"
        : "Double-click or press Enter to edit this appointment"
      : viewing.dealSaved
        ? "Closed deal"
        : savingReview ? "Deal save needs review" : "Deal save in progress",
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
    actionCell.append(makeActionButton("Edit", "edit", viewing, "sales-history-edit-button"));
  }

  const closeLabel = viewing.dealSaved
    ? "Deal saved"
    : viewing.dealSaving
      ? savingReview ? "Review save" : "Saving…"
      : "Close deal";
  const closeAction = savingReview ? "review-deal" : "close-deal";
  actionCell.append(
    makeActionButton(
      closeLabel,
      closeAction,
      viewing,
      "sales-history-close-button",
      {
        disabled: Boolean(viewing.dealSaved || (viewing.dealSaving && !savingReview)),
        title: viewing.dealSaved
          ? "Deal saved to Sale Manager."
          : viewing.dealSaving
            ? savingReview ? "Check Sale Manager and resolve this save." : "Deal save is in progress."
            : "Close this deal.",
      },
    ),
  );
  row.append(actionCell);
  translateRoot(row);
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
    makeActionButton("Delete", "delete", viewing, "sales-history-delete-button"),
    makeActionButton("Save", "save", viewing, "sales-history-save-button"),
  );

  const message = document.createElement("small");
  message.className = "sales-history-edit-message";
  message.hidden = true;
  controls.append(message);
  actionCell.append(controls);
  row.append(actionCell);
  translateRoot(row);
  return row;
}

function renderViewingHistory() {
  const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
  const count = document.querySelector("#sales-history-count");
  const hint = document.querySelector("#sales-history-edit-hint");
  if (!content || !count) return;

  const editingViewing = editingViewingId ? viewingById(editingViewingId) : null;
  if (editingViewingId && (!editingViewing || editingViewing.dealSaved || editingViewing.dealSaving)) {
    editingViewingId = "";
    editingDirty = false;
  }
  count.textContent = `${viewingHistory.length} lịch hẹn`;
  if (hint) hint.textContent = isCoarsePointer() ? "Tap a row to edit it" : "Double-click a row to edit it";

  if (!viewingHistory.length) {
    const empty = document.createElement("p");
    empty.className = "sales-history-empty";
    empty.textContent = "Chưa có lịch hẹn nào trong Joy.";
    content.replaceChildren(empty);
    translateRoot(content);
    return;
  }

  const table = document.createElement("table");
  table.className = "sales-history-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Thời gian", "Khách", "SĐT", "Địa chỉ", "Trạng thái", "Reminder", ""].forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.append(th);
  });
  head.append(headRow);

  const body = document.createElement("tbody");
  viewingHistory.forEach((viewing) => {
    body.append(
      String(viewing.id) === String(editingViewingId) && !viewing.dealSaved && !viewing.dealSaving
        ? renderHistoryEditRow(viewing)
        : renderHistoryDisplayRow(viewing),
    );
  });
  table.append(head, body);
  content.replaceChildren(table);
  translateRoot(content);
}

async function loadViewingHistory({ force = false } = {}) {
  if (historyLoaded && !force) {
    renderViewingHistory();
    return;
  }
  const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
  const count = document.querySelector("#sales-history-count");
  if (!content || !count) return;
  const requestSeq = ++historyLoadSeq;
  content.textContent = "Đang tải lịch sử…";
  count.textContent = "Đang tải…";

  try {
    const response = await fetch(VIEWINGS_ENDPOINT, { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "VIEWING_HISTORY_FAILED");
    if (requestSeq !== historyLoadSeq) return;
    viewingHistory = Array.isArray(payload.history) ? payload.history : [];
    historyLoaded = true;
    renderViewingHistory();
  } catch {
    if (requestSeq !== historyLoadSeq) return;
    content.textContent = "Joy chưa tải được lịch sử. Hãy thử lại.";
    count.textContent = "Không tải được";
  }
}

function confirmDiscardEditing() {
  return !editingDirty || window.confirm("Discard unsaved appointment changes?");
}

function cancelEditing({ force = false } = {}) {
  if (!editingViewingId) return true;
  if (!force && !confirmDiscardEditing()) return false;
  editingViewingId = "";
  editingDirty = false;
  renderViewingHistory();
  return true;
}

function startEditing(id) {
  const viewing = viewingById(id);
  if (!viewing || viewing.dealSaved || viewing.dealSaving) return;
  if (editingViewingId && String(editingViewingId) !== String(id) && !cancelEditing()) return;
  editingViewingId = String(id);
  editingDirty = false;
  renderViewingHistory();
}

function setEditMessage(row, text) {
  const message = row?.querySelector(".sales-history-edit-message");
  if (!message) return;
  message.textContent = text;
  message.hidden = !text;
  translateRoot(row);
}

async function recoverViewingState(code) {
  if (!["VIEWING_ALREADY_CLOSED", "SALE_DEAL_SAVE_IN_PROGRESS", "SALE_DEAL_SAVE_REVIEW_REQUIRED"].includes(code)) {
    return false;
  }
  editingViewingId = "";
  editingDirty = false;
  historyLoaded = false;
  await loadViewingHistory({ force: true });
  return true;
}

async function saveViewingHistoryEdit(row) {
  const id = String(row?.dataset.viewingId || "");
  const viewing = viewingById(id);
  if (!id || !viewing || viewing.dealSaved || viewing.dealSaving) return;
  const field = (name) => row.querySelector(`[data-history-field="${name}"]`);
  const customerName = field("customerName")?.value.trim() || "";
  const phone = field("phone")?.value.trim() || "";
  const viewingAddress = field("viewingAddress")?.value.trim() || "";
  const viewingAt = vietnamLocalToIso(field("viewingTime")?.value || "");

  if (!customerName || !viewingAddress || !viewingAt) {
    setEditMessage(row, "Điền đủ tên, địa chỉ và thời gian.");
    return;
  }

  row.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  setEditMessage(row, "Đang lưu…");

  try {
    const response = await fetch(VIEWINGS_ENDPOINT, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, customerName, phone, viewingAddress, viewingAt }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || "VIEWING_UPDATE_FAILED"), { code: payload.error });
    editingViewingId = "";
    editingDirty = false;
    historyLoaded = false;
    await loadViewingHistory({ force: true });
    emitSalesChanged("viewing-updated");
  } catch (error) {
    if (await recoverViewingState(error.code)) return;
    row.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    setEditMessage(row, editErrorMessage(error.code));
  }
}

async function deleteViewing(row) {
  const id = String(row?.dataset.viewingId || "");
  const viewing = viewingById(id);
  if (!id || !viewing || viewing.dealSaved || viewing.dealSaving) return;
  const customer = row.querySelector('[data-history-field="customerName"]')?.value.trim() || viewing.customerName || "this appointment";
  if (!window.confirm(`Delete the appointment for ${customer}?`)) return;

  row.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  setEditMessage(row, "Deleting…");

  try {
    const response = await fetch("/api/sales/viewings/delete", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || "VIEWING_DELETE_FAILED"), { code: payload.error });
    viewingHistory = viewingHistory.filter((item) => String(item.id) !== id);
    editingViewingId = "";
    editingDirty = false;
    renderViewingHistory();
    emitSalesChanged("viewing-deleted");
  } catch (error) {
    if (await recoverViewingState(error.code)) return;
    row.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    setEditMessage(row, deleteErrorMessage(error.code));
  }
}

function ensureCloseDealModal() {
  let modal = document.querySelector("#sale-close-deal-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.className = "modal-backdrop sale-close-deal-backdrop";
  modal.id = "sale-close-deal-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <section class="sale-close-deal-modal" role="dialog" aria-modal="true" aria-labelledby="sale-close-deal-title">
      <div class="sale-close-deal-heading">
        <div><small>Sale Manager</small><h2 id="sale-close-deal-title">Close deal</h2></div>
        <button type="button" aria-label="Close form" data-history-action="close-deal-form">×</button>
      </div>
      <form id="sale-close-deal-form">
        <input name="viewingId" type="hidden">
        <div class="sale-close-deal-grid">
          <label>Customer<input name="customer" type="text" maxlength="120" required></label>
          <label>Phone<input name="phone" type="tel" maxlength="30" inputmode="tel"></label>
          <label class="wide">Address<input name="address" type="text" maxlength="180" required></label>
          <label>Host<input name="host" type="text" maxlength="120"></label>
          <label>Room price<input name="rent" type="number" min="1" max="1000000000" step="1" inputmode="numeric" required></label>
          <label>Commission rate (%)<input name="rate" type="number" min="0.01" max="100" step="0.01" inputmode="decimal" required></label>
        </div>
        <div class="sale-close-deal-preview"><span>Calculated commission</span><strong>0 ₫</strong></div>
        <p class="sale-close-deal-status" hidden></p>
        <div class="sale-close-deal-actions">
          <button class="secondary-button" type="button" data-history-action="close-deal-form">Cancel</button>
          <button class="primary-button" type="submit">Save deal</button>
        </div>
      </form>
      <section class="sale-close-deal-review" id="sale-close-deal-review" hidden>
        <p>Joy could not confirm whether Google Sheets saved this deal. Check Sale Manager, then choose the matching result below.</p>
        <p class="sale-close-deal-review-customer"></p>
        <p class="sale-close-deal-review-status" hidden></p>
        <div class="sale-close-deal-actions">
          <a class="secondary-button" href="/sale-manager.html" target="_blank" rel="noopener">Open Sale Manager</a>
          <button class="secondary-button" type="button" data-history-action="review-deal-retry">Deal missing · Retry</button>
          <button class="primary-button" type="button" data-history-action="review-deal-saved">Deal exists · Mark saved</button>
        </div>
      </section>
    </section>
  `;
  document.body.append(modal);

  const form = modal.querySelector("#sale-close-deal-form");
  form?.elements.rent.addEventListener("input", updateCloseDealPreview);
  form?.elements.rate.addEventListener("input", updateCloseDealPreview);
  form?.addEventListener("submit", saveClosedDeal);
  modal.addEventListener("mousedown", (event) => {
    if (event.target === modal) closeDealForm();
  });
  translateRoot(modal);
  return modal;
}

function updateCloseDealPreview() {
  const form = document.querySelector("#sale-close-deal-form");
  const preview = document.querySelector(".sale-close-deal-preview strong");
  if (!form || !preview) return;
  const rent = Number(form.elements.rent.value || 0);
  const rate = Number(form.elements.rate.value || 0) / 100;
  preview.textContent = formatVnd(Math.round(rent * rate));
}

function setCloseDealBusy(busy) {
  const modal = document.querySelector("#sale-close-deal-modal");
  const form = modal?.querySelector("#sale-close-deal-form");
  form?.querySelectorAll("input, button").forEach((control) => { control.disabled = busy; });
  const close = modal?.querySelector('.sale-close-deal-heading [data-history-action="close-deal-form"]');
  if (close) close.disabled = busy || reviewResolutionSaving;
}

function setReviewBusy(busy) {
  const modal = document.querySelector("#sale-close-deal-modal");
  const review = modal?.querySelector("#sale-close-deal-review");
  review?.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
  const close = modal?.querySelector('.sale-close-deal-heading [data-history-action="close-deal-form"]');
  if (close) close.disabled = busy || closeDealSaving;
}

function openCloseDealForm(id, { message = "" } = {}) {
  if (closeDealSaving || reviewResolutionSaving) return;
  const viewing = viewingById(id);
  if (!viewing || viewing.dealSaved || viewing.dealSaving) return;
  if (editingViewingId && String(editingViewingId) !== String(id) && !cancelEditing()) return;
  if (String(editingViewingId) === String(id)) return;

  const modal = ensureCloseDealModal();
  const form = modal.querySelector("#sale-close-deal-form");
  const review = modal.querySelector("#sale-close-deal-review");
  if (!form || !review) return;

  form.hidden = false;
  review.hidden = true;
  form.reset();
  form.elements.viewingId.value = viewing.id;
  form.elements.customer.value = viewing.customerName || "";
  form.elements.phone.value = viewing.phone || "";
  form.elements.address.value = viewing.viewingAddress || "";
  const status = modal.querySelector(".sale-close-deal-status");
  if (status) {
    status.textContent = message;
    status.hidden = !message;
  }
  const title = modal.querySelector("#sale-close-deal-title");
  if (title) title.textContent = "Close deal";
  updateCloseDealPreview();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => form.elements.rent.focus(), 0);
}

function openDealReview(id) {
  if (closeDealSaving || reviewResolutionSaving) return;
  const viewing = viewingById(id);
  if (!viewing || viewing.dealSaved || !dealSavingNeedsReview(viewing)) return;
  if (editingViewingId && !cancelEditing()) return;

  const modal = ensureCloseDealModal();
  const form = modal.querySelector("#sale-close-deal-form");
  const review = modal.querySelector("#sale-close-deal-review");
  if (!form || !review) return;
  form.hidden = true;
  review.hidden = false;
  review.dataset.viewingId = viewing.id;
  const customer = review.querySelector(".sale-close-deal-review-customer");
  if (customer) customer.textContent = `${viewing.customerName || "Customer"} · ${viewing.viewingAddress || "—"}`;
  const status = review.querySelector(".sale-close-deal-review-status");
  if (status) {
    status.textContent = "";
    status.hidden = true;
  }
  const title = modal.querySelector("#sale-close-deal-title");
  if (title) title.textContent = "Review deal save";
  modal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => review.querySelector('[data-history-action="review-deal-saved"]')?.focus(), 0);
  translateRoot(modal);
}

function closeDealForm({ force = false } = {}) {
  if (!force && (closeDealSaving || reviewResolutionSaving)) return false;
  const modal = document.querySelector("#sale-close-deal-modal");
  if (!modal) return true;
  modal.hidden = true;
  const assistantVisible = document.querySelector("#sales-assistant-modal")?.hidden === false;
  if (!assistantVisible) document.body.classList.remove("modal-open");
  return true;
}

async function saveClosedDeal(event) {
  event.preventDefault();
  if (closeDealSaving || reviewResolutionSaving) return;
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const modal = document.querySelector("#sale-close-deal-modal");
  const status = modal?.querySelector(".sale-close-deal-status");
  const save = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const viewingId = String(data.get("viewingId") || "").trim();
  const viewing = viewingById(viewingId);
  if (!viewing || viewing.dealSaved || viewing.dealSaving) {
    closeDealForm({ force: true });
    return;
  }

  const payload = {
    viewingId,
    month: vietnamMonthKey(),
    customer: String(data.get("customer") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    address: String(data.get("address") || "").trim(),
    host: String(data.get("host") || "").trim(),
    rent: Number(data.get("rent") || 0),
    rate: Number(data.get("rate") || 0),
  };

  const operationId = ++closeDealOperationSeq;
  closeDealSaving = true;
  setCloseDealBusy(true);
  if (save) save.textContent = "Saving deal…";
  if (status) status.hidden = true;
  translateRoot(modal);

  try {
    const response = await fetch(CLOSE_DEAL_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || "SALE_DEAL_CREATE_FAILED"), { code: result.error });
    if (operationId !== closeDealOperationSeq) return;

    editingViewingId = "";
    editingDirty = false;
    historyLoaded = false;
    await loadViewingHistory({ force: true });
    closeDealSaving = false;
    setCloseDealBusy(false);
    closeDealForm({ force: true });
    window.dispatchEvent(new CustomEvent("joy:sale-deal-saved"));
    emitSalesChanged("deal-saved");
  } catch (error) {
    if (operationId !== closeDealOperationSeq) return;
    if (error.code === "SALE_DEAL_SAVE_REVIEW_REQUIRED") {
      historyLoaded = false;
      await loadViewingHistory({ force: true });
      closeDealSaving = false;
      setCloseDealBusy(false);
      openDealReview(viewingId);
      return;
    }
    if (await recoverViewingState(error.code)) {
      closeDealSaving = false;
      setCloseDealBusy(false);
      closeDealForm({ force: true });
      return;
    }
    if (status) {
      status.textContent = closeDealErrorMessage(error.code);
      status.hidden = false;
      translateRoot(modal);
    }
  } finally {
    if (operationId === closeDealOperationSeq && closeDealSaving) {
      closeDealSaving = false;
      setCloseDealBusy(false);
    }
    if (save) save.textContent = "Save deal";
    translateRoot(modal);
  }
}

async function resolveDealReview(resolution) {
  if (closeDealSaving || reviewResolutionSaving) return;
  const modal = document.querySelector("#sale-close-deal-modal");
  const review = modal?.querySelector("#sale-close-deal-review");
  const viewingId = String(review?.dataset.viewingId || "");
  const viewing = viewingById(viewingId);
  if (!review || !viewingId || !viewing || !["saved", "retry"].includes(resolution)) return;

  const status = review.querySelector(".sale-close-deal-review-status");
  const operationId = ++reviewOperationSeq;
  reviewResolutionSaving = true;
  setReviewBusy(true);
  if (status) {
    status.textContent = resolution === "saved" ? "Confirming saved deal…" : "Preparing a safe retry…";
    status.hidden = false;
  }

  try {
    const response = await fetch(CLOSE_DEAL_REVIEW_ENDPOINT, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewingId, resolution }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || "SALE_DEAL_REVIEW_FAILED"), { code: payload.error });
    if (operationId !== reviewOperationSeq) return;

    historyLoaded = false;
    await loadViewingHistory({ force: true });
    reviewResolutionSaving = false;
    setReviewBusy(false);
    closeDealForm({ force: true });

    if (resolution === "saved") {
      window.dispatchEvent(new CustomEvent("joy:sale-deal-saved"));
      emitSalesChanged("deal-review-saved");
    } else {
      emitSalesChanged("deal-review-retry");
      openCloseDealForm(viewingId, { message: "Review cleared. Enter the deal details and save again." });
    }
  } catch (error) {
    if (operationId !== reviewOperationSeq) return;
    if (status) {
      status.textContent = reviewErrorMessage(error.code);
      status.hidden = false;
      translateRoot(modal);
    }
  } finally {
    if (operationId === reviewOperationSeq && reviewResolutionSaving) {
      reviewResolutionSaving = false;
      setReviewBusy(false);
    }
  }
}

function displayRowFromTarget(target) {
  const row = target?.closest?.(DISPLAY_ROW_SELECTOR);
  if (!row?.closest(HISTORY_CONTENT_SELECTOR)) return null;
  if (row.dataset.historyEditable !== "true") return null;
  return row;
}

function installHistory() {
  const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
  if (!content || historyInstalled) return;
  historyInstalled = true;
  ensureCloseDealModal();

  content.addEventListener("input", (event) => {
    if (event.target.closest?.(".sales-history-edit-row")) editingDirty = true;
  });

  content.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-history-action]");
    if (control) {
      const id = String(control.dataset.viewingId || "");
      const row = control.closest("tr");
      if (control.dataset.historyAction === "edit") startEditing(id);
      if (control.dataset.historyAction === "save") void saveViewingHistoryEdit(row);
      if (control.dataset.historyAction === "delete") void deleteViewing(row);
      if (control.dataset.historyAction === "close-deal") openCloseDealForm(id);
      if (control.dataset.historyAction === "review-deal") openDealReview(id);
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
    const action = event.target.closest?.("[data-history-action]")?.dataset.historyAction;
    if (action === "close-deal-form") {
      closeDealForm();
      return;
    }
    if (action === "review-deal-saved") {
      void resolveDealReview("saved");
      return;
    }
    if (action === "review-deal-retry") {
      if (window.confirm("Only retry if the deal is not present in Sale Manager. Continue?")) {
        void resolveDealReview("retry");
      }
      return;
    }
    if (event.target.closest?.("[data-history-action]")) return;
    if (event.target.closest?.("#sale-close-deal-modal")) return;
    const row = document.querySelector(".sales-history-edit-row");
    if (row && !row.contains(event.target)) cancelEditing();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (document.querySelector("#sale-close-deal-modal")?.hidden === false) {
      closeDealForm();
      return;
    }
    cancelEditing();
  });

  window.addEventListener("joy:i18n-ready", () => {
    translateRoot(document.querySelector(HISTORY_CONTENT_SELECTOR));
    translateRoot(document.querySelector("#sale-close-deal-modal"));
  });
  window.addEventListener("joy:locale-changed", () => {
    translateRoot(document.querySelector(HISTORY_CONTENT_SELECTOR));
    translateRoot(document.querySelector("#sale-close-deal-modal"));
  });
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
