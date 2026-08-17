import { formatVnd } from "../shared/format.js";

const SAFE_ADD_ENDPOINT = "/api/sales/deals/idempotent";
const SAFE_UPDATE_ENDPOINT = "/api/sales/deals/safe-update";
const ADD_REVIEW_ENDPOINT = "/api/sales/deals/idempotent/review";

const state = {
  months: [],
  selectedMonth: "",
  editingDeal: null,
  query: "",
  loadSeq: 0,
  formSaving: false,
  formDirty: false,
  formReviewPending: false,
  formRequestId: "",
  formOperationSeq: 0,
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
  const requestSeq = ++state.loadSeq;
  if (!quiet) showStatus("loading", "Loading Sale 2026…");
  try {
    const payload = await apiRequest("/api/sales/deals");
    if (requestSeq !== state.loadSeq) return;
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
    if (requestSeq !== state.loadSeq) return;
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
  elements.summaryMonth.textContent = month?.label || "—";
  elements.ledgerTitle.textContent = month?.label ? `${month.label.replace(" 2026", "")} deals` : "Deals";
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
  return state.months.find((month) => month.key === state.selectedMonth) || null;
}

function filteredDeals(deals) {
  const query = state.query.trim().toLocaleLowerCase("vi");
  if (!query) return deals;
  return deals.filter((deal) => [deal.customer, deal.phone, deal.address, deal.host]
    .some((value) => String(value || "").toLocaleLowerCase("vi").includes(query)));
}

function setFormBusy(busy) {
  state.formSaving = busy;
  elements.form.querySelectorAll("input, select, button").forEach((control) => {
    if (control.dataset.saleReview) return;
    control.disabled = busy
      || state.formReviewPending
      || (control.name === "month" && Boolean(state.editingDeal));
  });
  elements.save.disabled = busy || state.formReviewPending;
}

function showFormError(message) {
  elements.formError.replaceChildren(document.createTextNode(message));
  elements.formError.hidden = !message;
}

function localizedText(key) {
  return window.JoyI18n?.t?.(key) || "";
}

function setAddReviewMode(active, message = "") {
  state.formReviewPending = active;
  elements.form.querySelectorAll("input, select").forEach((control) => {
    control.disabled = active || state.formSaving || (control.name === "month" && Boolean(state.editingDeal));
  });
  elements.save.disabled = active || state.formSaving;
  showFormError(message);
  if (!active) return;

  elements.formError.append(document.createElement("br"));
  const saved = document.createElement("button");
  saved.type = "button";
  saved.className = "sale-secondary-button";
  saved.dataset.saleReview = "saved";
  saved.dataset.i18n = "sales.checkSaved";
  saved.textContent = localizedText("sales.checkSaved");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "sale-secondary-button";
  retry.dataset.saleReview = "retry";
  retry.dataset.i18n = "sales.checkAllowRetry";
  retry.textContent = localizedText("sales.checkAllowRetry");
  elements.formError.append(saved, document.createTextNode(" "), retry);
  window.JoyI18n?.translateRoot?.(elements.formError);
}

function openForm(deal = null) {
  if (state.formSaving) return;
  state.editingDeal = deal;
  state.formRequestId = "";
  state.formReviewPending = false;
  elements.form.reset();
  showFormError("");
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
  state.formDirty = false;
  setFormBusy(false);
  updateCommissionPreview();
  elements.modal.hidden = false;
  document.body.classList.add("sale-modal-open");
  window.setTimeout(() => elements.form.elements.customer.focus(), 0);
}

function confirmDiscardForm() {
  return !state.formDirty || window.confirm("Discard unsaved deal changes?");
}

function closeForm({ force = false } = {}) {
  if (state.formSaving && !force) return false;
  if (!force && !confirmDiscardForm()) return false;
  elements.modal.hidden = true;
  document.body.classList.remove("sale-modal-open");
  state.editingDeal = null;
  state.formDirty = false;
  state.formReviewPending = false;
  state.formRequestId = "";
  return true;
}

function newRequestId() {
  if (globalThis.crypto?.randomUUID) return `deal:${globalThis.crypto.randomUUID()}`;
  return `deal:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

async function saveDeal(event) {
  event.preventDefault();
  if (state.formSaving || state.formReviewPending || !elements.form.reportValidity()) return;
  const editingDeal = state.editingDeal;
  const wasEditing = Boolean(editingDeal);
  const form = new FormData(elements.form);
  const payload = {
    sourceRow: Number(form.get("sourceRow") || 0),
    month: editingDeal?.month || String(form.get("month")),
    customer: String(form.get("customer") || ""),
    phone: String(form.get("phone") || ""),
    address: String(form.get("address") || ""),
    host: String(form.get("host") || ""),
    rent: Number(form.get("rent") || 0),
    rate: Number(form.get("rate") || 0),
  };

  let endpoint = SAFE_ADD_ENDPOINT;
  if (editingDeal) {
    endpoint = SAFE_UPDATE_ENDPOINT;
    payload.expectedRevision = String(editingDeal.revision || "");
  } else {
    state.formRequestId ||= newRequestId();
    payload.requestId = state.formRequestId;
  }

  const operationId = ++state.formOperationSeq;
  setFormBusy(true);
  elements.save.textContent = "Saving…";
  showFormError("");
  try {
    await apiRequest(endpoint, {
      method: editingDeal ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (operationId !== state.formOperationSeq) return;
    state.selectedMonth = payload.month;
    state.formDirty = false;
    state.formRequestId = "";
    setFormBusy(false);
    closeForm({ force: true });
    showToast(wasEditing ? "Deal updated in Google Sheets" : "Deal added to Google Sheets");
    await loadDeals({ quiet: true });
  } catch (error) {
    if (operationId !== state.formOperationSeq) return;
    if (!editingDeal && ["SALE_DEAL_SAVE_REVIEW_REQUIRED", "SALE_DEAL_SAVE_IN_PROGRESS"].includes(error.code)) {
      state.formDirty = false;
      setFormBusy(false);
      setAddReviewMode(
        true,
        error.code === "SALE_DEAL_SAVE_IN_PROGRESS"
          ? "The previous save may still be settling. Check its result before trying again."
          : "Joy could not confirm whether this deal was saved. Check the Sheet result before retrying.",
      );
      return;
    }
    const messages = {
      SHEETS_WRITE_AUTHORIZATION_REQUIRED: "Reconnect Google once to allow Joy to save changes.",
      SHEETS_WRITE_ACCESS_DENIED: "Joy does not have permission to edit this Sheet.",
      SALE_DEAL_NOT_FOUND: "This row moved in Google Sheets. Close the form and refresh before editing again.",
      SALE_DEAL_STALE: "This deal changed or moved in Google Sheets. Close the form, refresh, then edit the current row.",
      SALE_DEAL_AMBIGUOUS: "Multiple identical deals match this edit. Refresh the Sheet and resolve the duplicate before editing.",
      SALE_DEAL_REVISION_REQUIRED: "This deal needs a fresh reload before it can be edited safely.",
      SALE_DEAL_REQUEST_CONFLICT: "This save changed after it started. Review the Sheet before trying again.",
    };
    showFormError(messages[error.code] || "The deal could not be saved. Please try again.");
  } finally {
    if (operationId === state.formOperationSeq && state.formSaving) setFormBusy(false);
    if (operationId === state.formOperationSeq) elements.save.textContent = "Save to Sheet";
  }
}

async function resolveAddReview(resolution) {
  if (!state.formReviewPending || !state.formRequestId || state.formSaving) return;
  const reviewButtons = elements.formError.querySelectorAll("[data-sale-review]");
  reviewButtons.forEach((button) => { button.disabled = true; });
  try {
    const payload = await apiRequest(ADD_REVIEW_ENDPOINT, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: state.formRequestId, resolution }),
    });
    if (resolution === "saved") {
      state.formDirty = false;
      state.formReviewPending = false;
      state.formRequestId = "";
      closeForm({ force: true });
      showToast("Deal confirmed in Google Sheets");
      await loadDeals({ quiet: true });
      return;
    }
    if (payload.retryAllowed) {
      state.formReviewPending = false;
      setFormBusy(false);
      showFormError("No matching deal was found. It is safe to press Save to Sheet again.");
    }
  } catch (error) {
    const messages = {
      SALE_DEAL_SAVE_IN_PROGRESS: "The previous save is still settling. Try this check again shortly.",
      SALE_DEAL_REVIEW_NOT_FOUND: "No matching deal is visible yet. Use “Check & allow retry” before saving again.",
      SALE_DEAL_REVIEW_DEAL_PRESENT: "A matching deal already exists. Use “Check if saved” instead of retrying.",
      SALE_DEAL_REVIEW_AMBIGUOUS: "Multiple identical deals exist. Open Google Sheets and resolve this manually before retrying.",
      SALE_DEAL_REVIEW_NOT_REQUIRED: "This review is no longer active. Close the form and refresh the Sale list.",
    };
    setAddReviewMode(true, messages[error.code] || "Joy could not resolve this save yet. Check Google Sheets and try again.");
  } finally {
    elements.formError.querySelectorAll("[data-sale-review]").forEach((button) => { button.disabled = false; });
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

function formatPercent(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value || 0) * 100);
}

document.addEventListener("click", (event) => {
  const reviewControl = event.target.closest?.("[data-sale-review]");
  if (reviewControl) {
    void resolveAddReview(reviewControl.dataset.saleReview);
    return;
  }

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
  if (action === "retry-load") void loadDeals();
  if (action === "edit-deal") {
    const deal = selectedMonth()?.deals.find((item) => item.sourceRow === Number(target.dataset.row));
    if (deal) openForm(deal);
  }
});

elements.search.addEventListener("input", () => { state.query = elements.search.value; render(); });
elements.form.addEventListener("submit", saveDeal);
elements.form.addEventListener("input", () => {
  if (state.formSaving || state.formReviewPending) return;
  state.formDirty = true;
  if (!state.editingDeal) state.formRequestId = "";
});
elements.form.addEventListener("change", () => {
  if (state.formSaving || state.formReviewPending) return;
  state.formDirty = true;
  if (!state.editingDeal) state.formRequestId = "";
});
elements.form.elements.rent.addEventListener("input", updateCommissionPreview);
elements.form.elements.rate.addEventListener("input", updateCommissionPreview);
elements.modal.addEventListener("mousedown", (event) => { if (event.target === elements.modal) closeForm(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !elements.modal.hidden) closeForm(); });
void loadDeals();
