(() => {
  "use strict";

  const STORAGE_KEY = "joy.finance.p1008.v1";
  const API_PATH = "/api/p1008";
  const CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
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
    { id: "apartment", labelKey: "p1008.apartmentService", label: "Dịch vụ căn hộ", julyIncludesTrung: true },
    { id: "electricity", labelKey: "p1008.electricityService", label: "Điện", julyIncludesTrung: false },
    { id: "water", labelKey: "p1008.waterService", label: "Nước sinh hoạt", julyIncludesTrung: false },
    { id: "parking", labelKey: "p1008.parkingService", label: "Phí gửi xe", julyIncludesTrung: true },
    { id: "wifi", labelKey: "p1008.wifiService", label: "Wi‑Fi", julyIncludesTrung: false },
  ];

  let selectedMonth = defaultMonth();
  let syncState = CLOUD_BACKEND ? "loading" : "local";
  let cloudLoadPromise = null;
  let cloudSaveChain = Promise.resolve();
  let localMutationVersion = 0;

  function i18n() {
    return window.JoyI18n || null;
  }

  function tr(key, values = {}, fallback = "") {
    return i18n()?.t?.(key, values) || fallback || key;
  }

  function currentLocale() {
    return i18n()?.getLocale?.() || "vi";
  }

  function displayMonth(month, { short = false } = {}) {
    if (!month) return "";
    if (currentLocale() !== "en") return short ? month.shortLabel : month.label;
    const date = new Date(`${month.key}-01T12:00:00+07:00`);
    return i18n()?.formatDate?.(date, {
      timeZone: "Asia/Ho_Chi_Minh",
      month: "long",
      ...(short ? {} : { year: "numeric" }),
    }) || (short ? month.shortLabel : month.label);
  }

  function serviceLabel(service) {
    return tr(service.labelKey, {}, service.label);
  }

  function defaultMonth() {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return MONTHS.some((month) => month.key === key) ? key : MONTHS[0].key;
  }

  function installP1008() {
    const workspace = document.querySelector("#finance-workspace");
    const tabs = workspace?.querySelector(".finance-tabs");
    if (!workspace || !tabs) return false;
    if (tabs.querySelector("[data-finance-p1008]")) return true;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.financeP1008 = "true";
    button.textContent = "P1008";
    button.addEventListener("click", () => {
      renderP1008View();
      void refreshCloudData();
    });
    tabs.append(button);
    return true;
  }

  function syncLabel() {
    if (syncState === "loading") return tr("p1008.syncLoading", {}, "Đang tải từ tài khoản…");
    if (syncState === "syncing") return tr("p1008.syncing", {}, "Đang đồng bộ…");
    if (syncState === "synced") return tr("p1008.synced", {}, "Đã đồng bộ tài khoản");
    if (syncState === "offline") return tr("p1008.syncOffline", {}, "Chưa đồng bộ · lưu tạm trên máy");
    return tr("p1008.syncLocal", {}, "Lưu trên thiết bị này");
  }

  function setSyncState(state) {
    syncState = state;
    const badge = document.querySelector(".p1008-local-state");
    if (!badge) return;
    badge.dataset.syncState = state;
    badge.textContent = syncLabel();
  }

  function isP1008Visible() {
    return document.querySelector("#finance-workspace-content")?.classList.contains("p1008-view");
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
    const monthLabel = displayMonth(month);
    const amounts = readMonthAmounts(selectedMonth);
    const split = calculateSplit(selectedMonth, amounts);
    const serviceTotal = SERVICES.reduce((sum, service) => sum + amounts[service.id], 0);
    const vanhTotal = split.people.Vanh.total;

    content.className = "finance-workspace-content p1008-view";
    content.innerHTML = `
      <section class="p1008-hero" aria-labelledby="p1008-title">
        <div>
          <p class="p1008-kicker">${tr("p1008.room", {}, "Phòng P1008")}</p>
          <h2 id="p1008-title">${tr("p1008.splitRent", {}, "Chia tiền nhà")}</h2>
          <p>${tr("p1008.description", {}, "Tiền dịch vụ được chia tự động cho 6 thành viên theo quy tắc của từng tháng.")}</p>
        </div>
        <label class="p1008-month-picker">
          <span>${tr("p1008.trackingMonth", {}, "Tháng theo dõi")}</span>
          <select data-p1008-month>
            ${MONTHS.map((item) => `<option value="${item.key}"${item.key === selectedMonth ? " selected" : ""}>${displayMonth(item)}</option>`).join("")}
          </select>
        </label>
      </section>

      <div class="p1008-summary" aria-label="${tr("p1008.summaryAria", { month: monthLabel }, `Tóm tắt tiền phòng ${monthLabel}`)}">
        <article><span>${tr("p1008.totalServices", {}, "Tổng dịch vụ")}</span><strong>${formatVnd(serviceTotal)}</strong><small>${tr("p1008.fiveMonthlyItems", {}, "5 khoản trong tháng")}</small></article>
        <article class="is-primary"><span>${tr("p1008.vanhShare", {}, "Phần của Vanh")}</span><strong>${formatVnd(vanhTotal)}</strong><small>${tr("p1008.autoCalculated", {}, "Tự tính theo bảng chia")}</small></article>
        <article><span>${tr("p1008.members", {}, "Thành viên")}</span><strong>${tr("p1008.sixPeople", {}, "6 người")}</strong><small>A Mạnh · A Cường · Vanh · Dương · Hưng · Trung</small></article>
      </div>

      ${selectedMonth === "2026-07" ? `
        <aside class="p1008-rule-note">
          <strong>${tr("p1008.julyRule", {}, "Quy tắc riêng tháng 7")}</strong>
          <span>${tr("p1008.julyRuleHelp", {}, "Trung chỉ đóng Dịch vụ căn hộ và Phí gửi xe. Điện, Nước sinh hoạt và Wi‑Fi chia đều cho 5 người còn lại.")}</span>
        </aside>
      ` : `
        <aside class="p1008-rule-note is-standard">
          <strong>${tr("p1008.standardSplit", { month: displayMonth(month, { short: true }) }, `Chia đều ${month.shortLabel}`)}</strong>
          <span>${tr("p1008.standardSplitHelp", {}, "Cả 5 khoản dịch vụ được chia đều cho đủ 6 thành viên.")}</span>
        </aside>
      `}

      <section class="p1008-card p1008-services-card">
        <header>
          <h3>${tr("p1008.services", {}, "Tiền dịch vụ")}</h3>
          <span class="p1008-local-state" data-sync-state="${syncState}">${syncLabel()}</span>
        </header>
        <div class="p1008-table-wrap">
          <table class="p1008-services-table">
            <thead><tr><th>${tr("p1008.category", {}, "Hạng mục")}</th><th>${tr("p1008.money", {}, "Tiền")}</th><th>${tr("p1008.splitAmong", {}, "Chia cho")}</th><th>${tr("p1008.perPerson", {}, "Mỗi người")}</th></tr></thead>
            <tbody>
              ${SERVICES.map((service) => renderServiceRow(service, selectedMonth, amounts)).join("")}
            </tbody>
            <tfoot><tr><th>${tr("p1008.total", {}, "Tổng")}</th><td>${formatVnd(serviceTotal)}</td><td></td><td></td></tr></tfoot>
          </table>
        </div>
      </section>

      <section class="p1008-card">
        <header>
          <div><p>${tr("p1008.table2", {}, "Bảng 2")}</p><h3>${tr("p1008.amountEachPerson", {}, "Số tiền từng người phải đóng")}</h3></div>
          <span>${monthLabel}</span>
        </header>
        <div class="p1008-table-wrap">
          <table class="p1008-people-table">
            <thead>
              <tr><th>${tr("p1008.members", {}, "Thành viên")}</th>${SERVICES.map((service) => `<th>${serviceLabel(service)}</th>`).join("")}<th>${tr("p1008.totalContribution", {}, "Tổng đóng")}</th></tr>
            </thead>
            <tbody>
              ${PEOPLE.map((person) => renderPersonRow(person, split)).join("")}
            </tbody>
            <tfoot><tr><th colspan="6">${tr("p1008.totalAllocated", {}, "Tổng đã phân bổ")}</th><td>${formatVnd(split.allocatedTotal)}</td></tr></tfoot>
          </table>
        </div>
      </section>

      <section class="p1008-card p1008-shopping-card" aria-labelledby="p1008-shopping-title">
        <header>
          <div><p>${tr("p1008.table3", {}, "Bảng 3")}</p><h3 id="p1008-shopping-title">${tr("p1008.shoppingSplit", {}, "Chia tiền mua sắm")}</h3></div>
          <span class="p1008-pending-pill">${tr("p1008.pendingUpdate", {}, "Chờ cập nhật")}</span>
        </header>
        <div class="p1008-shopping-empty">
          <span aria-hidden="true">15</span>
          <div><strong>${tr("p1008.noShopping", {}, "Chưa nhập dữ liệu mua sắm")}</strong><p>${tr("p1008.shoppingDeadline", {}, "Khoản mua sắm được chốt vào ngày 15 hằng tháng. Bảng chi tiết sẽ được bổ sung sau.")}</p></div>
        </div>
      </section>
    `;

    bindP1008Events(content);
    workspace.dispatchEvent(new CustomEvent("joy:p1008-rendered"));
  }

  function renderServiceRow(service, monthKey, amounts) {
    const eligible = eligiblePeople(service, monthKey);
    const amount = amounts[service.id];
    const average = eligible.length ? Math.round(amount / eligible.length) : 0;

    return `
      <tr>
        <th>${serviceLabel(service)}</th>
        <td>
          <label class="p1008-amount-field">
            <input type="text" inputmode="numeric" autocomplete="off" data-p1008-service="${service.id}" value="${amount ? formatNumber(amount) : ""}" placeholder="0">
            <span>₫</span>
          </label>
        </td>
        <td class="p1008-share-count">${eligible.length}</td>
        <td class="p1008-per-person">${formatVnd(average)}</td>
      </tr>
    `;
  }

  function renderPersonRow(person, split) {
    const personSplit = split.people[person];
    return `
      <tr class="${person === "Vanh" ? "is-vanh" : ""}">
        <th><strong>${person}</strong>${person === "Vanh" ? `<small>${tr("p1008.you", {}, "Bạn")}</small>` : ""}</th>
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
      input.addEventListener("input", () => formatMoneyInput(input));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      input.addEventListener("blur", () => {
        const amount = parseAmount(input.value);
        const data = readData();
        data[selectedMonth] = {
          ...emptyAmounts(),
          ...(data[selectedMonth] || {}),
          [input.dataset.p1008Service]: amount,
        };
        persistData(data);
      });
    });
  }

  function formatMoneyInput(input) {
    const digits = String(input.value || "").replace(/\D/g, "");
    if (!digits) {
      input.value = "";
      return;
    }

    const amount = Number(digits);
    input.value = Number.isSafeInteger(amount) ? formatNumber(amount) : "";
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

  function normalizeData(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};

    const normalized = {};
    for (const month of MONTHS) {
      const source = input[month.key];
      if (!source || typeof source !== "object" || Array.isArray(source)) continue;
      normalized[month.key] = Object.fromEntries(SERVICES.map((service) => [
        service.id,
        parseAmount(source[service.id]),
      ]));
    }
    return normalized;
  }

  function mergeCloudWithLocal(cloudData, localData) {
    return normalizeData({ ...normalizeData(localData), ...normalizeData(cloudData) });
  }

  function dataMatches(left, right) {
    return JSON.stringify(normalizeData(left)) === JSON.stringify(normalizeData(right));
  }

  function readMonthAmounts(monthKey) {
    return { ...emptyAmounts(), ...(readData()[monthKey] || {}) };
  }

  function readData() {
    try {
      return normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch {
      return {};
    }
  }

  function writeLocalData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
    } catch {
      // The calculator still works for the current session when storage is unavailable.
    }
  }

  function persistData(data) {
    writeLocalData(data);
    localMutationVersion += 1;
    setSyncState(CLOUD_BACKEND ? "syncing" : "local");
    renderP1008View();
    if (CLOUD_BACKEND) void queueCloudSave(readData()).catch(() => {});
  }

  async function cloudRequest(options = {}) {
    const response = await fetch(API_PATH, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) window.location.replace("/login");
    if (!response.ok) throw new Error(payload.error || `P1008_REQUEST_${response.status}`);
    return payload;
  }

  function queueCloudSave(data) {
    if (!CLOUD_BACKEND) return Promise.resolve(null);

    const snapshot = normalizeData(data);
    const mutationVersion = localMutationVersion;
    setSyncState("syncing");

    const operation = cloudSaveChain
      .catch(() => {})
      .then(() => cloudRequest({
        method: "PUT",
        body: JSON.stringify({ data: snapshot }),
      }))
      .then((payload) => {
        if (mutationVersion === localMutationVersion) setSyncState("synced");
        return payload;
      })
      .catch((error) => {
        if (mutationVersion === localMutationVersion) setSyncState("offline");
        throw error;
      });

    cloudSaveChain = operation;
    return operation;
  }

  function refreshCloudData() {
    if (!CLOUD_BACKEND) return Promise.resolve();
    if (cloudLoadPromise) return cloudLoadPromise;

    const mutationVersion = localMutationVersion;
    const localData = readData();
    setSyncState("loading");

    const operation = cloudRequest()
      .then(async (payload) => {
        if (mutationVersion !== localMutationVersion) {
          await queueCloudSave(readData());
          return;
        }

        const cloudData = normalizeData(payload.data);
        const mergedData = mergeCloudWithLocal(cloudData, localData);
        writeLocalData(mergedData);

        if (!dataMatches(mergedData, cloudData)) {
          await queueCloudSave(mergedData);
        } else {
          setSyncState("synced");
        }

        if (isP1008Visible()) renderP1008View();
      })
      .catch(() => {
        setSyncState("offline");
      })
      .finally(() => {
        if (cloudLoadPromise === operation) cloudLoadPromise = null;
      });

    cloudLoadPromise = operation;
    return operation;
  }

  function parseAmount(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return 0;

    const amount = Number(digits);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
  }

  function formatNumber(value) {
    const amount = Number(value || 0);
    return i18n()?.formatNumber?.(amount, { maximumFractionDigits: 0 })
      || new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);
  }

  function formatVnd(value) {
    return `${formatNumber(value)} ₫`;
  }

  window.addEventListener("focus", () => {
    if (isP1008Visible()) void refreshCloudData();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && isP1008Visible()) renderP1008View();
  });

  window.addEventListener("joy:i18n-ready", () => {
    if (isP1008Visible()) renderP1008View();
  });
  window.addEventListener("joy:locale-changed", () => {
    if (isP1008Visible()) renderP1008View();
  });

  if (!installP1008()) {
    window.addEventListener("DOMContentLoaded", installP1008, { once: true });
  }
})();
