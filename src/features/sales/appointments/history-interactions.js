import { saleApi } from "../shared/api.js";
import { saleText } from "../shared/i18n.js";

const HISTORY_CONTENT_SELECTOR = "#sales-history-content";
const COMMISSION_ENDPOINT = "/api/sales/viewings/commission";
const VALID_COMMISSION_STATES = new Set(["pending", "received"]);

let commissionStates = new Map();
let syncPromise = null;
let observer = null;

function installStyles() {
  if (document.querySelector('link[data-sale-history-interactions-style="true"]')) return;
  const moduleUrl = new URL(import.meta.url);
  const stylesheetUrl = new URL("./history-interactions.css", moduleUrl);
  stylesheetUrl.search = moduleUrl.search;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = stylesheetUrl.href;
  link.dataset.saleHistoryInteractionsStyle = "true";
  document.head.append(link);
}

function historyContent() {
  return document.querySelector(HISTORY_CONTENT_SELECTOR);
}

function displayRows() {
  return [...(historyContent()?.querySelectorAll(".sales-history-table tbody tr:not(.sales-history-edit-row)") || [])];
}

function findDisplayRow(viewingId) {
  return displayRows().find((row) => String(row.dataset.viewingId || "") === String(viewingId || "")) || null;
}

function commissionState(viewingId) {
  return commissionStates.get(String(viewingId || "")) || "none";
}

function makeEditCloseButton(row) {
  const controls = row.querySelector(".sales-history-edit-controls");
  if (!controls || controls.querySelector("[data-history-ux-close]")) return;
  const viewingId = String(row.dataset.viewingId || "");
  if (!viewingId) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "sales-history-close-button sales-history-ux-close-button";
  button.dataset.historyUxClose = "true";
  button.dataset.viewingId = viewingId;
  button.textContent = saleText("saleAssistant.closeDealTitle", "Close deal");
  button.title = saleText("saleAssistant.closeDealHelp", "Close this deal.");

  const saveButton = controls.querySelector('[data-history-action="save"]');
  controls.insertBefore(button, saveButton || controls.querySelector(".sales-history-edit-message") || null);
}

function removePendingAction(row) {
  delete row.dataset.commissionActionOpen;
  row.querySelector(".sales-history-commission-button")?.remove();
}

function decorateDisplayRow(row) {
  const viewingId = String(row.dataset.viewingId || "");
  const state = commissionState(viewingId);

  if (!VALID_COMMISSION_STATES.has(state)) {
    delete row.dataset.commissionState;
    delete row.dataset.commissionInteractive;
    removePendingAction(row);
    return;
  }

  row.dataset.commissionState = state;
  if (state === "pending") {
    row.dataset.commissionInteractive = "true";
    row.tabIndex = 0;
    row.setAttribute(
      "aria-label",
      saleText(
        "saleAssistant.commissionPendingAria",
        "Deal closed. Commission pending. Double-click or press Enter to confirm commission received.",
      ),
    );
    return;
  }

  delete row.dataset.commissionInteractive;
  removePendingAction(row);
  row.tabIndex = -1;
  row.setAttribute(
    "aria-label",
    saleText("saleAssistant.commissionReceivedAria", "Deal closed. Commission received."),
  );
}

function decorateHistory() {
  const content = historyContent();
  if (!content) return;
  content.querySelectorAll(".sales-history-edit-row").forEach(makeEditCloseButton);
  displayRows().forEach(decorateDisplayRow);
}

async function syncCommissionStates() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    try {
      const payload = await saleApi(COMMISSION_ENDPOINT);
      const next = new Map();
      (Array.isArray(payload.states) ? payload.states : []).forEach((item) => {
        const viewingId = String(item?.viewingId || "");
        const state = String(item?.state || "");
        if (viewingId && VALID_COMMISSION_STATES.has(state)) next.set(viewingId, state);
      });
      commissionStates = next;
      decorateHistory();
      return true;
    } catch {
      return false;
    } finally {
      syncPromise = null;
    }
  })();
  return syncPromise;
}

function requestCloseDealFromEdit(button) {
  const viewingId = String(button?.dataset.viewingId || "");
  if (!viewingId || button.disabled) return;
  button.disabled = true;

  const leave = new CustomEvent("joy:sale-history-leave-request", { cancelable: true });
  window.dispatchEvent(leave);
  if (leave.defaultPrevented) {
    button.disabled = false;
    return;
  }

  window.setTimeout(() => {
    const row = findDisplayRow(viewingId);
    const closeButton = row?.querySelector('[data-history-action="close-deal"], [data-history-action="review-deal"]');
    if (closeButton && !closeButton.disabled) closeButton.click();
  }, 0);
}

function revealPendingCommissionAction(row) {
  if (!row || commissionState(row.dataset.viewingId) !== "pending") return;
  const actionCell = row.querySelector(".sales-history-actions-cell");
  if (!actionCell) return;

  row.dataset.commissionActionOpen = "true";
  let button = actionCell.querySelector(".sales-history-commission-button");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "sales-history-commission-button";
    button.dataset.viewingId = String(row.dataset.viewingId || "");
    actionCell.append(button);
  }
  button.textContent = saleText("saleAssistant.closeDealTitle", "Close deal");
  button.title = saleText(
    "saleAssistant.commissionPendingHelp",
    "The deal is closed but commission is still pending. Confirm again when commission is received.",
  );
  button.focus();
}

async function markCommissionReceived(button) {
  const viewingId = String(button?.dataset.viewingId || "");
  if (!viewingId || commissionState(viewingId) !== "pending" || button.disabled) return;
  button.disabled = true;
  const previousLabel = button.textContent;
  button.textContent = saleText("saleAssistant.updatingCommission", "Updating…");

  try {
    const payload = await saleApi(COMMISSION_ENDPOINT, {
      method: "PATCH",
      body: { id: viewingId },
    });
    const state = String(payload.state || "");
    if (VALID_COMMISSION_STATES.has(state)) commissionStates.set(viewingId, state);
    decorateHistory();
    window.dispatchEvent(new CustomEvent("joy:sales-changed", { detail: { kind: "commission-received" } }));
  } catch {
    button.disabled = false;
    button.textContent = previousLabel;
    button.title = saleText("saleAssistant.commissionUpdateFailed", "Could not update commission. Try again.");
  }
}

function installHistoryInteractions() {
  if (!document.body || document.body.dataset.saleHistoryInteractionsInstalled === "true") return;
  const content = historyContent();
  if (!content) return;
  document.body.dataset.saleHistoryInteractionsInstalled = "true";
  installStyles();

  content.addEventListener("click", (event) => {
    const editClose = event.target.closest?.("[data-history-ux-close]");
    if (editClose) {
      event.preventDefault();
      requestCloseDealFromEdit(editClose);
      return;
    }
    const commissionButton = event.target.closest?.(".sales-history-commission-button");
    if (commissionButton) {
      event.preventDefault();
      void markCommissionReceived(commissionButton);
      return;
    }
    if (!window.matchMedia?.("(pointer: coarse)")?.matches) return;
    if (event.target.closest?.("button, input, a, select, textarea")) return;
    const row = event.target.closest?.(".sales-history-table tbody tr:not(.sales-history-edit-row)");
    if (row?.dataset.commissionState === "pending") revealPendingCommissionAction(row);
  });

  content.addEventListener("dblclick", (event) => {
    if (event.target.closest?.("button, input, a, select, textarea")) return;
    const row = event.target.closest?.(".sales-history-table tbody tr:not(.sales-history-edit-row)");
    if (row?.dataset.commissionState !== "pending") return;
    event.preventDefault();
    revealPendingCommissionAction(row);
  });

  content.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const row = event.target.closest?.(".sales-history-table tbody tr:not(.sales-history-edit-row)");
    if (!row || event.target !== row || row.dataset.commissionState !== "pending") return;
    event.preventDefault();
    revealPendingCommissionAction(row);
  });

  observer?.disconnect();
  observer = new MutationObserver(decorateHistory);
  observer.observe(content, { childList: true, subtree: true });

  window.addEventListener("joy:sale-history-open", () => void syncCommissionStates());
  window.addEventListener("joy:sales-changed", () => void syncCommissionStates());
  window.addEventListener("joy:locale-changed", decorateHistory);
  window.addEventListener("joy:i18n-ready", decorateHistory);

  decorateHistory();
  void syncCommissionStates();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installHistoryInteractions, { once: true });
} else {
  installHistoryInteractions();
}
