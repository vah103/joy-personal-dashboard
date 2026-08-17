import { saleApi } from "../shared/api.js";
import { formatVnd } from "../shared/format.js";
import { saleText } from "../shared/i18n.js";

const SAFE_ADD_ENDPOINT = "/api/sales/deals/idempotent";
const SAFE_UPDATE_ENDPOINT = "/api/sales/deals/safe-update";
const ADD_REVIEW_ENDPOINT = "/api/sales/deals/idempotent/review";
const ADD_REVIEW_STORAGE_KEY = "joy:sale:add-review:v1";

const state = {
  months: [], selectedMonth: "", editingDeal: null, query: "", loadSeq: 0,
  formSaving: false, formDirty: false, formReviewPending: false,
  formRequestId: "", formOperationSeq: 0,
};

const elements = {
  status: document.querySelector("#sale-status"), months: document.querySelector("#sale-months"),
  total: document.querySelector("#sale-total"), count: document.querySelector("#sale-count"),
  average: document.querySelector("#sale-average"), summaryMonth: document.querySelector("#sale-summary-month"),
  ledgerTitle: document.querySelector("#sale-ledger-title"), tableBody: document.querySelector("#sale-table-body"),
  tableWrap: document.querySelector("#sale-table-wrap"), empty: document.querySelector("#sale-empty"),
  search: document.querySelector("#sale-search"), modal: document.querySelector("#sale-modal"),
  form: document.querySelector("#sale-form"), formTitle: document.querySelector("#sale-form-title"),
  formError: document.querySelector("#sale-form-error"), save: document.querySelector("#sale-save"),
  commissionPreview: document.querySelector("#commission-preview"), toast: document.querySelector("#sale-toast"),
};

async function loadDeals({ quiet = false } = {}) {
  const requestSeq = ++state.loadSeq;
  if (!quiet) showStatus("loading", saleText("sales.loading", "Loading Sale 2026…"));
  try {
    const payload = await saleApi("/api/sales/deals");
    if (requestSeq !== state.loadSeq) return;
    state.months = Array.isArray(payload.months) ? payload.months : [];
    if (!state.months.some((month) => month.key === state.selectedMonth)) {
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
      reconnect
        ? saleText("sales.connectRequired", "Google Sheets needs to be connected again before Joy can manage Sale.")
        : saleText("sales.loadFailed", "Joy could not load the Sale sheet."),
      reconnect
        ? { label: saleText("sales.connectGoogle", "Connect Google"), href: "/auth/start" }
        : { label: saleText("sales.tryAgain", "Try again"), action: "retry-load" },
    );
  }
}

function selectedMonth() {
  return state.months.find((month) => month.key === state.selectedMonth) || null;
}

function localizedMonthLabel(month) {
  if (!month) return "";
  const monthNumber = String(month.key || "").match(/-(\d{2})$/u)?.[1] || "";
  return monthNumber ? saleText(`salePage.month${monthNumber}`, month.label || "") : month.label || "";
}

function localizedMonthShortLabel(month) {
  const fullLabel = localizedMonthLabel(month);
  return fullLabel ? fullLabel.replace(/\s+2026$/u, "") : month?.shortLabel || "";
}

function filteredDeals(deals) {
  const query = state.query.trim().toLocaleLowerCase("vi");
  if (!query) return deals;
  return deals.filter((deal) => [deal.customer, deal.phone, deal.address, deal.host]
    .some((value) => String(value || "").toLocaleLowerCase("vi").includes(query)));
}

function render() {
  renderMonths();
  const month = selectedMonth();
  const deals = filteredDeals(month?.deals || []);
  const total = Number(month?.total || 0);
  const monthLabel = localizedMonthLabel(month);
  const monthShortLabel = localizedMonthShortLabel(month);
  elements.total.textContent = formatVnd(total);
  elements.average.textContent = formatVnd(month?.count ? total / month.count : 0);
  elements.count.textContent = String(month?.count || 0);
  elements.summaryMonth.textContent = monthLabel || "—";
  elements.ledgerTitle.textContent = month
    ? saleText("salePage.monthDeals", `${monthShortLabel} deals`, { month: monthShortLabel })
    : saleText("sales.deals", "Deals");
  elements.tableBody.replaceChildren(...deals.map(renderDealRow));
  elements.empty.hidden = Boolean(deals.length) || Boolean(state.query);
  elements.tableWrap.classList.toggle("is-empty", !deals.length && !state.query);
  if (!deals.length && state.query) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "sale-no-results";
    cell.textContent = saleText("sales.noMatchingDeals", "No matching deals in this month.");
    row.append(cell);
    elements.tableBody.append(row);
  }
  if (!elements.modal.hidden) {
    elements.formTitle.textContent = state.editingDeal
      ? saleText("sales.editTitle", "Edit closed room")
      : saleText("sales.addTitle", "Add a closed room");
  }
  if (!state.formSaving) elements.save.textContent = saleText("sales.saveToSheet", "Save to Sheet");
}

function renderMonths() {
  elements.months.replaceChildren(...state.months.map((month) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = month.key === state.selectedMonth ? "active" : "";
    button.dataset.month = month.key;
    const label = document.createElement("span");
    label.textContent = localizedMonthShortLabel(month);
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
  edit.textContent = saleText("sales.edit", "Edit");
  actionCell.append(edit);
  row.append(actionCell);
  return row;
}

function setFormBusy(busy) {
  state.formSaving = busy;
  elements.form.querySelectorAll("input, select, button").forEach((control) => {
    if (control.dataset.saleReview) return;
    control.disabled = busy || state.formReviewPending || (control.name === "month" && Boolean(state.editingDeal));
  });
  elements.modal.querySelectorAll('[data-action="close-form"]').forEach((control) => {
    control.disabled = busy || state.formReviewPending;
  });
  elements.save.disabled = busy || state.formReviewPending;
}

function showFormError(message) {
  elements.formError.replaceChildren(document.createTextNode(message));
  elements.formError.hidden = !message;
}

function setAddReviewMode(active, message = "") {
  state.formReviewPending = active;
  elements.form.querySelectorAll("input, select").forEach((control) => {
    control.disabled = active || state.formSaving || (control.name === "month" && Boolean(state.editingDeal));
  });
  elements.modal.querySelectorAll('[data-action="close-form"]').forEach((control) => {
    control.disabled = active || state.formSaving;
  });
  elements.save.disabled = active || state.formSaving;
  showFormError(message);
  if (!active) return;
  elements.formError.append(document.createElement("br"));
  const saved = document.createElement("button");
  saved.type = "button";
  saved.className = "sale-secondary-button";
  saved.dataset.saleReview = "saved";
  saved.textContent = saleText("sales.checkSaved", "Check if saved");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "sale-secondary-button";
  retry.dataset.saleReview = "retry";
  retry.textContent = saleText("sales.checkAllowRetry", "Check & allow retry");
  elements.formError.append(saved, document.createTextNode(" "), retry);
}

function persistPendingAddReview(payload) {
  if (!state.formRequestId) return;
  try {
    window.sessionStorage.setItem(ADD_REVIEW_STORAGE_KEY, JSON.stringify({
      requestId: state.formRequestId,
      payload: {
        month: String(payload.month || ""),
        customer: String(payload.customer || ""),
        phone: String(payload.phone || ""),
        address: String(payload.address || ""),
        host: String(payload.host || ""),
        rent: Number(payload.rent || 0),
        rate: Number(payload.rate || 0),
      },
    }));
  } catch {
    // Review remains protected in memory even if browser storage is unavailable.
  }
}

function clearPendingAddReview() {
  try {
    window.sessionStorage.removeItem(ADD_REVIEW_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browsing modes.
  }
}

function storedPendingAddReview() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ADD_REVIEW_STORAGE_KEY) || "null");
    const requestId = String(parsed?.requestId || "");
    const payload = parsed?.payload;
    if (!/^[A-Za-z0-9:_-]{8,160}$/u.test(requestId) || !payload || typeof payload !== "object") {
      clearPendingAddReview();
      return null;
    }
    return { requestId, payload };
  } catch {
    clearPendingAddReview();
    return null;
  }
}

function restorePendingAddReview() {
  const pending = storedPendingAddReview();
  if (!pending) return false;
  state.editingDeal = null;
  state.formRequestId = pending.requestId;
  state.selectedMonth = String(pending.payload.month || state.selectedMonth);
  elements.form.reset();
  elements.form.elements.sourceRow.value = "";
  elements.form.elements.month.value = String(pending.payload.month || "");
  elements.form.elements.customer.value = String(pending.payload.customer || "");
  elements.form.elements.phone.value = String(pending.payload.phone || "");
  elements.form.elements.address.value = String(pending.payload.address || "");
  elements.form.elements.host.value = String(pending.payload.host || "");
  elements.form.elements.rent.value = Number(pending.payload.rent || 0) || "";
  elements.form.elements.rate.value = Number(pending.payload.rate || 0) || "";
  state.formDirty = false;
  setFormBusy(false);
  setAddReviewMode(
    true,
    saleText("sales.reviewUncertain", "Joy could not confirm whether this deal was saved. Check the Sheet result before retrying."),
  );
  updateCommissionPreview();
  elements.formTitle.textContent = saleText("sales.addTitle", "Add a closed room");
  elements.modal.hidden = false;
  document.body.classList.add("sale-modal-open");
  return true;
}

function openForm(deal = null) {
  if (state.formSaving || state.formReviewPending) return;
  state.editingDeal = deal;
  state.formRequestId = "";
  state.formReviewPending = false;
  elements.form.reset();
  showFormError("");
  elements.formTitle.textContent = deal
    ? saleText("sales.editTitle", "Edit closed room")
    : saleText("sales.addTitle", "Add a closed room");
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
  return !state.formDirty || window.confirm(saleText("sales.discardChanges", "Discard unsaved deal changes?"));
}

function closeForm({ force = false } = {}) {
  if (!force && (state.formSaving || state.formReviewPending)) return false;
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

const SAVE_ERROR_KEYS = Object.freeze({
  SHEETS_WRITE_AUTHORIZATION_REQUIRED: ["sales.reconnectWrite", "Reconnect Google once to allow Joy to save changes."],
  SHEETS_WRITE_ACCESS_DENIED: ["sales.writeDenied", "Joy does not have permission to edit this Sheet."],
  SALE_DEAL_NOT_FOUND: ["sales.dealNotFound", "This row moved in Google Sheets. Close the form and refresh before editing again."],
  SALE_DEAL_STALE: ["sales.dealStale", "This deal changed or moved in Google Sheets. Close the form, refresh, then edit the current row."],
  SALE_DEAL_AMBIGUOUS: ["sales.dealAmbiguous", "Multiple identical deals match this edit. Refresh the Sheet and resolve the duplicate before editing."],
  SALE_DEAL_REVISION_REQUIRED: ["sales.revisionRequired", "This deal needs a fresh reload before it can be edited safely."],
  SALE_DEAL_REQUEST_CONFLICT: ["sales.requestConflict", "This save changed after it started. Review the Sheet before trying again."],
});

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
  elements.save.textContent = saleText("sales.saving", "Saving…");
  showFormError("");
  try {
    await saleApi(endpoint, { method: editingDeal ? "PATCH" : "POST", body: payload });
    if (operationId !== state.formOperationSeq) return;
    state.selectedMonth = payload.month;
    state.formDirty = false;
    clearPendingAddReview();
    state.formRequestId = "";
    setFormBusy(false);
    closeForm({ force: true });
    showToast(wasEditing
      ? saleText("sales.updatedToast", "Deal updated in Google Sheets")
      : saleText("sales.addedToast", "Deal added to Google Sheets"));
    await loadDeals({ quiet: true });
  } catch (error) {
    if (operationId !== state.formOperationSeq) return;
    if (!editingDeal && ["SALE_DEAL_SAVE_REVIEW_REQUIRED", "SALE_DEAL_SAVE_IN_PROGRESS"].includes(error.code)) {
      state.formDirty = false;
      persistPendingAddReview(payload);
      setFormBusy(false);
      setAddReviewMode(
        true,
        error.code === "SALE_DEAL_SAVE_IN_PROGRESS"
          ? saleText("sales.reviewSettling", "The previous save may still be settling. Check its result before trying again.")
          : saleText("sales.reviewUncertain", "Joy could not confirm whether this deal was saved. Check the Sheet result before retrying."),
      );
      return;
    }
    const [key, fallback] = SAVE_ERROR_KEYS[error.code]
      || ["sales.saveFailed", "The deal could not be saved. Please try again."];
    showFormError(saleText(key, fallback));
  } finally {
    if (operationId === state.formOperationSeq && state.formSaving) setFormBusy(false);
    if (operationId === state.formOperationSeq) elements.save.textContent = saleText("sales.saveToSheet", "Save to Sheet");
  }
}

const REVIEW_ERROR_KEYS = Object.freeze({
  SALE_DEAL_SAVE_IN_PROGRESS: ["sales.reviewStillSettling", "The previous save is still settling. Try this check again shortly."],
  SALE_DEAL_REVIEW_NOT_FOUND: ["sales.reviewNotFound", "No matching deal is visible yet. Use “Check & allow retry” before saving again."],
  SALE_DEAL_REVIEW_DEAL_PRESENT: ["sales.reviewDealPresent", "A matching deal already exists. Use “Check if saved” instead of retrying."],
  SALE_DEAL_REVIEW_AMBIGUOUS: ["sales.reviewAmbiguous", "Multiple identical deals exist. Open Google Sheets and resolve this manually before retrying."],
  SALE_DEAL_REVIEW_NOT_REQUIRED: ["sales.reviewNotRequired", "This review is no longer active. Close the form and refresh the Sale list."],
});

async function resolveAddReview(resolution) {
  if (!state.formReviewPending || !state.formRequestId || state.formSaving) return;
  const reviewButtons = elements.formError.querySelectorAll("[data-sale-review]");
  reviewButtons.forEach((button) => { button.disabled = true; });
  try {
    const payload = await saleApi(ADD_REVIEW_ENDPOINT, {
      method: "PATCH",
      body: { requestId: state.formRequestId, resolution },
    });
    if (resolution === "saved") {
      state.formDirty = false;
      state.formReviewPending = false;
      clearPendingAddReview();
      state.formRequestId = "";
      closeForm({ force: true });
      showToast(saleText("sales.confirmedToast", "Deal confirmed in Google Sheets"));
      await loadDeals({ quiet: true });
      return;
    }
    if (payload.retryAllowed) {
      state.formReviewPending = false;
      clearPendingAddReview();
      setFormBusy(false);
      showFormError(saleText(
        "sales.reviewRetryReady",
        "No matching deal was found. It is safe to press Save to Sheet again.",
      ));
    }
  } catch (error) {
    const [key, fallback] = REVIEW_ERROR_KEYS[error.code]
      || ["sales.reviewFailed", "Joy could not resolve this save yet. Check Google Sheets and try again."];
    if (error.code === "SALE_DEAL_REVIEW_NOT_REQUIRED") {
      state.formReviewPending = false;
      clearPendingAddReview();
      state.formRequestId = "";
      setFormBusy(false);
      showFormError(saleText(key, fallback));
      return;
    }
    setAddReviewMode(true, saleText(key, fallback));
  } finally {
    elements.formError.querySelectorAll("[data-sale-review]").forEach((button) => { button.disabled = false; });
  }
}

function updateCommissionPreview() {
  const rent = Number(elements.form.elements.rent.value || 0);
  const rate = Number(elements.form.elements.rate.value || 0) / 100;
  elements.commissionPreview.textContent = formatVnd(Math.round(rent * rate));
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
  strong.textContent = primary || saleText("sales.unnamedCustomer", "Unnamed customer");
  const small = document.createElement("small");
  small.textContent = secondary || saleText("sales.noPhone", "No phone");
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
  const target = event.target.closest?.("[data-action], [data-month]");
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

elements.search.addEventListener("input", () => {
  state.query = elements.search.value;
  render();
});
elements.form.addEventListener("submit", saveDeal);
for (const type of ["input", "change"]) {
  elements.form.addEventListener(type, () => {
    if (state.formSaving || state.formReviewPending) return;
    state.formDirty = true;
    if (!state.editingDeal) state.formRequestId = "";
  });
}
elements.form.elements.rent.addEventListener("input", updateCommissionPreview);
elements.form.elements.rate.addEventListener("input", updateCommissionPreview);
elements.modal.addEventListener("mousedown", (event) => {
  if (event.target === elements.modal) closeForm();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.modal.hidden) closeForm();
});
window.addEventListener("beforeunload", (event) => {
  if (!state.formReviewPending) return;
  event.preventDefault();
  event.returnValue = "";
});
window.addEventListener("joy:locale-changed", render);
const restoredPendingReview = restorePendingAddReview();
void loadDeals({ quiet: restoredPendingReview });