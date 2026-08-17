import { saleText, translateSaleUiRoot } from "../shared/i18n.js";

const HISTORY_STATE_REFRESH_MS = 15 * 1000;
const MODE_TITLES = Object.freeze({
  appointment: ["saleAssistant.appointmentTitle", "Hẹn khách xem phòng"],
  summary: ["saleAssistant.summaryTitle", "Tóm tắt thông tin phòng"],
  history: ["saleAssistant.historyTitle", "Lịch sử hẹn khách"],
});

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

function createAssistantModal() {
  if (!document.querySelector("#sales-assistant-modal")) {
    document.body.insertAdjacentHTML("beforeend", ASSISTANT_HTML);
  }
  return document.querySelector("#sales-assistant-modal");
}

function visibleModalExists() {
  return [...document.querySelectorAll(".modal-backdrop")].some((modal) => !modal.hidden);
}

function historyEditInProgress() {
  return Boolean(document.querySelector(".sales-history-edit-row"));
}

function requestHistoryLeave() {
  if (!historyEditInProgress()) return true;
  const event = new CustomEvent("joy:sale-history-leave-request", { cancelable: true });
  window.dispatchEvent(event);
  return !event.defaultPrevented && !historyEditInProgress();
}

function requestHistoryLoad({ force = false } = {}) {
  window.dispatchEvent(new CustomEvent("joy:sale-history-open", { detail: { force } }));
}

function updateAssistantTitle(mode) {
  const [key, fallback] = MODE_TITLES[mode] || MODE_TITLES.appointment;
  const title = document.querySelector("#sales-assistant-title");
  if (!title) return;
  title.textContent = saleText(key, fallback);
}

export function installAssistantView({ isAppointmentSaving = () => false } = {}) {
  const modal = createAssistantModal();
  if (!modal || modal.dataset.saleAssistantViewInstalled === "true") return;
  modal.dataset.saleAssistantViewInstalled = "true";
  translateSaleUiRoot(modal);

  const closeAssistant = () => {
    if (isAppointmentSaving()) return false;
    if (!requestHistoryLeave()) return false;
    modal.hidden = true;
    if (!visibleModalExists()) document.body.classList.remove("modal-open");
    return true;
  };

  const openAssistant = () => {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    const activeMode = document.querySelector("[data-assistant-mode].active")?.dataset.assistantMode;
    if (activeMode === "history") requestHistoryLoad({ force: true });
    window.setTimeout(() => document.querySelector("#sale-appointment-input")?.focus(), 0);
  };

  const switchMode = (mode) => {
    const currentMode = document.querySelector("[data-assistant-mode].active")?.dataset.assistantMode || "";
    if (currentMode === mode) return true;
    if (currentMode === "appointment" && isAppointmentSaving()) return false;
    if (currentMode === "history" && !requestHistoryLeave()) return false;

    document.querySelectorAll("[data-assistant-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.assistantMode === mode);
    });
    document.querySelectorAll("[data-assistant-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.assistantPanel !== mode;
    });
    updateAssistantTitle(mode);
    if (mode === "history") requestHistoryLoad({ force: true });
    return true;
  };

  document.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-action], [data-assistant-mode]");
    if (!control) return;
    if (control.dataset.action === "open-sales-assistant") {
      openAssistant();
      return;
    }
    if (control.dataset.action === "close-sales-assistant") {
      if (!closeAssistant()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    if (control.dataset.assistantMode && !switchMode(control.dataset.assistantMode)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  modal.addEventListener("click", (event) => {
    if (event.target !== modal) return;
    if (!closeAssistant()) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (document.querySelector("#sale-close-deal-modal")?.hidden === false) return;
    if (document.querySelector("#room-summary-capture")?.hidden === false) return;
    if (historyEditInProgress()) return;
    if (!modal.hidden && !closeAssistant()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });

  const translate = () => {
    const mode = document.querySelector("[data-assistant-mode].active")?.dataset.assistantMode || "appointment";
    updateAssistantTitle(mode);
    translateSaleUiRoot(modal);
  };
  window.addEventListener("joy:i18n-ready", translate);
  window.addEventListener("joy:locale-changed", translate);

  window.setInterval(() => {
    const panel = document.querySelector('[data-assistant-panel="history"]');
    if (modal.hidden !== false || panel?.hidden !== false || historyEditInProgress()) return;
    requestHistoryLoad();
  }, HISTORY_STATE_REFRESH_MS);
}
