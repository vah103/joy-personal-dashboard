(() => {
  "use strict";

  const STORAGE_KEY = "joy.finance.p1008.shopping.v1";
  const DIRTY_KEY = "joy.finance.p1008.shopping.dirty.v1";
  const API_PATH = "/api/p1008-shopping";
  const CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
  const MONTH_LABELS = {
    "2026-07": "Tháng 7/2026",
    "2026-08": "Tháng 8/2026",
    "2026-09": "Tháng 9/2026",
    "2026-10": "Tháng 10/2026",
    "2026-11": "Tháng 11/2026",
    "2026-12": "Tháng 12/2026",
  };
  const PEOPLE = ["A Mạnh", "A Cường", "Vanh", "Dương", "Hưng", "Trung"];
  const VALID_SPLIT_COUNTS = new Set([4, 5, 6]);

  let syncState = CLOUD_BACKEND ? "loading" : "local";
  let cloudLoadPromise = null;
  let cloudSaveChain = Promise.resolve();
  let localMutationVersion = 0;

  function i18n() {
    return window.JoyI18n || null;
  }

  function tr(key, values = {}, fallback = "") {
    const translated = i18n()?.t?.(key, values);
    return translated && translated !== key ? translated : fallback || key;
  }

  function currentLocale() {
    return i18n()?.getLocale?.() || "vi";
  }

  function displayMonth(monthKey) {
    const fallback = MONTH_LABELS[monthKey] || monthKey;
    if (currentLocale() !== "en") return fallback;
    const date = new Date(`${monthKey}-01T12:00:00+07:00`);
    return i18n()?.formatDate?.(date, {
      timeZone: "Asia/Ho_Chi_Minh",
      month: "long",
      year: "numeric",
    }) || fallback;
  }

  function currentMonthKey() {
    const value = document.querySelector("[data-p1008-month]")?.value;
    return MONTH_LABELS[value] ? value : "2026-08";
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
    const badge = document.querySelector(".p1008-shopping-sync");
    if (!badge) return;
    badge.dataset.syncState = state;
    badge.textContent = syncLabel();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function makeItemId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function parseAmount(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return 0;
    const amount = Number(digits);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
  }

  function formatNumber(value) {
    const amount = Number(value || 0);
    return i18n()?.formatNumber?.(amount, { maximumFractionDigits: 0 })
      || new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);
  }

  function formatVnd(value) {
    return `${formatNumber(value)} ₫`;
  }

  function formatMoneyInput(input) {
    const amount = parseAmount(input.value);
    input.value = amount ? formatNumber(amount) : "";
  }

  function normalizeItem(raw, fallbackIndex = 0) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const name = String(raw.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
    const amount = Number(raw.amount);
    const splitCount = Number(raw.splitCount);
    const sourceId = String(raw.id || "").trim();
    const id = /^[A-Za-z0-9_-]{1,64}$/.test(sourceId)
      ? sourceId
      : `item-${fallbackIndex}-${Math.abs(name.length * 997 + amount)}`;

    if (!name || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000) return null;
    if (!VALID_SPLIT_COUNTS.has(splitCount)) return null;
    return { id, name, amount, splitCount };
  }

  function normalizeData(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const normalized = {};

    for (const monthKey of Object.keys(MONTH_LABELS)) {
      if (!Array.isArray(input[monthKey])) continue;
      const seen = new Set();
      normalized[monthKey] = input[monthKey]
        .slice(0, 100)
        .map((item, index) => normalizeItem(item, index))
        .filter((item) => {
          if (!item || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
    }
    return normalized;
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
      // The shopping calculator remains usable for the current session.
    }
  }

  function isDirty() {
    try {
      return localStorage.getItem(DIRTY_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setDirty(dirty) {
    try {
      if (dirty) localStorage.setItem(DIRTY_KEY, "1");
      else localStorage.removeItem(DIRTY_KEY);
    } catch {
      // Dirty state is best-effort when storage is unavailable.
    }
  }

  function eligiblePeople(splitCount) {
    if (splitCount === 5) return PEOPLE.filter((person) => person !== "Hưng");
    if (splitCount === 4) return PEOPLE.filter((person) => person !== "Hưng" && person !== "A Mạnh");
    return [...PEOPLE];
  }

  function excludedLabel(splitCount) {
    if (splitCount === 5) return tr("p1008.shopping.excludeHung", {}, "Không tính Hưng");
    if (splitCount === 4) return tr("p1008.shopping.excludeHungManh", {}, "Không tính Hưng và A Mạnh");
    return tr("p1008.shopping.allSix", {}, "Đủ 6 người");
  }

  function calculateShoppingSplit(items) {
    const people = Object.fromEntries(PEOPLE.map((person) => [person, 0]));
    let total = 0;

    for (const item of items) {
      total += item.amount;
      const eligible = eligiblePeople(item.splitCount);
      const base = Math.floor(item.amount / eligible.length);
      let remainder = item.amount % eligible.length;

      eligible.forEach((person) => {
        people[person] += base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
      });
    }

    return { total, people, vanhTotal: people.Vanh };
  }

  function splitOptions(selected) {
    return [
      [6, tr("p1008.shopping.split6", {}, "6 người · chia đều tất cả")],
      [5, tr("p1008.shopping.split5", {}, "5 người · không Hưng")],
      [4, tr("p1008.shopping.split4", {}, "4 người · không Hưng, A Mạnh")],
    ].map(([value, label]) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`).join("");
  }

  function renderShoppingRows(items) {
    return items.map((item) => `
      <tr data-shopping-row="${escapeHtml(item.id)}">
        <td>
          <input class="p1008-shopping-name-input" type="text" maxlength="80" value="${escapeHtml(item.name)}" data-shopping-name="${escapeHtml(item.id)}" aria-label="${escapeHtml(tr("p1008.shopping.itemNameAria", { name: item.name }, `Tên món ${item.name}`))}">
        </td>
        <td>
          <label class="p1008-shopping-amount-field">
            <input type="text" inputmode="numeric" autocomplete="off" value="${formatNumber(item.amount)}" data-shopping-amount="${escapeHtml(item.id)}" aria-label="${escapeHtml(tr("p1008.shopping.itemAmountAria", { name: item.name }, `Số tiền ${item.name}`))}">
            <span>₫</span>
          </label>
        </td>
        <td class="p1008-shopping-split-cell">
          <select data-shopping-split="${escapeHtml(item.id)}" aria-label="${escapeHtml(tr("p1008.shopping.itemSplitAria", { name: item.name }, `Số người chia ${item.name}`))}">
            ${splitOptions(item.splitCount)}
          </select>
          <small>${excludedLabel(item.splitCount)}</small>
        </td>
        <td class="p1008-shopping-per-person">${formatVnd(Math.round(item.amount / item.splitCount))}</td>
        <td><button class="p1008-shopping-delete" type="button" data-shopping-delete="${escapeHtml(item.id)}" aria-label="${escapeHtml(tr("p1008.shopping.deleteItemAria", { name: item.name }, `Xóa ${item.name}`))}" title="${tr("p1008.shopping.deleteItem", {}, "Xóa món")}">×</button></td>
      </tr>
    `).join("");
  }

  function renderPeopleTotals(people) {
    return PEOPLE.map((person) => `
      <article class="${person === "Vanh" ? "is-vanh" : ""}">
        <span>${person}</span>
        <strong>${formatVnd(people[person])}</strong>
        ${person === "Vanh" ? `<small>${tr("p1008.you", {}, "Bạn")}</small>` : ""}
      </article>
    `).join("");
  }

  function isP1008Visible() {
    return document.querySelector("#finance-workspace-content")?.classList.contains("p1008-view");
  }

  function enhanceShoppingCard() {
    if (!isP1008Visible()) return;
    const card = document.querySelector(".p1008-shopping-card");
    if (!card) return;

    const monthKey = currentMonthKey();
    const monthLabel = displayMonth(monthKey);
    const items = readData()[monthKey] || [];
    const split = calculateShoppingSplit(items);

    card.setAttribute("aria-labelledby", "p1008-shopping-title");
    card.innerHTML = `
      <header>
        <div><p>${tr("p1008.shopping.kicker", {}, "Mua đồ chung")}</p><h3 id="p1008-shopping-title">${tr("p1008.shopping.title", {}, "Chia tiền mua đồ chung")}</h3></div>
        <div class="p1008-shopping-header-meta">
          <span>${monthLabel}</span>
          <span class="p1008-local-state p1008-shopping-sync" data-sync-state="${syncState}">${syncLabel()}</span>
        </div>
      </header>
      <div class="p1008-shopping-body">
        <aside class="p1008-shopping-rule">
          <strong>${tr("p1008.shopping.ruleTitle", {}, "Quy tắc chia")}</strong>
          <span>${tr("p1008.shopping.ruleHelp", {}, "6 người: chia đều tất cả · 5 người: không tính Hưng · 4 người: không tính Hưng và A Mạnh.")}</span>
          <small>${tr("p1008.shopping.entryHelp", {}, "Nhập theo tháng đóng tiền. Ví dụ khoản chốt ngày 15/8 được lưu trong Tháng 8/2026.")}</small>
        </aside>

        <div class="p1008-shopping-summary" aria-label="${tr("p1008.shopping.title", {}, "Chia tiền mua đồ chung")} · ${monthLabel}">
          <article><span>${tr("p1008.shopping.total", {}, "Tổng mua chung")}</span><strong>${formatVnd(split.total)}</strong></article>
          <article class="is-primary"><span>${tr("p1008.vanhShare", {}, "Phần của Vanh")}</span><strong>${formatVnd(split.vanhTotal)}</strong></article>
          <article><span>${tr("p1008.shopping.itemCount", {}, "Số món")}</span><strong>${items.length}</strong></article>
        </div>

        <form class="p1008-shopping-form" data-shopping-form>
          <label>
            <span>${tr("p1008.shopping.itemName", {}, "Tên món")}</span>
            <input type="text" maxlength="80" autocomplete="off" placeholder="${tr("p1008.shopping.itemExample", {}, "Ví dụ: Nước rửa chén")}" data-shopping-new-name required>
          </label>
          <label>
            <span>${tr("p1008.shopping.amount", {}, "Số tiền")}</span>
            <span class="p1008-shopping-amount-field">
              <input type="text" inputmode="numeric" autocomplete="off" placeholder="0" data-shopping-new-amount required>
              <span>₫</span>
            </span>
          </label>
          <label>
            <span>${tr("p1008.shopping.splitFor", {}, "Chia cho")}</span>
            <select data-shopping-new-split>${splitOptions(6)}</select>
          </label>
          <button type="submit">${tr("p1008.shopping.addItem", {}, "+ Thêm món")}</button>
        </form>

        ${items.length ? `
          <div class="p1008-table-wrap p1008-shopping-table-wrap">
            <table class="p1008-shopping-table">
              <thead><tr><th>${tr("p1008.shopping.purchasedItem", {}, "Món mua")}</th><th>${tr("p1008.money", {}, "Tiền")}</th><th>${tr("p1008.splitAmong", {}, "Chia cho")}</th><th>${tr("p1008.perPerson", {}, "Mỗi người")}</th><th></th></tr></thead>
              <tbody>${renderShoppingRows(items)}</tbody>
              <tfoot><tr><th>${tr("p1008.shopping.total", {}, "Tổng mua chung")}</th><td>${formatVnd(split.total)}</td><td></td><td></td><td></td></tr></tfoot>
            </table>
          </div>
        ` : `
          <div class="p1008-shopping-empty is-ready">
            <span aria-hidden="true">15</span>
            <div><strong>${tr("p1008.shopping.emptyTitle", { month: monthLabel }, `Chưa có món nào trong ${monthLabel}`)}</strong><p>${tr("p1008.shopping.emptyHelp", {}, "Nhập tên món, số tiền và số người chia ở phía trên để bắt đầu.")}</p></div>
          </div>
        `}

        <section class="p1008-shopping-people" aria-labelledby="p1008-shopping-people-title">
          <div><p>${tr("p1008.shopping.personSection", {}, "Phần từng người")}</p><h4 id="p1008-shopping-people-title">${tr("p1008.shopping.personTotal", {}, "Tổng mua chung phải đóng")}</h4></div>
          <div class="p1008-shopping-people-grid">${renderPeopleTotals(split.people)}</div>
        </section>
      </div>
    `;

    bindShoppingEvents(card, monthKey, items);
  }

  function persistMonthItems(monthKey, items) {
    const data = readData();
    data[monthKey] = items;
    persistData(data);
  }

  function persistData(data) {
    writeLocalData(data);
    setDirty(true);
    localMutationVersion += 1;
    setSyncState(CLOUD_BACKEND ? "syncing" : "local");
    enhanceShoppingCard();
    if (CLOUD_BACKEND) void queueCloudSave(readData()).catch(() => {});
  }

  function updateItem(monthKey, items, id, changes) {
    const next = items.map((item) => item.id === id ? { ...item, ...changes } : item);
    persistMonthItems(monthKey, next);
  }

  function bindShoppingEvents(card, monthKey, items) {
    const form = card.querySelector("[data-shopping-form]");
    const newAmount = card.querySelector("[data-shopping-new-amount]");
    newAmount?.addEventListener("input", () => formatMoneyInput(newAmount));

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const nameInput = form.querySelector("[data-shopping-new-name]");
      const amountInput = form.querySelector("[data-shopping-new-amount]");
      const splitInput = form.querySelector("[data-shopping-new-split]");
      const name = String(nameInput?.value || "").trim().replace(/\s+/g, " ").slice(0, 80);
      const amount = parseAmount(amountInput?.value);
      const splitCount = Number(splitInput?.value);

      if (!name) {
        nameInput?.focus();
        return;
      }
      if (!amount) {
        amountInput?.focus();
        return;
      }
      if (!VALID_SPLIT_COUNTS.has(splitCount)) return;

      persistMonthItems(monthKey, [
        ...items,
        { id: makeItemId(), name, amount, splitCount },
      ]);
    });

    card.querySelectorAll("[data-shopping-name]").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      input.addEventListener("blur", () => {
        const item = items.find((entry) => entry.id === input.dataset.shoppingName);
        if (!item) return;
        const name = String(input.value || "").trim().replace(/\s+/g, " ").slice(0, 80);
        if (!name) {
          input.value = item.name;
          return;
        }
        if (name !== item.name) updateItem(monthKey, items, item.id, { name });
      });
    });

    card.querySelectorAll("[data-shopping-amount]").forEach((input) => {
      input.addEventListener("focus", () => input.select());
      input.addEventListener("input", () => formatMoneyInput(input));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      input.addEventListener("blur", () => {
        const item = items.find((entry) => entry.id === input.dataset.shoppingAmount);
        if (!item) return;
        const amount = parseAmount(input.value);
        if (!amount) {
          input.value = formatNumber(item.amount);
          return;
        }
        if (amount !== item.amount) updateItem(monthKey, items, item.id, { amount });
      });
    });

    card.querySelectorAll("[data-shopping-split]").forEach((select) => {
      select.addEventListener("change", () => {
        const item = items.find((entry) => entry.id === select.dataset.shoppingSplit);
        const splitCount = Number(select.value);
        if (!item || !VALID_SPLIT_COUNTS.has(splitCount) || splitCount === item.splitCount) return;
        updateItem(monthKey, items, item.id, { splitCount });
      });
    });

    card.querySelectorAll("[data-shopping-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = items.find((entry) => entry.id === button.dataset.shoppingDelete);
        if (!item) return;
        if (!window.confirm(tr("p1008.shopping.deleteConfirm", { name: item.name }, `Xóa món “${item.name}”?`))) return;
        persistMonthItems(monthKey, items.filter((entry) => entry.id !== item.id));
      });
    });
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
    if (!response.ok) throw new Error(payload.error || `P1008_SHOPPING_REQUEST_${response.status}`);
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
        if (mutationVersion === localMutationVersion) {
          setDirty(false);
          setSyncState("synced");
        }
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
        if (mutationVersion !== localMutationVersion || isDirty()) {
          await queueCloudSave(readData());
          return;
        }

        if (payload.exists) {
          writeLocalData(payload.data);
          setDirty(false);
          setSyncState("synced");
        } else if (Object.keys(localData).length) {
          await queueCloudSave(localData);
        } else {
          setSyncState("synced");
        }

        if (isP1008Visible()) enhanceShoppingCard();
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

  document.addEventListener("joy:p1008-shopping-refresh", enhanceShoppingCard);
  document.querySelector("#finance-workspace")?.addEventListener("joy:p1008-rendered", () => {
    enhanceShoppingCard();
    void refreshCloudData();
  });

  window.addEventListener("focus", () => {
    if (isP1008Visible()) void refreshCloudData();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && isP1008Visible()) enhanceShoppingCard();
  });

  window.addEventListener("joy:i18n-ready", () => {
    if (isP1008Visible()) enhanceShoppingCard();
  });
  window.addEventListener("joy:locale-changed", () => {
    if (isP1008Visible()) enhanceShoppingCard();
  });

  queueMicrotask(() => {
    enhanceShoppingCard();
    if (isP1008Visible()) void refreshCloudData();
  });
})();
