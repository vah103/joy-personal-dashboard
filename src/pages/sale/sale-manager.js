const state = {
  months: [],
  selectedMonth: "",
  editingDeal: null,
  query: "",
};

const elements = {
  status: document.querySelector("#sale-status"),
  months: document.querySelector("#sale-months"),
  total: document.querySelector("#sale-total"),
  count: document.querySelector("#sale-count"),
  average: document.querySelector("#sale-average"),
  summaryMonth: document.querySelector("#sale-summary-month"),
  ledgerTitle: document.querySelector("#sale-ledger-title"),
  tableBody: document.querySelector("#sale-table-body"),
  tableWrap: document.querySelector("#sale-table-wrap"),
  empty: document.querySelector("#sale-empty"),
  search: document.querySelector("#sale-search"),
  modal: document.querySelector("#sale-modal"),
  form: document.querySelector("#sale-form"),
  formTitle: document.querySelector("#sale-form-title"),
  formError: document.querySelector("#sale-form-error"),
  save: document.querySelector("#sale-save"),
  commissionPreview: document.querySelector("#commission-preview"),
  toast: document.querySelector("#sale-toast"),
};

function saleI18n() {
  return window.JoyI18n || null;
}

function saleTr(key, values = {}, fallback = "") {
  const translated = saleI18n()?.t?.(key, values);
  return translated && translated !== key ? translated : fallback || key;
}

function saleLocale() {
  return saleI18n()?.getLocale?.() || "en";
}

function monthDisplay(month, { short = false } = {}) {
  if (!month) return "";
  const key = String(month.key || "");
  if (!/^\d{4}-\d{2}$/.test(key)) return short ? month.shortLabel : month.label;
  const date = new Date(`${key}-01T12:00:00+07:00`);
  return saleI18n()?.formatDate?.(date, {
    timeZone: "Asia/Ho_Chi_Minh",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
  }) || (short ? month.shortLabel : month.label);
}

async function loadDeals({ quiet = false } = {}) {
  if (!quiet) showStatus("loading", saleTr("saleManager.loading", {}, "Loading Sale 2026…"));
  try {
    const payload = await apiRequest("/api/sales/deals");
    state.months = Array.isArray(payload.months) ? payload.months : [];
    const selectedMonthStillExists = state.months.some((month) => month.key === state.selectedMonth);
    if (!selectedMonthStillExists) {
      const suggestedMonth = String(payload.selectedMonth || "");
      const currentMonth = state.months.find((month) => month.key === suggestedMonth);
      const firstMonthWithDeals = state.months.find((month) => Number(month.count || 0) > 0);
      state.selectedMonth = currentMonth?.key || firstMonthWithDeals?.key || state.months[0]?.key || "";
    }
    hideStatus();
    render();
  } catch (error) {
    const reconnect = ["AUTH_REQUIRED", "SHEETS_AUTHORIZATION_REQUIRED", "SHEETS_WRITE_AUTHORIZATION_REQUIRED"].includes(error.code);
    showStatus(
      "error",
      reconnect
        ? saleTr("saleManager.sheetsReconnect", {}, "Google Sheets needs to be connected again before Joy can manage Sale.")
        : saleTr("saleManager.sheetsLoadFailed", {}, "Joy could not load the Sale sheet."),
      reconnect
        ? { label: saleTr("saleManager.connectGoogle", {}, "Connect Google"), href: "/auth/start" }
        : { label: saleTr("common.tryAgain", {}, "Try again"), action: "retry-load" },
    );
  }
}

function render() {
  renderMonths();
  const month = selectedMonth();
  const deals = filteredDeals(month?.deals || []);
  const total = Number(month?.total || 0);
  elements.total.textContent = formatVnd(total);
  elements.average.textContent = formatVnd(month?.count ? total / month.count : 0);
  elements.count.textContent = String(month?.count || 0);
  elements.summaryMonth.textContent = month ? monthDisplay(month) : "—";
  elements.ledgerTitle.textContent = month
    ? (saleLocale() === "vi" ? `Giao dịch tháng ${Number(month.key.slice(5, 7))}` : `${monthDisplay(month, { short: false }).replace(/\s+2026$/u, "")} deals`)
    : saleTr("saleManager.deals", {}, "Deals");
  elements.tableBody.replaceChildren(...deals.map(renderDealRow));
  elements.empty.hidden = Boolean(deals.length) || Boolean(state.query);
  elements.tableWrap.classList.toggle("is-empty", !deals.length && !state.query);

  if (!deals.length && state.query) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "sale-no-results";
    cell.textContent = saleTr("saleManager.noMatches", {}, "No matching deals in this month.");
    row.append(cell);
    elements.tableBody.append(row);
  }
}

function renderMonths() {
  elements.months.replaceChildren(...state.months.map((month) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = month.key === state.selectedMonth ? "active" : "";
    button.dataset.month = month.key;
    const label = document.createElement("span");
    label.textContent = monthDisplay(month, { short: true });
    const count = document.createElement("small");
    count.textContent = String(month.count || 0);
    button.append(label, count);
    return button;
  }));
}

function renderDealRow(deal) {
  const row = document.createElement("tr");
  row.append(
    cellWithPrimary(deal.customer, deal.phone),
    textCell(deal.address),
    textCell(deal.host || "—"),
    privateCell(formatVnd(deal.rent)),
    privateCell(`${formatPercent(deal.rate)}%`),
    privateCell(formatVnd(deal.commission), "commission-cell"),
  );
  const actionCell = document.createElement("td");
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "sale-edit-button";
  edit.dataset.action = "edit-deal";
  edit.dataset.row = String(deal.sourceRow);
  edit.textContent = saleTr("common.edit", {}, "Edit");
  actionCell.append(edit);
  row.append(actionCell);
  return row;
}

function selectedMonth() {
  return state.months.find((month) => month.key === state.selectedMonth) || null;
}

function filteredDeals(deals) {
  const query = state.query.trim().toLocaleLowerCase("vi");
  if (!query) return deals;
  return deals.filter((deal) => [deal.customer, deal.phone, deal.address, deal.host]
    .some((value) => String(value || "").toLocaleLowerCase("vi").includes(query)));
}

function syncFormLocale() {
  if (elements.modal.hidden) return;
  elements.formTitle.textContent = state.editingDeal
    ? saleTr("saleManager.editClosed", {}, "Edit closed room")
    : saleTr("saleManager.addClosed", {}, "Add a closed room");
  elements.save.textContent = saleTr("saleManager.saveSheet", {}, "Save to Sheet");
  updateCommissionPreview();
}

function openForm(deal = null) {
  state.editingDeal = deal;
  elements.form.reset();
  elements.formError.hidden = true;
  elements.formTitle.textContent = deal
    ? saleTr("saleManager.editClosed", {}, "Edit closed room")
    : saleTr("saleManager.addClosed", {}, "Add a closed room");
  elements.form.elements.sourceRow.value = deal?.sourceRow || "";
  elements.form.elements.month.value = deal?.month || state.selectedMonth;
  elements.form.elements.month.disabled = Boolean(deal);
  elements.form.elements.customer.value = deal?.customer || "";
  elements.form.elements.phone.value = deal?.phone || "";
  elements.form.elements.address.value = deal?.address || "";
  elements.form.elements.host.value = deal?.host || "";
  elements.form.elements.rent.value = deal?.rent || "";
  elements.form.elements.rate.value = deal ? Number(deal.rate || 0) * 100 : "";
  updateCommissionPreview();
  elements.modal.hidden = false;
  document.body.classList.add("sale-modal-open");
  window.setTimeout(() => elements.form.elements.customer.focus(), 0);
}

function closeForm() {
  elements.modal.hidden = true;
  document.body.classList.remove("sale-modal-open");
  state.editingDeal = null;
}

async function saveDeal(event) {
  event.preventDefault();
  const wasEditing = Boolean(state.editingDeal);
  const form = new FormData(elements.form);
  const payload = {
    sourceRow: Number(form.get("sourceRow") || 0),
    month: state.editingDeal?.month || String(form.get("month")),
    customer: String(form.get("customer") || ""),
    phone: String(form.get("phone") || ""),
    address: String(form.get("address") || ""),
    host: String(form.get("host") || ""),
    rent: Number(form.get("rent") || 0),
    rate: Number(form.get("rate") || 0),
  };

  elements.save.disabled = true;
  elements.save.textContent = saleTr("saleManager.saving", {}, "Saving…");
  elements.formError.hidden = true;
  try {
    await apiRequest("/api/sales/deals", {
      method: state.editingDeal ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.selectedMonth = payload.month;
    closeForm();
    showToast(wasEditing
      ? saleTr("saleManager.updatedSheets", {}, "Deal updated in Google Sheets")
      : saleTr("saleManager.addedSheets", {}, "Deal added to Google Sheets"));
    await loadDeals({ quiet: true });
  } catch (error) {
    const key = {
      SHEETS_WRITE_AUTHORIZATION_REQUIRED: "saleManager.reconnectSave",
      SHEETS_WRITE_ACCESS_DENIED: "saleManager.permissionDenied",
      SALE_DEAL_NOT_FOUND: "saleManager.movedRow",
    }[error.code];
    elements.formError.textContent = key
      ? saleTr(key, {}, error.code)
      : saleTr("saleManager.saveFailed", {}, "The deal could not be saved. Please try again.");
    elements.formError.hidden = false;
  } finally {
    elements.save.disabled = false;
    elements.save.textContent = saleTr("saleManager.saveSheet", {}, "Save to Sheet");
  }
}

function updateCommissionPreview() {
  const rent = Number(elements.form.elements.rent.value || 0);
  const rate = Number(elements.form.elements.rate.value || 0) / 100;
  elements.commissionPreview.textContent = formatVnd(Math.round(rent * rate));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || "REQUEST_FAILED"), { code: payload.error });
  return payload;
}

function showStatus(type, message, action) {
  elements.status.hidden = false;
  elements.status.className = `sale-status ${type}`;
  elements.status.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  elements.status.append(text);
  if (!action) return;
  const control = action.href ? document.createElement("a") : document.createElement("button");
  control.textContent = action.label;
  if (action.href) control.href = action.href;
  if (action.action) control.dataset.action = action.action;
  elements.status.append(control);
}

function hideStatus() { elements.status.hidden = true; }

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.setTimeout(() => { elements.toast.hidden = true; }, 2400);
}

function cellWithPrimary(primary, secondary) {
  const cell = document.createElement("td");
  const strong = document.createElement("strong");
  strong.textContent = primary || saleTr("saleManager.unnamedCustomer", {}, "Unnamed customer");
  strong.dataset.i18nSkip = "true";
  const small = document.createElement("small");
  small.textContent = secondary || saleTr("saleManager.noPhone", {}, "No phone");
  small.dataset.i18nSkip = "true";
  cell.append(strong, small);
  return cell;
}

function textCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  cell.dataset.i18nSkip = "true";
  return cell;
}

function privateCell(value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = value;
  cell.className = `private-cell ${className}`.trim();
  return cell;
}

function formatVnd(value) {
  const amount = Number(value || 0);
  const number = saleI18n()?.formatNumber?.(amount, { maximumFractionDigits: 0 })
    || new Intl.NumberFormat(saleLocale() === "vi" ? "vi-VN" : "en-GB", { maximumFractionDigits: 0 }).format(amount);
  return `${number} ₫`;
}

function formatPercent(value) {
  const percent = Number(value || 0) * 100;
  return saleI18n()?.formatNumber?.(percent, { maximumFractionDigits: 2 })
    || new Intl.NumberFormat(saleLocale() === "vi" ? "vi-VN" : "en-GB", { maximumFractionDigits: 2 }).format(percent);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-month]");
  if (!target) return;
  if (target.dataset.month) {
    state.selectedMonth = target.dataset.month;
    state.query = "";
    elements.search.value = "";
    render();
    return;
  }
  const action = target.dataset.action;
  if (action === "add-deal") openForm();
  if (action === "close-form") closeForm();
  if (action === "retry-load") loadDeals();
  if (action === "edit-deal") {
    const deal = selectedMonth()?.deals.find((item) => item.sourceRow === Number(target.dataset.row));
    if (deal) openForm(deal);
  }
});

elements.search.addEventListener("input", () => { state.query = elements.search.value; render(); });
elements.form.addEventListener("submit", saveDeal);
elements.form.elements.rent.addEventListener("input", updateCommissionPreview);
elements.form.elements.rate.addEventListener("input", updateCommissionPreview);
elements.modal.addEventListener("mousedown", (event) => { if (event.target === elements.modal) closeForm(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !elements.modal.hidden) closeForm(); });

function syncSaleLocale() {
  render();
  syncFormLocale();
  saleI18n()?.translateRoot?.(document.querySelector(".sale-page") || document.body);
}

window.addEventListener("joy:i18n-ready", syncSaleLocale);
window.addEventListener("joy:locale-changed", syncSaleLocale);

loadDeals();
