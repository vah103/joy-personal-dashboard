import {
  formatVietnamViewingTime,
  parseSaleAppointmentInput,
} from "../appointments/appointment.js";
import {
  formatVnd,
  vietnamDatetimeLocal,
  vietnamLocalToIso,
  vietnamMonthKey,
} from "../shared/format.js";

const DEALS_ENDPOINT = "/api/sales/deals";

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
              <strong id="sales-history-count">Đang tải…</strong>
              <span class="sales-history-edit-hint" id="sales-history-edit-hint"></span>
            </div>
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

function translateRoot(root) {
  if (root) window.JoyI18n?.translateRoot?.(root);
}

function decorateDashboardSaleCard() {
  const salesPanel = document.querySelector("#sales");
  const heading = salesPanel?.querySelector(".panel-heading");
  const salesBody = salesPanel?.querySelector(".sales-body");
  const upcoming = salesBody?.querySelector(".sales-summary");
  if (!salesPanel || !heading || !salesBody || !upcoming) return false;

  const titleButton = heading.querySelector(".panel-title-button");
  if (titleButton) {
    const wrapper = document.createElement("div");
    const title = titleButton.querySelector("h2");
    if (title) wrapper.append(title);
    titleButton.replaceWith(wrapper);
  }

  let actions = heading.querySelector(".sales-heading-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "sales-heading-actions";
    heading.append(actions);
  }

  let assistant = actions.querySelector('[data-action="open-sales-assistant"]');
  if (!assistant) {
    assistant = document.createElement("button");
    assistant.type = "button";
    assistant.className = "quiet-link sales-assistant-heading-button";
    assistant.dataset.action = "open-sales-assistant";
    actions.prepend(assistant);
  }
  assistant.textContent = "Sale Assistant";

  const managerButtons = [...heading.querySelectorAll('[data-action="open-sale-manager"]')];
  const manager = managerButtons.at(-1);
  managerButtons.slice(0, -1).forEach((button) => button.remove());
  if (manager) {
    manager.textContent = "Sale Manager";
    actions.append(manager);
  }

  if (!salesBody.querySelector(".sales-dashboard-overview")) {
    const overview = document.createElement("div");
    overview.className = "sales-dashboard-overview";
    upcoming.before(overview);
    overview.append(upcoming);

    const commission = document.createElement("div");
    commission.className = "sales-summary sales-dashboard-commission";
    const label = document.createElement("p");
    label.className = "subheading";
    label.textContent = "Commission";
    const value = document.createElement("strong");
    value.id = "sales-commission";
    value.textContent = "—";
    commission.append(label, value);
    overview.append(commission);
  }

  translateRoot(salesPanel);
  return true;
}

async function loadDashboardCommission() {
  const target = document.querySelector("#sales-commission");
  if (!target) return;
  try {
    const response = await fetch(DEALS_ENDPOINT, { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "SALE_DEALS_LOAD_FAILED");
    const month = (Array.isArray(payload.months) ? payload.months : [])
      .find((item) => item?.key === vietnamMonthKey());
    target.textContent = formatVnd(month?.total || 0);
  } catch {
    target.textContent = "—";
  }
}

function refreshDashboardViewings() {
  if (typeof window.fetchCloudSales === "function") {
    void window.fetchCloudSales({ silent: true });
  }
}

function createAssistantModal() {
  if (!document.querySelector("#sales-assistant-modal")) {
    document.body.insertAdjacentHTML("beforeend", ASSISTANT_HTML);
  }
}

function visibleModalExists() {
  return [...document.querySelectorAll(".modal-backdrop")].some((modal) => !modal.hidden);
}

function requestHistoryLoad({ force = false } = {}) {
  window.dispatchEvent(new CustomEvent("joy:sale-history-open", { detail: { force } }));
}

function openAssistant() {
  const modal = document.querySelector("#sales-assistant-modal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  const activeMode = document.querySelector("[data-assistant-mode].active")?.dataset.assistantMode;
  if (activeMode === "history") requestHistoryLoad({ force: true });
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
  if (mode === "history") requestHistoryLoad({ force: true });
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
    showAppointmentStatus(`${result.message} ${result.viewing.customerName} · ${formatVietnamViewingTime(result.viewing.viewingAt)}.`, "success");
    window.dispatchEvent(new CustomEvent("joy:sales-changed", { detail: { kind: "viewing-created" } }));
    window.setTimeout(resetAppointment, 1200);
  } catch (error) {
    showAppointmentStatus(appointmentErrorMessage(error.code), "error");
    save.disabled = false;
  }
}

async function initializeSalesAssistant() {
  if (!decorateDashboardSaleCard()) return;
  createAssistantModal();
  translateRoot(document.querySelector("#sales-assistant-modal"));
  void loadDashboardCommission();

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action], [data-assistant-mode]");
    if (!control) return;
    if (control.dataset.action === "open-sales-assistant") openAssistant();
    if (control.dataset.action === "close-sales-assistant") closeAssistant();
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

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (document.querySelector("#sale-close-deal-modal")?.hidden === false) return;
    if (document.querySelector(".sales-history-edit-row")) return;
    if (!document.querySelector("#sales-assistant-modal")?.hidden) closeAssistant();
  }, { capture: true });

  window.addEventListener("joy:sale-deal-saved", () => void loadDashboardCommission());
  window.addEventListener("joy:sales-changed", refreshDashboardViewings);
  window.addEventListener("joy:i18n-ready", () => {
    decorateDashboardSaleCard();
    translateRoot(document.querySelector("#sales-assistant-modal"));
  });
  window.addEventListener("joy:locale-changed", () => {
    decorateDashboardSaleCard();
    translateRoot(document.querySelector("#sales-assistant-modal"));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadDashboardCommission();
  });

  await import("../room-summary/room-summary.js?v=joy-room-summary-v1");
  window.dispatchEvent(new CustomEvent("joy:sale-assistant-ready"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSalesAssistant, { once: true });
} else {
  initializeSalesAssistant();
}
