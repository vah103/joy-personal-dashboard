(() => {
  "use strict";

  const STORAGE_KEY = "joy.finance.p1008.v1";
  const MONTHS = [
    { key: "2026-07", label: "Tháng 7/2026", shortLabel: "Tháng 7" },
    { key: "2026-08", label: "Tháng 8/2026", shortLabel: "Tháng 8" },
    { key: "2026-09", label: "Tháng 9/2026", shortLabel: "Tháng 9" },
    { key: "2026-10", label: "Tháng 10/2026", shortLabel: "Tháng 10" },
    { key: "2026-11", label: "Tháng 11/2026", shortLabel: "Tháng 11" },
    { key: "2026-12", label: "Tháng 12/2026", shortLabel: "Tháng 12" },
  ];
  const PEOPLE = ["A Mạnh", "A Cường", "Vanh", "Dương", "Hưng", "Trung"];
  const SERVICES = [
    { id: "apartment", label: "Dịch vụ căn hộ", julyIncludesTrung: true },
    { id: "electricity", label: "Điện", julyIncludesTrung: false },
    { id: "water", label: "Nước sinh hoạt", julyIncludesTrung: false },
    { id: "parking", label: "Phí gửi xe", julyIncludesTrung: true },
    { id: "wifi", label: "Wi‑Fi", julyIncludesTrung: false },
  ];

  let selectedMonth = defaultMonth();

  function defaultMonth() {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return MONTHS.some((month) => month.key === key) ? key : MONTHS[0].key;
  }

  function installP1008() {
    const workspace = document.querySelector("#finance-workspace");
    const tabs = workspace?.querySelector(".finance-tabs");
    if (!workspace || !tabs) return false;
    if (tabs.querySelector('[data-finance-p1008]')) return true;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.financeP1008 = "true";
    button.textContent = "P1008";
    button.addEventListener("click", renderP1008View);
    tabs.append(button);
    return true;
  }

  function renderP1008View() {
    const workspace = document.querySelector("#finance-workspace");
    const content = document.querySelector("#finance-workspace-content");
    if (!workspace || !content) return;

    workspace.classList.remove("finance-month-layout-active");
    workspace.querySelectorAll(".finance-tabs button").forEach((button) => {
      button.classList.toggle("active", button.hasAttribute("data-finance-p1008"));
    });

    const month = MONTHS.find((item) => item.key === selectedMonth) || MONTHS[0];
    const amounts = readMonthAmounts(selectedMonth);
    const split = calculateSplit(selectedMonth, amounts);
    const serviceTotal = SERVICES.reduce((sum, service) => sum + amounts[service.id], 0);
    const vanhTotal = split.people.Vanh.total;

    content.className = "finance-workspace-content p1008-view";
    content.innerHTML = `
      <section class="p1008-hero" aria-labelledby="p1008-title">
        <div>
          <p class="p1008-kicker">Phòng P1008</p>
          <h2 id="p1008-title">Chia tiền nhà</h2>
          <p>Tiền dịch vụ được chia tự động cho 6 thành viên theo quy tắc của từng tháng.</p>
        </div>
        <label class="p1008-month-picker">
          <span>Tháng theo dõi</span>
          <select data-p1008-month>
            ${MONTHS.map((item) => `<option value="${item.key}"${item.key === selectedMonth ? " selected" : ""}>${item.label}</option>`).join("")}
          </select>
        </label>
      </section>

      <div class="p1008-summary" aria-label="Tóm tắt tiền phòng ${month.label}">
        <article><span>Tổng dịch vụ</span><strong>${formatVnd(serviceTotal)}</strong><small>5 khoản trong tháng</small></article>
        <article class="is-primary"><span>Phần của Vanh</span><strong>${formatVnd(vanhTotal)}</strong><small>Tự tính theo bảng chia</small></article>
        <article><span>Thành viên</span><strong>6 người</strong><small>A Mạnh · A Cường · Vanh · Dương · Hưng · Trung</small></article>
      </div>

      ${selectedMonth === "2026-07" ? `
        <aside class="p1008-rule-note">
          <strong>Quy tắc riêng tháng 7</strong>
          <span>Trung chỉ đóng Dịch vụ căn hộ và Phí gửi xe. Điện, Nước sinh hoạt và Wi‑Fi chia đều cho 5 người còn lại.</span>
        </aside>
      ` : `
        <aside class="p1008-rule-note is-standard">
          <strong>Chia đều ${month.shortLabel}</strong>
          <span>Cả 5 khoản dịch vụ được chia đều cho đủ 6 thành viên.</span>
        </aside>
      `}

      <section class="p1008-card">
        <header>
          <div><p>Bảng 1</p><h3>Chia tiền dịch vụ</h3></div>
          <span class="p1008-local-state">Lưu trên thiết bị này</span>
        </header>
        <div class="p1008-table-wrap">
          <table class="p1008-services-table">
            <thead><tr><th>Hạng mục</th><th>Tổng tiền</th><th>Chia cho</th><th>Mỗi người</th></tr></thead>
            <tbody>
              ${SERVICES.map((service) => renderServiceRow(service, selectedMonth, amounts, split)).join("")}
            </tbody>
            <tfoot><tr><th>Tổng dịch vụ</th><td>${formatVnd(serviceTotal)}</td><td colspan="2">Bảng bên dưới là số tiền chính xác của từng người</td></tr></tfoot>
          </table>
        </div>
      </section>

      <section class="p1008-card">
        <header>
          <div><p>Bảng 2</p><h3>Số tiền từng người phải đóng</h3></div>
          <span>${month.label}</span>
        </header>
        <div class="p1008-table-wrap">
          <table class="p1008-people-table">
            <thead>
              <tr><th>Thành viên</th>${SERVICES.map((service) => `<th>${service.label}</th>`).join("")}<th>Tổng đóng</th></tr>
            </thead>
            <tbody>
              ${PEOPLE.map((person) => renderPersonRow(person, split)).join("")}
            </tbody>
            <tfoot><tr><th colspan="6">Tổng đã phân bổ</th><td>${formatVnd(split.allocatedTotal)}</td></tr></tfoot>
          </table>
        </div>
      </section>

      <section class="p1008-card p1008-shopping-card" aria-labelledby="p1008-shopping-title">
        <header>
          <div><p>Bảng 3</p><h3 id="p1008-shopping-title">Chia tiền mua sắm</h3></div>
          <span class="p1008-pending-pill">Chờ cập nhật</span>
        </header>
        <div class="p1008-shopping-empty">
          <span aria-hidden="true">15</span>
          <div><strong>Chưa nhập dữ liệu mua sắm</strong><p>Khoản mua sắm được chốt vào ngày 15 hằng tháng. Bảng chi tiết sẽ được bổ sung sau.</p></div>
        </div>
      </section>
    `;

    bindP1008Events(content);
  }

  function renderServiceRow(service, monthKey, amounts) {
    const eligible = eligiblePeople(service, monthKey);
    const amount = amounts[service.id];
    const average = eligible.length ? Math.round(amount / eligible.length) : 0;
    return `
      <tr>
        <th><strong>${service.label}</strong><small>${monthKey === "2026-07" && !service.julyIncludesTrung ? "Không tính Trung trong tháng 7" : "Chia đều theo tháng"}</small></th>
        <td>
          <label class="p1008-amount-field">
            <input type="text" inputmode="numeric" autocomplete="off" data-p1008-service="${service.id}" value="${amount ? formatNumber(amount) : ""}" placeholder="0">
            <span>₫</span>
          </label>
        </td>
        <td><strong>${eligible.length} người</strong><small>${eligible.join(" · ")}</small></td>
        <td><strong>${formatVnd(average)}</strong><small>${amount ? "xấp xỉ, chênh tối đa 1 ₫" : "chưa có số tiền"}</small></td>
      </tr>
    `;
  }

  function renderPersonRow(person, split) {
    const personSplit = split.people[person];
    return `
      <tr class="${person === "Vanh" ? "is-vanh" : ""}">
        <th><strong>${person}</strong>${person === "Vanh" ? "<small>Bạn</small>" : ""}</th>
        ${SERVICES.map((service) => {
          const value = personSplit.services[service.id];
          return `<td>${value === null ? '<span class="p1008-not-applicable">—</span>' : formatVnd(value)}</td>`;
        }).join("")}
        <td><strong>${formatVnd(personSplit.total)}</strong></td>
      </tr>
    `;
  }

  function bindP1008Events(content) {
    content.querySelector("[data-p1008-month]")?.addEventListener("change", (event) => {
      selectedMonth = event.currentTarget.value;
      renderP1008View();
    });

    content.querySelectorAll("[data-p1008-service]").forEach((input) => {
      input.addEventListener("focus", () => input.select());
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      input.addEventListener("blur", () => {
        const amount = parseAmount(input.value);
        const data = readData();
        data[selectedMonth] = { ...emptyAmounts(), ...(data[selectedMonth] || {}), [input.dataset.p1008Service]: amount };
        writeData(data);
        renderP1008View();
      });
    });
  }

  function calculateSplit(monthKey, amounts) {
    const people = Object.fromEntries(PEOPLE.map((person) => [person, {
      services: Object.fromEntries(SERVICES.map((service) => [service.id, null])),
      total: 0,
    }]));
    let allocatedTotal = 0;

    for (const service of SERVICES) {
      const amount = amounts[service.id];
      const eligible = eligiblePeople(service, monthKey);
      const base = Math.floor(amount / eligible.length);
      let remainder = amount % eligible.length;

      eligible.forEach((person) => {
        const share = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        people[person].services[service.id] = share;
        people[person].total += share;
        allocatedTotal += share;
      });
    }

    return { people, allocatedTotal };
  }

  function eligiblePeople(service, monthKey) {
    if (monthKey === "2026-07" && !service.julyIncludesTrung) {
      return PEOPLE.filter((person) => person !== "Trung");
    }
    return [...PEOPLE];
  }

  function emptyAmounts() {
    return Object.fromEntries(SERVICES.map((service) => [service.id, 0]));
  }

  function readMonthAmounts(monthKey) {
    return { ...emptyAmounts(), ...(readData()[monthKey] || {}) };
  }

  function readData() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function writeData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // The calculator still works for the current session when storage is unavailable.
    }
  }

  function parseAmount(value) {
    const text = String(value || "").trim();
    if (!text) return 0;
    const plainDigits = /^[0-9]+$/.test(text);
    const groupedDigits = /^[0-9]{1,3}(?:[.,\s][0-9]{3})+$/.test(text);
    if (!plainDigits && !groupedDigits) return 0;
    const amount = Number(text.replace(/[^0-9]/g, ""));
    if (!Number.isSafeInteger(amount) || amount < 0) return 0;
    return plainDigits && amount > 0 && amount <= 9_999 ? amount * 1_000 : amount;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  function formatVnd(value) {
    return `${formatNumber(value)} ₫`;
  }

  if (!installP1008()) {
    window.addEventListener("DOMContentLoaded", installP1008, { once: true });
  }
})();
