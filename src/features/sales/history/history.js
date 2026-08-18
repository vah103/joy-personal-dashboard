import { formatVietnamViewingTime } from "../appointments/parser.js";
import { appointmentErrorMessage } from "../appointments/appointment-form.js";
import {
  vietnamDatetimeLocal,
  vietnamLocalToIso,
} from "../shared/dates.js";

let historyLoaded = false;
let viewingHistory = [];
let editingViewingId = "";

function historyStatusLabel(status) {
  if (status === "upcoming") return "Sắp tới";
  if (status === "cancelled") return "Đã huỷ";
  return "Đã qua";
}

function notificationLabel(viewing, kind) {
  const notified = kind === "reminder" ? viewing.reminderNotifiedAt : viewing.followupNotifiedAt;
  const scheduled = kind === "reminder" ? viewing.reminderAt : viewing.followupAt;
  if (notified) return "Đã gửi";
  if (!scheduled) return kind === "reminder" ? "Không nhắc" : "—";
  if (viewing.status === "cancelled") return "Đã huỷ";
  return "Chờ gửi";
}

function makeHistoryInput(field, value, { type = "text", maxLength = 0, required = false } = {}, doc = document) {
  const input = doc.createElement("input");
  input.className = "sales-history-edit-input";
  input.dataset.historyField = field;
  input.type = type;
  input.value = value || "";
  if (maxLength) input.maxLength = maxLength;
  if (required) input.required = true;
  if (type === "tel") input.inputMode = "tel";
  return input;
}

function appendHistoryCell(row, value, doc = document) {
  const cell = doc.createElement("td");
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function renderHistoryDisplayRow(viewing, doc = document) {
  const row = doc.createElement("tr");
  row.dataset.status = viewing.status;
  [
    formatVietnamViewingTime(viewing.viewingAt),
    viewing.customerName || "—",
    viewing.phone || "—",
    viewing.viewingAddress || "—",
    historyStatusLabel(viewing.status),
    notificationLabel(viewing, "reminder"),
    notificationLabel(viewing, "followup"),
  ].forEach((value) => appendHistoryCell(row, value, doc));

  const actionCell = doc.createElement("td");
  actionCell.className = "sales-history-actions-cell";
  const edit = doc.createElement("button");
  edit.type = "button";
  edit.className = "sales-history-edit-button";
  edit.dataset.action = "edit-sale-viewing";
  edit.dataset.viewingId = viewing.id;
  edit.textContent = "Sửa";
  actionCell.append(edit);
  row.append(actionCell);
  return row;
}

function renderHistoryEditRow(viewing, doc = document) {
  const row = doc.createElement("tr");
  row.className = "sales-history-edit-row";
  row.dataset.status = viewing.status;
  row.dataset.viewingId = viewing.id;

  const timeCell = doc.createElement("td");
  timeCell.append(makeHistoryInput("viewingTime", vietnamDatetimeLocal(viewing.viewingAt), { type: "datetime-local", required: true }, doc));
  row.append(timeCell);

  const customerCell = doc.createElement("td");
  customerCell.append(makeHistoryInput("customerName", viewing.customerName, { maxLength: 100, required: true }, doc));
  row.append(customerCell);

  const phoneCell = doc.createElement("td");
  phoneCell.append(makeHistoryInput("phone", viewing.phone, { type: "tel", maxLength: 20 }, doc));
  row.append(phoneCell);

  const addressCell = doc.createElement("td");
  addressCell.append(makeHistoryInput("viewingAddress", viewing.viewingAddress, { maxLength: 220, required: true }, doc));
  row.append(addressCell);

  appendHistoryCell(row, historyStatusLabel(viewing.status), doc);
  appendHistoryCell(row, notificationLabel(viewing, "reminder"), doc);
  appendHistoryCell(row, notificationLabel(viewing, "followup"), doc);

  const actionCell = doc.createElement("td");
  actionCell.className = "sales-history-actions-cell";
  const controls = doc.createElement("div");
  controls.className = "sales-history-edit-controls";

  const save = doc.createElement("button");
  save.type = "button";
  save.className = "sales-history-save-button";
  save.dataset.action = "save-sale-viewing";
  save.dataset.viewingId = viewing.id;
  save.textContent = "Lưu";

  const cancel = doc.createElement("button");
  cancel.type = "button";
  cancel.className = "sales-history-cancel-button";
  cancel.dataset.action = "cancel-sale-viewing-edit";
  cancel.dataset.viewingId = viewing.id;
  cancel.textContent = "Huỷ";

  const message = doc.createElement("small");
  message.className = "sales-history-edit-message";
  message.hidden = true;

  controls.append(save, cancel, message);
  actionCell.append(controls);
  row.append(actionCell);
  return row;
}

function renderViewingHistory(history, doc = document) {
  const content = doc.querySelector("#sales-history-content");
  const count = doc.querySelector("#sales-history-count");
  if (!content || !count) return;

  viewingHistory = Array.isArray(history) ? history : [];
  if (editingViewingId && !viewingHistory.some((viewing) => viewing.id === editingViewingId)) {
    editingViewingId = "";
  }
  count.textContent = `${viewingHistory.length} lịch hẹn`;

  if (!viewingHistory.length) {
    const empty = doc.createElement("p");
    empty.className = "sales-history-empty";
    empty.textContent = "Chưa có lịch hẹn nào trong Joy.";
    content.replaceChildren(empty);
    return;
  }

  const table = doc.createElement("table");
  table.className = "sales-history-table";
  const head = doc.createElement("thead");
  const headRow = doc.createElement("tr");
  ["Thời gian", "Khách", "SĐT", "Địa chỉ", "Trạng thái", "Nhắc 30p", "Follow-up", ""].forEach((label) => {
    const th = doc.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.append(th);
  });
  head.append(headRow);

  const body = doc.createElement("tbody");
  viewingHistory.forEach((viewing) => {
    body.append(
      viewing.id === editingViewingId
        ? renderHistoryEditRow(viewing, doc)
        : renderHistoryDisplayRow(viewing, doc),
    );
  });
  table.append(head, body);
  content.replaceChildren(table);
}

async function saveViewingHistoryEdit(control, doc = document) {
  const id = control.dataset.viewingId || "";
  const row = control.closest("tr");
  if (!id || !row) return;

  const field = (name) => row.querySelector(`[data-history-field="${name}"]`);
  const customerName = field("customerName")?.value.trim() || "";
  const phone = field("phone")?.value.trim() || "";
  const viewingAddress = field("viewingAddress")?.value.trim() || "";
  const viewingAt = vietnamLocalToIso(field("viewingTime")?.value || "");
  const message = row.querySelector(".sales-history-edit-message");

  if (!customerName || !viewingAddress || !viewingAt) {
    if (message) {
      message.textContent = "Điền đủ tên, địa chỉ và thời gian.";
      message.hidden = false;
    }
    return;
  }

  const buttons = row.querySelectorAll("button");
  buttons.forEach((button) => { button.disabled = true; });
  if (message) {
    message.textContent = "Đang lưu…";
    message.hidden = false;
  }

  try {
    const response = await fetch("/api/sales/viewings", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, customerName, phone, viewingAddress, viewingAt }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || "VIEWING_UPDATE_FAILED"), { code: payload.error });

    editingViewingId = "";
    historyLoaded = false;
    await loadViewingHistory({ force: true }, doc);
  } catch (error) {
    buttons.forEach((button) => { button.disabled = false; });
    if (message) {
      message.textContent = appointmentErrorMessage(error.code);
      message.hidden = false;
    }
  }
}

export async function loadViewingHistory({ force = false } = {}, doc = document) {
  if (historyLoaded && !force) return;
  const content = doc.querySelector("#sales-history-content");
  const count = doc.querySelector("#sales-history-count");
  if (content) content.textContent = "Đang tải lịch sử…";
  if (count) count.textContent = "Đang tải…";
  try {
    const response = await fetch("/api/sales/viewings", { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "VIEWING_HISTORY_FAILED");
    renderViewingHistory(Array.isArray(payload.history) ? payload.history : [], doc);
    historyLoaded = true;
  } catch {
    if (content) content.textContent = "Joy chưa tải được lịch sử. Hãy thử lại.";
    if (count) count.textContent = "Không tải được";
  }
}

export function markViewingHistoryStale() {
  historyLoaded = false;
}

export function handleViewingHistoryAction(control, doc = document) {
  if (control.dataset.action === "edit-sale-viewing") {
    editingViewingId = control.dataset.viewingId || "";
    renderViewingHistory(viewingHistory, doc);
  }
  if (control.dataset.action === "cancel-sale-viewing-edit") {
    editingViewingId = "";
    renderViewingHistory(viewingHistory, doc);
  }
  if (control.dataset.action === "save-sale-viewing") void saveViewingHistoryEdit(control, doc);
}

export function refreshViewingHistory(doc = document) {
  editingViewingId = "";
  void loadViewingHistory({ force: true }, doc);
}

export function cancelViewingHistoryEdit(doc = document) {
  if (!editingViewingId) return false;
  editingViewingId = "";
  renderViewingHistory(viewingHistory, doc);
  return true;
}
