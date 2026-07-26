const state = {
  months: [],
  selectedMonth: "2026-07",
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

async function loadDeals({ quiet = false } = {}) {
  if (!quiet) showStatus("loading", "Loading Sale 2026…");
  try {
    const payload = await apiRequest("/api/sales/deals");
    state.months = Array.isArray(payload.months) ? payload.months : [];
    if (!state.months.some((month) => month.key === state.selectedMonth)) {
      state.selectedMonth = payload.selectedMonth || "2026-07";
    }
    hideStatus();
    render();
  } catch (error) {
    const reconnect = ["AUTH_REQUIRED", "SHEETS_AUTHORIZATION_REQUIRED", "SHEETS_WRITE_AUTHORIZATION_REQUIRED"].includes(error.code);
    showStatus(
      "error",
      reconnect ? "Google Sheets needs to be connected again before Joy can manage Sale." : "Joy could not load the Sale sheet.",
      reconnect ? { label: "Connect Google", href: "/auth/start" } : { label: "Try again", action: "retry-load" },
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
  elements.summaryMonth.textContent = month?.label || "July 2026";
  elements.ledgerTitle.textContent = `${month?.label?.replace(" 2026", "") || "July"} deals`;
  elements.tableBody.replaceChildren(...deals.map(renderDealRow));
  elements.empty.hidden = Boolean(deals.length) || Boolean(state.query);
  elements.tableWrap.classList.toggle("is-empty", !deals.length && !state.query);

  if (!deals.length && state.query) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "sale-no-results";
    cell.textContent = "No matching deals in this month.";
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
    label.textContent = month.shortLabel;
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
  edit.textContent = "Edit";
  actionCell.append(edit);
  row.append(actionCell);
  return row;
}

function selectedMonth() {
  return state.months.find((month) => month.key === state.selectedMonth) || state.months[6];
}

function filteredDeals(deals) {
  const query = state.query.trim().toLocaleLowerCase("vi");
  if (!query) return deals;
  return deals.filter((deal) => [deal.customer, deal.phone, deal.address, deal.host]
    .some((value) => String(value || "").toLocaleLowerCase("vi").includes(query)));
}

function openForm(deal = null) {
  state.editingDeal = deal;
  elements.form.reset();
  elements.formError.hidden = true;
  elements.formTitle.textContent = deal ? "Edit closed room" : "Add a closed room";
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
  elements.save.textContent = "Saving…";
  elements.formError.hidden = true;
  try {
    await apiRequest("/api/sales/deals", {
      method: state.editingDeal ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.selectedMonth = payload.month;
    closeForm();
    showToast(wasEditing ? "Deal updated in Google Sheets" : "Deal added to Google Sheets");
    await loadDeals({ quiet: true });
  } catch (error) {
    const messages = {
      SHEETS_WRITE_AUTHORIZATION_REQUIRED: "Reconnect Google once to allow Joy to save changes.",
      SHEETS_WRITE_ACCESS_DENIED: "Joy does not have permission to edit this Sheet.",
      SALE_DEAL_NOT_FOUND: "This row moved in Google Sheets. Close the form and try again.",
    };
    elements.formError.textContent = messages[error.code] || "The deal could not be saved. Please try again.";
    elements.formError.hidden = false;
  } finally {
    elements.save.disabled = false;
    elements.save.textContent = "Save to Sheet";
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
  strong.textContent = primary || "Unnamed customer";
  const small = document.createElement("small");
  small.textContent = secondary || "No phone";
  cell.append(strong, small);
  return cell;
}

function textCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function privateCell(value, className = "") {
  const cell = textCell(value);
  cell.className = `private-cell ${className}`.trim();
  return cell;
}

function formatVnd(value) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} ₫`;
}

function formatPercent(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value || 0) * 100);
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
loadDeals();
