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

export function createAssistantLaunchers(doc = document) {
  const salesPanel = doc.querySelector("#sales");
  const heading = salesPanel?.querySelector(".panel-heading");
  const salesBody = salesPanel?.querySelector(".sales-body");
  const salesSummary = salesPanel?.querySelector(".sales-summary");
  if (!salesPanel || !heading || !salesBody || !salesSummary) return false;

  const manageButton = heading.querySelector('[data-action="open-sale-manager"]:last-child');
  if (manageButton && !heading.querySelector(".sales-heading-actions")) {
    const actions = doc.createElement("div");
    actions.className = "sales-heading-actions";
    const assistantButton = doc.createElement("button");
    assistantButton.type = "button";
    assistantButton.className = "quiet-link sales-assistant-heading-button";
    assistantButton.dataset.action = "open-sales-assistant";
    assistantButton.textContent = "Assistant";
    manageButton.before(actions);
    actions.append(assistantButton, manageButton);
  }

  if (!salesBody.querySelector(".sales-assistant-launch")) {
    const launch = doc.createElement("button");
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

export function createAssistantModal(doc = document) {
  if (!doc.querySelector("#sales-assistant-modal")) {
    doc.body.insertAdjacentHTML("beforeend", ASSISTANT_HTML);
  }
}

function visibleModalExists(doc = document) {
  return [...doc.querySelectorAll(".modal-backdrop")].some((modal) => !modal.hidden);
}

export function openAssistant(doc = document) {
  const modal = doc.querySelector("#sales-assistant-modal");
  if (!modal) return;
  modal.hidden = false;
  doc.body.classList.add("modal-open");
  window.setTimeout(() => doc.querySelector("#sale-appointment-input")?.focus(), 0);
}

export function closeAssistant(doc = document) {
  const modal = doc.querySelector("#sales-assistant-modal");
  if (!modal) return;
  modal.hidden = true;
  if (!visibleModalExists(doc)) doc.body.classList.remove("modal-open");
}

export function switchAssistantMode(mode, onHistory, doc = document) {
  doc.querySelectorAll("[data-assistant-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.assistantMode === mode);
  });
  doc.querySelectorAll("[data-assistant-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.assistantPanel !== mode;
  });
  const title = doc.querySelector("#sales-assistant-title");
  const titles = {
    appointment: "Hẹn khách xem phòng",
    summary: "Tóm tắt thông tin phòng",
    history: "Lịch sử hẹn khách",
  };
  if (title) title.textContent = titles[mode] || titles.appointment;
  if (mode === "history") onHistory?.();
}
