const HISTORY_CONTENT_SELECTOR = "#sales-history-content";
const DISPLAY_ROW_SELECTOR = ".sales-history-table tbody tr:not(.sales-history-edit-row)";
const EDIT_CONTROL_SELECTOR = '[data-action="edit-sale-viewing"]';
const CANCEL_CONTROL_SELECTOR = '[data-action="cancel-sale-viewing-edit"]';
const DEALS_ENDPOINT = "/api/sales/deals";
const VIEWINGS_ENDPOINT = "/api/sales/viewings";

let dealSavedIds = new Set();
let dealStateSyncPromise = null;

function isCoarsePointer() {
  return window.matchMedia?.("(pointer: coarse)")?.matches === true;
}

function editableDisplayRow(target) {
  const row = target?.closest?.(DISPLAY_ROW_SELECTOR);
  if (!row?.closest(HISTORY_CONTENT_SELECTOR)) return null;
  return row.querySelector(EDIT_CONTROL_SELECTOR) ? row : null;
}

function startRowEdit(row) {
  row?.querySelector(EDIT_CONTROL_SELECTOR)?.click();
}

function refreshHistory() {
  document.querySelector("#sales-history-refresh")?.click();
}

function viewingIdForRow(row) {
  return String(
    row?.dataset.viewingId
    || row?.querySelector(EDIT_CONTROL_SELECTOR)?.dataset.viewingId
    || "",
  ).trim();
}

function rowDealSaved(row) {
  return dealSavedIds.has(viewingIdForRow(row));
}

function translateRoot(root) {
  if (root) window.JoyI18n?.translateRoot?.(root);
}

function applyDealState(row) {
  const saved = rowDealSaved(row);
  row.dataset.dealSaved = saved ? "true" : "false";

  if (saved) {
    const cells = [...row.children];
    if (cells[4]) cells[4].textContent = "Closed";
  }

  const button = row.querySelector(".sales-history-close-button");
  if (!button) {
    if (saved) translateRoot(row);
    return;
  }

  button.disabled = saved;
  button.dataset.dealSaved = saved ? "true" : "false";
  button.textContent = saved ? "Deal saved" : "Close deal";
  button.title = saved ? "Deal saved to Sale Manager." : "Close this deal.";
  translateRoot(row);
}

async function syncDealStates() {
  if (dealStateSyncPromise) return dealStateSyncPromise;
  dealStateSyncPromise = (async () => {
    try {
      const response = await fetch(VIEWINGS_ENDPOINT, { credentials: "same-origin" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "VIEWING_HISTORY_FAILED");
      dealSavedIds = new Set(
        (Array.isArray(payload.history) ? payload.history : [])
          .filter((viewing) => viewing?.id && viewing.dealSaved)
          .map((viewing) => String(viewing.id)),
      );
      const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
      if (content) decorateRows(content);
    } catch {
      // History stays usable even if the saved-deal marker cannot refresh.
    } finally {
      dealStateSyncPromise = null;
    }
  })();
  return dealStateSyncPromise;
}

function matchesLabel(value, ...labels) {
  return labels.includes(String(value || "").trim());
}

function combinedReminderLabel(status, reminder, followup) {
  if (matchesLabel(status, "Đã huỷ", "Cancelled")) return "Cancelled";
  if (matchesLabel(followup, "Đã gửi", "Sent")) return "Follow-up sent";
  if (matchesLabel(status, "Đã qua", "Past") && matchesLabel(followup, "Chờ gửi", "Pending")) return "Follow-up pending";
  if (matchesLabel(status, "Sắp tới", "Upcoming") && matchesLabel(reminder, "Đã gửi", "Sent")) return "Reminder sent";
  if (matchesLabel(status, "Sắp tới", "Upcoming") && matchesLabel(reminder, "Chờ gửi", "Pending")) return "Reminder pending";
  if (matchesLabel(status, "Sắp tới", "Upcoming") && matchesLabel(reminder, "Không nhắc", "No reminder")) return "No advance reminder";
  if (matchesLabel(reminder, "Đã gửi", "Sent")) return "Reminder sent";
  if (matchesLabel(followup, "Chờ gửi", "Pending")) return "Follow-up pending";
  return "—";
}

function mergeReminderColumns(content) {
  const table = content.querySelector(".sales-history-table");
  if (!table) return;

  const headers = [...table.querySelectorAll("thead th")];
  if (headers.length >= 8) {
    headers[5].textContent = "Reminder";
    headers[6].remove();
  }

  table.querySelectorAll("tbody tr").forEach((row) => {
    if (row.dataset.reminderMerged === "true") return;
    const cells = [...row.children];
    if (cells.length < 8) return;

    const status = cells[4].textContent.trim();
    const reminder = cells[5].textContent.trim();
    const followup = cells[6].textContent.trim();
    cells[5].textContent = combinedReminderLabel(status, reminder, followup);
    cells[6].remove();
    row.dataset.reminderMerged = "true";
  });
}

function decorateDisplayRows(content) {
  content.querySelectorAll(DISPLAY_ROW_SELECTOR).forEach((row) => {
    if (!row.querySelector(EDIT_CONTROL_SELECTOR)) return;
    applyDealState(row);
    row.dataset.historyEditable = "true";
    row.tabIndex = 0;
    row.setAttribute(
      "aria-label",
      isCoarsePointer()
        ? "Tap to edit this appointment"
        : "Double-click or press Enter to edit this appointment",
    );
  });
}

function editRow(content) {
  return content.querySelector(".sales-history-edit-row");
}

function cancelEditing(content) {
  editRow(content)?.querySelector(CANCEL_CONTROL_SELECTOR)?.click();
}

function setEditMessage(row, text) {
  const message = row?.querySelector(".sales-history-edit-message");
  if (!message) return;
  message.textContent = text;
  message.hidden = !text;
  translateRoot(row);
}

async function deleteViewing(row, button) {
  const id = row.dataset.viewingId || "";
  if (!id) return;

  const customer = row.querySelector('[data-history-field="customerName"]')?.value.trim() || "this appointment";
  if (!window.confirm(`Delete the appointment for ${customer}?`)) return;

  row.querySelectorAll("button").forEach((control) => { control.disabled = true; });
  setEditMessage(row, "Deleting…");

  try {
    const response = await fetch("/api/sales/viewings/delete", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "VIEWING_DELETE_FAILED");
    dealSavedIds.delete(id);
    refreshHistory();
  } catch {
    row.querySelectorAll("button").forEach((control) => { control.disabled = false; });
    button.disabled = false;
    setEditMessage(row, "Could not delete the appointment. Please try again.");
  }
}

function vietnamMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}`;
}

function formatVnd(value) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} ₫`;
}

function ensureCloseDealModal() {
  let modal = document.querySelector("#sale-close-deal-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.className = "modal-backdrop sale-close-deal-backdrop";
  modal.id = "sale-close-deal-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <section class="sale-close-deal-modal" role="dialog" aria-modal="true" aria-labelledby="sale-close-deal-title">
      <div class="sale-close-deal-heading">
        <div><small>Sale Manager</small><h2 id="sale-close-deal-title">Close deal</h2></div>
        <button type="button" aria-label="Close form" data-action="close-deal-form">×</button>
      </div>
      <form id="sale-close-deal-form">
        <input name="viewingId" type="hidden">
        <div class="sale-close-deal-grid">
          <label>Customer<input name="customer" type="text" maxlength="120" required></label>
          <label>Phone<input name="phone" type="tel" maxlength="30" inputmode="tel"></label>
          <label class="wide">Address<input name="address" type="text" maxlength="180" required></label>
          <label>Host<input name="host" type="text" maxlength="120"></label>
          <label>Room price<input name="rent" type="number" min="1" max="1000000000" step="1" inputmode="numeric" required></label>
          <label>Commission rate (%)<input name="rate" type="number" min="0.01" max="100" step="0.01" inputmode="decimal" required></label>
        </div>
        <div class="sale-close-deal-preview"><span>Calculated commission</span><strong>0 ₫</strong></div>
        <p class="sale-close-deal-status" hidden></p>
        <div class="sale-close-deal-actions">
          <button class="secondary-button" type="button" data-action="close-deal-form">Cancel</button>
          <button class="primary-button" type="submit">Save deal</button>
        </div>
      </form>
    </section>
  `;
  document.body.append(modal);

  const form = modal.querySelector("#sale-close-deal-form");
  form?.elements.rent.addEventListener("input", updateCloseDealPreview);
  form?.elements.rate.addEventListener("input", updateCloseDealPreview);
  form?.addEventListener("submit", saveClosedDeal);
  modal.addEventListener("mousedown", (event) => {
    if (event.target === modal) closeDealForm();
  });
  translateRoot(modal);
  return modal;
}

function updateCloseDealPreview() {
  const form = document.querySelector("#sale-close-deal-form");
  const preview = document.querySelector(".sale-close-deal-preview strong");
  if (!form || !preview) return;
  const rent = Number(form.elements.rent.value || 0);
  const rate = Number(form.elements.rate.value || 0) / 100;
  preview.textContent = formatVnd(Math.round(rent * rate));
}

function openCloseDealForm(row) {
  const id = viewingIdForRow(row);
  if (!id || rowDealSaved(row)) return;
  const modal = ensureCloseDealModal();
  const form = modal.querySelector("#sale-close-deal-form");
  if (!form) return;

  const field = (name) => row.querySelector(`[data-history-field="${name}"]`)?.value.trim() || "";
  form.reset();
  form.elements.viewingId.value = id;
  form.elements.customer.value = field("customerName");
  form.elements.phone.value = field("phone");
  form.elements.address.value = field("viewingAddress");
  const status = modal.querySelector(".sale-close-deal-status");
  if (status) {
    status.textContent = "";
    status.hidden = true;
  }
  updateCloseDealPreview();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => form.elements.rent.focus(), 0);
}

function closeDealForm() {
  const modal = document.querySelector("#sale-close-deal-modal");
  if (!modal) return;
  modal.hidden = true;
  const assistantVisible = document.querySelector("#sales-assistant-modal")?.hidden === false;
  if (!assistantVisible) document.body.classList.remove("modal-open");
}

async function markViewingDealSaved(id) {
  const response = await fetch(VIEWINGS_ENDPOINT, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, dealSaved: true }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "VIEWING_DEAL_STATE_FAILED");
}

async function saveClosedDeal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const modal = document.querySelector("#sale-close-deal-modal");
  const status = modal?.querySelector(".sale-close-deal-status");
  const save = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const viewingId = String(data.get("viewingId") || "").trim();
  const payload = {
    month: vietnamMonthKey(),
    customer: String(data.get("customer") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    address: String(data.get("address") || "").trim(),
    host: String(data.get("host") || "").trim(),
    rent: Number(data.get("rent") || 0),
    rate: Number(data.get("rate") || 0),
  };

  save.disabled = true;
  save.textContent = "Saving deal…";
  if (status) status.hidden = true;
  translateRoot(modal);

  try {
    const response = await fetch(DEALS_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "SALE_DEAL_CREATE_FAILED");

    dealSavedIds.add(viewingId);
    try {
      await markViewingDealSaved(viewingId);
    } catch {
      // The deal is already safely stored in Sale Manager; keep the local marker for this session.
    }

    closeDealForm();
    const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
    if (content) cancelEditing(content);
    refreshHistory();
    window.dispatchEvent(new CustomEvent("joy:sale-deal-saved"));
    window.setTimeout(() => void syncDealStates(), 0);
  } catch {
    if (status) {
      status.textContent = "Could not save the deal. Please try again.";
      status.hidden = false;
      translateRoot(modal);
    }
  } finally {
    save.disabled = false;
    save.textContent = "Save deal";
    translateRoot(modal);
  }
}

function decorateEditRow(content) {
  const row = editRow(content);
  if (!row) return;
  applyDealState(row);
  if (row.dataset.deleteReady === "true") return;
  row.dataset.deleteReady = "true";

  const controls = row.querySelector(".sales-history-edit-controls");
  const save = row.querySelector('[data-action="save-sale-viewing"]');
  const cancel = row.querySelector(CANCEL_CONTROL_SELECTOR);
  if (!controls || !save || !cancel) return;

  cancel.hidden = true;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "sales-history-delete-button";
  remove.textContent = "Delete";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteViewing(row, remove);
  });

  const close = document.createElement("button");
  close.type = "button";
  close.className = "sales-history-close-button";
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    openCloseDealForm(row);
  });

  controls.insertBefore(remove, save);
  controls.insertBefore(close, save);
  applyDealState(row);
}

function decorateRows(content) {
  mergeReminderColumns(content);
  decorateDisplayRows(content);
  decorateEditRow(content);
}

function ensureEditHint() {
  const headingCopy = document.querySelector(".sales-history-heading > div");
  if (!headingCopy || headingCopy.querySelector(".sales-history-edit-hint")) return;
  const hint = document.createElement("span");
  hint.className = "sales-history-edit-hint";
  hint.textContent = isCoarsePointer()
    ? "Tap a row to edit it"
    : "Double-click a row to edit it";
  headingCopy.append(hint);
  translateRoot(headingCopy);
}

function decorateDashboardSaleCard() {
  const salesPanel = document.querySelector("#sales");
  const heading = salesPanel?.querySelector(".panel-heading");
  const salesBody = salesPanel?.querySelector(".sales-body");
  const upcoming = salesBody?.querySelector(".sales-summary");
  if (!salesPanel || !heading || !salesBody || !upcoming) return;

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

  salesBody.querySelectorAll(".sales-assistant-launch").forEach((launch) => { launch.hidden = true; });
  translateRoot(salesPanel);
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

function installHistoryRowEditing() {
  decorateDashboardSaleCard();
  void loadDashboardCommission();
  ensureCloseDealModal();

  const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
  if (!content || content.dataset.rowEditReady === "true") return;
  content.dataset.rowEditReady = "true";
  ensureEditHint();
  decorateRows(content);
  void syncDealStates();

  const observer = new MutationObserver(() => decorateRows(content));
  observer.observe(content, { childList: true, subtree: true });

  content.addEventListener("dblclick", (event) => {
    if (isCoarsePointer()) return;
    const row = editableDisplayRow(event.target);
    if (!row) return;
    event.preventDefault();
    startRowEdit(row);
  });

  content.addEventListener("click", (event) => {
    if (!isCoarsePointer()) return;
    if (event.target.closest("button, input, a, select, textarea")) return;
    const row = editableDisplayRow(event.target);
    if (!row) return;
    startRowEdit(row);
  });

  content.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const row = editableDisplayRow(event.target);
    if (!row || event.target !== row) return;
    event.preventDefault();
    startRowEdit(row);
  });

  document.addEventListener("click", (event) => {
    const closeDealControl = event.target.closest?.('[data-action="close-deal-form"]');
    if (closeDealControl) {
      closeDealForm();
      return;
    }

    const historyTab = event.target.closest?.('[data-assistant-mode="history"]');
    if (historyTab) {
      window.setTimeout(() => {
        refreshHistory();
        void syncDealStates();
      }, 0);
    }

    const assistantLauncher = event.target.closest?.('[data-action="open-sales-assistant"]');
    if (assistantLauncher) {
      window.setTimeout(() => {
        const historyPanel = document.querySelector('[data-assistant-panel="history"]');
        if (historyPanel && !historyPanel.hidden) {
          refreshHistory();
          void syncDealStates();
        }
      }, 0);
    }

    if (event.target.closest?.(EDIT_CONTROL_SELECTOR)) return;
    if (event.target.closest?.("#sale-close-deal-modal")) return;
    const row = editRow(content);
    if (!row || row.contains(event.target)) return;
    cancelEditing(content);
  });

  window.addEventListener("joy:sale-deal-saved", () => void loadDashboardCommission());
  window.addEventListener("joy:i18n-ready", () => {
    decorateDashboardSaleCard();
    translateRoot(document.querySelector("#sale-close-deal-modal"));
  });
  window.addEventListener("joy:locale-changed", () => {
    decorateDashboardSaleCard();
    translateRoot(document.querySelector("#sale-close-deal-modal"));
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadDashboardCommission();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector("#sale-close-deal-modal")?.hidden === false) {
      closeDealForm();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installHistoryRowEditing, { once: true });
} else {
  installHistoryRowEditing();
}
