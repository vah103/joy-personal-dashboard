import {
  formatVietnamViewingTime,
  parseSaleAppointmentInput,
} from "./sale-appointment.js";

let historyLoaded = false;
let viewingHistory = [];
let editingViewingId = "";

const ASSISTANT_HTML = `
  <div class="modal-backdrop sales-assistant-backdrop" id="sales-assistant-modal" role="presentation" hidden>
    <section class="modal sales-assistant-modal" role="dialog" aria-modal="true" aria-labelledby="sales-assistant-title">
      <div class="modal-heading sales-assistant-heading">
        <div>
          <p class="section-kicker">Sale Assistant</p>
          <h2 id="sales-assistant-title">Hẹn khách xem phòng</h2>
          <span>Tạo lịch, theo dõi lịch sử và tóm tắt thông tin phòng ngay trong Joy.</span>
        </div>
        <button type="button" aria-label="Đóng Sale Assistant" data-action="close-sales-assistant">×</button>
      </div>

      <nav class="sales-assistant-tabs" aria-label="Sale Assistant tools">
        <button class="active" type="button" data-assistant-mode="appointment">Hẹn khách</button>
        <button type="button" data-assistant-mode="summary">Tóm tắt phòng</button>
        <button type="button" data-assistant-mode="history">Lịch sử</button>
      </nav>

      <section class="sales-assistant-panel" data-assistant-panel="appointment">
        <div class="sales-appointment-layout">
          <div class="sales-appointment-composer">
            <label for="sale-appointment-input">Thông tin lịch hẹn</label>
            <textarea id="sale-appointment-input" maxlength="1200" spellcheck="false" placeholder="Ví dụ: 8h tối mai chị Lan 0987654321 xem phòng 180 Phú Mỹ"></textarea>
            <p>Joy hiểu “30p nữa”, “mai 8h tối”, “ngày kia”, “giờ khách qua” và ngày dạng 28/07.</p>
            <button class="primary-button" id="sale-appointment-parse" type="button">Tạo lịch hẹn</button>
          </div>

          <form class="sales-appointment-preview" id="sale-appointment-form" hidden>
            <div class="sales-appointment-preview-heading">
              <div><small>Kiểm tra trước khi lưu</small><strong id="sale-appointment-time-label">—</strong></div>
              <span>Joy lịch hẹn</span>
            </div>
            <div class="sales-appointment-fields">
              <label>Tên khách<input name="customerName" type="text" maxlength="100" required></label>
              <label>Số điện thoại<input name="phone" type="tel" maxlength="20" inputmode="tel"></label>
              <label class="wide">Địa chỉ xem phòng<input name="viewingAddress" type="text" maxlength="220" required></label>
              <label class="wide">Thời gian<input name="viewingTime" type="datetime-local" required></label>
            </div>
            <p class="sales-appointment-status" id="sale-appointment-status" hidden></p>
            <div class="sales-appointment-actions">
              <button class="secondary-button" type="button" id="sale-appointment-reset">Nhập lại</button>
              <button class="primary-button" type="submit" id="sale-appointment-save">Lưu lịch</button>
            </div>
          </form>
        </div>
      </section>

      <section class="sales-assistant-panel" data-assistant-panel="summary" hidden>
        <div class="sale-room-workspace sales-assistant-workspace">
          <div class="sale-room-composer">
            <label for="room-summary-input">Thông tin phòng nguồn</label>
            <textarea id="room-summary-input" maxlength="12000" spellcheck="false" placeholder="Ví dụ: 180 Phú Mỹ còn phòng 302 giá 4tr2, vào luôn. Full nội thất, thang máy. Điện 4k, nước 100k/người..."></textarea>
            <p>Số điện thoại, tên nguồn, link và hoa hồng sẽ được loại khỏi bản gửi khách.</p>
            <div class="sale-room-actions">
              <button class="secondary-button" id="room-summary-clear" type="button">Xóa</button>
              <button class="primary-button" id="room-summary-generate" type="button">Tạo tóm tắt</button>
            </div>
          </div>

          <div class="sale-room-preview">
            <div class="sale-room-preview-heading">
              <div><small>Bản gửi khách</small><strong>Sẵn sàng chụp màn hình</strong></div>
              <button class="secondary-button" id="room-summary-capture-button" type="button" disabled>Chế độ chụp</button>
            </div>
            <article class="room-share-card is-empty" id="room-summary-card" aria-live="polite"></article>
            <p class="sale-room-edit-note">Chạm vào nội dung đã tạo để sửa trước khi chụp.</p>
          </div>
        </div>
      </section>

      <section class="sales-assistant-panel" data-assistant-panel="history" hidden>
        <div class="sales-history-workspace">
          <div class="sales-history-heading">
            <div>
              <small>Lịch hẹn được lưu trong Joy</small>
              <strong id="sales-history-count">Đang tải…</strong>
            </div>
            <button class="secondary-button" id="sales-history-refresh" type="button">Làm mới</button>
          </div>
          <div class="sales-history-table-wrap" id="sales-history-content" aria-live="polite">
            <p class="sales-history-loading">Đang tải lịch sử…</p>
          </div>
        </div>
      </section>
    </section>
  </div>

  <div class="sale-room-capture" id="room-summary-capture" hidden aria-label="Room summary screenshot view">
    <div class="sale-room-capture-card" id="room-summary-capture-card"></div>
  </div>
`;

function createAssistantLaunchers() {
  const salesPanel = document.querySelector("#sales");
  const heading = salesPanel?.querySelector(".panel-heading");
  const salesBody = salesPanel?.querySelector(".sales-body");
  const salesSummary = salesPanel?.querySelector(".sales-summary");
  if (!salesPanel || !heading || !salesBody || !salesSummary) return false;

  const manageButton = heading.querySelector('[data-action="open-sale-manager"]:last-child');
  if (manageButton && !heading.querySelector(".sales-heading-actions")) {
    const actions = document.createElement("div");
    actions.className = "sales-heading-actions";
    const assistantButton = document.createElement("button");
    assistantButton.type = "button";
    assistantButton.className = "quiet-link sales-assistant-heading-button";
    assistantButton.dataset.action = "open-sales-assistant";
    assistantButton.textContent = "Assistant";
    manageButton.before(actions);
    actions.append(assistantButton, manageButton);
  }

  if (!salesBody.querySelector(".sales-assistant-launch")) {
    const launch = document.createElement("button");
    launch.type = "button";
    launch.className = "sales-assistant-launch";
    launch.dataset.action = "open-sales-assistant";
    launch.innerHTML = `
      <span class="sales-assistant-launch-icon" aria-hidden="true">＋</span>
      <span class="sales-assistant-launch-copy">
        <strong>Schedule a viewing</strong>
      </span>
      <span class="sales-assistant-launch-arrow" aria-hidden="true">→</span>
    `;
    salesSummary.after(launch);
  }
  return true;
}

function createAssistantModal() {
  if (!document.querySelector("#sales-assistant-modal")) {
    document.body.insertAdjacentHTML("beforeend", ASSISTANT_HTML);
  }
}

function visibleModalExists() {
  return [...document.querySelectorAll(".modal-backdrop")].some((modal) => !modal.hidden);
}

function openAssistant() {
  const modal = document.querySelector("#sales-assistant-modal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => document.querySelector("#sale-appointment-input")?.focus(), 0);
}

function closeAssistant() {
  const modal = document.querySelector("#sales-assistant-modal");
  if (!modal) return;
  modal.hidden = true;
  if (!visibleModalExists()) document.body.classList.remove("modal-open");
}

function switchMode(mode) {
  document.querySelectorAll("[data-assistant-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.assistantMode === mode);
  });
  document.querySelectorAll("[data-assistant-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.assistantPanel !== mode;
  });
  const title = document.querySelector("#sales-assistant-title");
  const titles = {
    appointment: "Hẹn khách xem phòng",
    summary: "Tóm tắt thông tin phòng",
    history: "Lịch sử hẹn khách",
  };
  if (title) title.textContent = titles[mode] || titles.appointment;
  if (mode === "history") loadViewingHistory();
}

function vietnamDatetimeLocal(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function vietnamLocalToIso(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute)).toISOString();
}

function showAppointmentStatus(message, state = "") {
  const status = document.querySelector("#sale-appointment-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

function appointmentFormPayload() {
  const form = document.querySelector("#sale-appointment-form");
  if (!form) return null;
  const data = new FormData(form);
  return {
    customerName: String(data.get("customerName") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    viewingAddress: String(data.get("viewingAddress") || "").trim(),
    viewingAt: vietnamLocalToIso(data.get("viewingTime")),
  };
}

function updateAppointmentTimeLabel() {
  const payload = appointmentFormPayload();
  const label = document.querySelector("#sale-appointment-time-label");
  if (label) label.textContent = payload?.viewingAt ? formatVietnamViewingTime(payload.viewingAt) : "Chưa rõ thời gian";
}

function parseAppointment() {
  const input = document.querySelector("#sale-appointment-input");
  const form = document.querySelector("#sale-appointment-form");
  if (!input || !form) return;
  const parsed = parseSaleAppointmentInput(input.value);
  form.hidden = false;
  form.elements.customerName.value = parsed.customerName;
  form.elements.phone.value = parsed.phone;
  form.elements.viewingAddress.value = parsed.viewingAddress;
  form.elements.viewingTime.value = vietnamDatetimeLocal(parsed.viewingAt);
  updateAppointmentTimeLabel();

  if (parsed.valid) {
    showAppointmentStatus("Joy đã tách thông tin. Hãy kiểm tra lại trước khi lưu.", "ready");
  } else {
    const missingLabels = {
      customerName: "tên khách",
      viewingAddress: "địa chỉ",
      viewingAt: "thời gian",
    };
    showAppointmentStatus(`Chưa nhận ra ${parsed.missing.map((item) => missingLabels[item]).join(", ")}. Bạn có thể điền trực tiếp bên dưới.`, "warning");
  }
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resetAppointment() {
  const input = document.querySelector("#sale-appointment-input");
  const form = document.querySelector("#sale-appointment-form");
  if (input) input.value = "";
  if (form) {
    form.reset();
    form.hidden = true;
  }
  showAppointmentStatus("");
  input?.focus();
}

function appointmentErrorMessage(code) {
  const messages = {
    VIEWING_ADDRESS_REQUIRED: "Vui lòng nhập địa chỉ xem phòng.",
    VIEWING_TIME_REQUIRED: "Vui lòng chọn thời gian hẹn.",
    VIEWING_TIME_IN_PAST: "Thời gian hẹn đã qua. Hãy chọn lại.",
    VIEWING_TIME_TOO_FAR: "Joy chỉ nhận lịch trong vòng 1 năm tới.",
    VIEWING_NOT_FOUND: "Không tìm thấy lịch hẹn này.",
    VIEWING_ID_REQUIRED: "Joy chưa xác định được lịch cần sửa.",
    AUTH_REQUIRED: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại Joy.",
  };
  return messages[code] || "Joy chưa thể lưu lịch. Hãy thử lại.";
}

async function saveAppointment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const save = document.querySelector("#sale-appointment-save");
  const payload = appointmentFormPayload();
  if (!payload || !form.reportValidity()) return;
  save.disabled = true;
  showAppointmentStatus("Đang lưu lịch vào Joy…", "loading");

  try {
    const response = await fetch("/api/sales/viewings", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || "VIEWING_CREATE_FAILED"), { code: result.error });
    historyLoaded = false;
    showAppointmentStatus(`${result.message} ${result.viewing.customerName} · ${formatVietnamViewingTime(result.viewing.viewingAt)}.`, "success");
    window.setTimeout(() => window.location.reload(), 1200);
  } catch (error) {
    showAppointmentStatus(appointmentErrorMessage(error.code), "error");
    save.disabled = false;
  }
}

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

function renderHistoryDisplayRow(viewing) {
  const row = document.createElement("tr");
  row.dataset.status = viewing.status;
  [
    formatVietnamViewingTime(viewing.viewingAt),
    viewing.customerName || "—",
    viewing.phone || "—",
    viewing.viewingAddress || "—",
    historyStatusLabel(viewing.status),
    notificationLabel(viewing, "reminder"),
    notificationLabel(viewing, "followup"),
  ].forEach((value) => appendHistoryCell(row, value));

  const actionCell = document.createElement("td");
  actionCell.className = "sales-history-actions-cell";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "sales-history-edit-button";
  edit.dataset.action = "edit-sale-viewing";
  edit.dataset.viewingId = viewing.id;
  edit.textContent = "Sửa";
  actionCell.append(edit);
  row.append(actionCell);
  return row;
}

function renderHistoryEditRow(viewing) {
  const row = document.createElement("tr");
  row.className = "sales-history-edit-row";
  row.dataset.status = viewing.status;
  row.dataset.viewingId = viewing.id;

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

  appendHistoryCell(row, historyStatusLabel(viewing.status));
  appendHistoryCell(row, notificationLabel(viewing, "reminder"));
  appendHistoryCell(row, notificationLabel(viewing, "followup"));

  const actionCell = document.createElement("td");
  actionCell.className = "sales-history-actions-cell";
  const controls = document.createElement("div");
  controls.className = "sales-history-edit-controls";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "sales-history-save-button";
  save.dataset.action = "save-sale-viewing";
  save.dataset.viewingId = viewing.id;
  save.textContent = "Lưu";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "sales-history-cancel-button";
  cancel.dataset.action = "cancel-sale-viewing-edit";
  cancel.dataset.viewingId = viewing.id;
  cancel.textContent = "Huỷ";

  const message = document.createElement("small");
  message.className = "sales-history-edit-message";
  message.hidden = true;

  controls.append(save, cancel, message);
  actionCell.append(controls);
  row.append(actionCell);
  return row;
}

function renderViewingHistory(history) {
  const content = document.querySelector("#sales-history-content");
  const count = document.querySelector("#sales-history-count");
  if (!content || !count) return;

  viewingHistory = Array.isArray(history) ? history : [];
  if (editingViewingId && !viewingHistory.some((viewing) => viewing.id === editingViewingId)) {
    editingViewingId = "";
  }
  count.textContent = `${viewingHistory.length} lịch hẹn`;

  if (!viewingHistory.length) {
    const empty = document.createElement("p");
    empty.className = "sales-history-empty";
    empty.textContent = "Chưa có lịch hẹn nào trong Joy.";
    content.replaceChildren(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "sales-history-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Thời gian", "Khách", "SĐT", "Địa chỉ", "Trạng thái", "Nhắc 30p", "Follow-up", ""].forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.append(th);
  });
  head.append(headRow);

  const body = document.createElement("tbody");
  viewingHistory.forEach((viewing) => {
    body.append(
      viewing.id === editingViewingId
        ? renderHistoryEditRow(viewing)
        : renderHistoryDisplayRow(viewing),
    );
  });
  table.append(head, body);
  content.replaceChildren(table);
}

async function saveViewingHistoryEdit(control) {
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
    await loadViewingHistory({ force: true });
  } catch (error) {
    buttons.forEach((button) => { button.disabled = false; });
    if (message) {
      message.textContent = appointmentErrorMessage(error.code);
      message.hidden = false;
    }
  }
}

async function loadViewingHistory({ force = false } = {}) {
  if (historyLoaded && !force) return;
  const content = document.querySelector("#sales-history-content");
  const count = document.querySelector("#sales-history-count");
  if (content) content.textContent = "Đang tải lịch sử…";
  if (count) count.textContent = "Đang tải…";
  try {
    const response = await fetch("/api/sales/viewings", { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "VIEWING_HISTORY_FAILED");
    renderViewingHistory(Array.isArray(payload.history) ? payload.history : []);
    historyLoaded = true;
  } catch {
    if (content) content.textContent = "Joy chưa tải được lịch sử. Hãy thử lại.";
    if (count) count.textContent = "Không tải được";
  }
}

async function initializeSalesAssistant() {
  if (!createAssistantLaunchers()) return;
  createAssistantModal();

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action], [data-assistant-mode]");
    if (!control) return;
    if (control.dataset.action === "open-sales-assistant") openAssistant();
    if (control.dataset.action === "close-sales-assistant") closeAssistant();
    if (control.dataset.action === "edit-sale-viewing") {
      editingViewingId = control.dataset.viewingId || "";
      renderViewingHistory(viewingHistory);
    }
    if (control.dataset.action === "cancel-sale-viewing-edit") {
      editingViewingId = "";
      renderViewingHistory(viewingHistory);
    }
    if (control.dataset.action === "save-sale-viewing") saveViewingHistoryEdit(control);
    if (control.dataset.assistantMode) switchMode(control.dataset.assistantMode);
  });

  document.querySelector("#sales-assistant-modal")?.addEventListener("mousedown", (event) => {
    if (event.target.id === "sales-assistant-modal") closeAssistant();
  });
  document.querySelector("#sale-appointment-parse")?.addEventListener("click", parseAppointment);
  document.querySelector("#sale-appointment-reset")?.addEventListener("click", resetAppointment);
  document.querySelector("#sale-appointment-form")?.addEventListener("submit", saveAppointment);
  document.querySelector("#sale-appointment-form")?.addEventListener("input", updateAppointmentTimeLabel);
  document.querySelector("#sale-appointment-input")?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") parseAppointment();
  });
  document.querySelector("#sales-history-refresh")?.addEventListener("click", () => {
    editingViewingId = "";
    loadViewingHistory({ force: true });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editingViewingId) {
      editingViewingId = "";
      renderViewingHistory(viewingHistory);
      return;
    }
    if (event.key === "Escape" && !document.querySelector("#sales-assistant-modal")?.hidden) closeAssistant();
  });

  await import("./room-summary.js?v=joy-room-summary-v1");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSalesAssistant, { once: true });
} else {
  initializeSalesAssistant();
}
