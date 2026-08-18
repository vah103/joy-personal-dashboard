const HISTORY_CONTENT_SELECTOR = "#sales-history-content";
const EDIT_CONTROL_SELECTOR = '[data-action="edit-sale-viewing"]';
const COMMISSION_ENDPOINT = "/api/sales/viewings/commission";
const CLOSE_DEAL_DRAFT_KEY = "joy:sale-close-manager-draft";

let commissionStates = new Map();
let commissionSyncPromise = null;

export function viewingIdForRow(row) {
  return String(
    row?.dataset.viewingId
    || row?.querySelector(EDIT_CONTROL_SELECTOR)?.dataset.viewingId
    || "",
  ).trim();
}

export function commissionStateForRow(row) {
  return commissionStates.get(viewingIdForRow(row)) || "none";
}

export function applyCommissionState(row) {
  const state = commissionStateForRow(row);
  row.dataset.commissionState = state;
  const button = row.querySelector(".sales-history-close-button");
  if (!button) return;
  button.dataset.commissionState = state;
  button.disabled = state === "received";
  button.title = state === "pending"
    ? "Closed, commission not received yet. Press again when payment is received."
    : state === "received"
      ? "Commission received."
      : "Close this deal in Sale Manager.";
}

export async function syncCommissionStates(onSynced) {
  if (commissionSyncPromise) return commissionSyncPromise;
  commissionSyncPromise = (async () => {
    try {
      const response = await fetch(COMMISSION_ENDPOINT, { credentials: "same-origin" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "VIEWING_COMMISSION_LOAD_FAILED");
      commissionStates = new Map(
        (Array.isArray(payload.states) ? payload.states : [])
          .filter((item) => item?.viewingId && ["pending", "received"].includes(item.state))
          .map((item) => [String(item.viewingId), item.state]),
      );
      const content = document.querySelector(HISTORY_CONTENT_SELECTOR);
      if (content) onSynced?.(content);
    } catch {
      // Commission color is helpful metadata; history remains usable if it cannot load.
    } finally {
      commissionSyncPromise = null;
    }
  })();
  return commissionSyncPromise;
}

export function forgetCommissionState(id) {
  commissionStates.delete(String(id || ""));
}

function closeDealDraftForRow(row) {
  const viewingId = viewingIdForRow(row);
  if (!viewingId) return null;
  const value = (field) => row.querySelector(`[data-history-field="${field}"]`)?.value.trim() || "";
  const viewingTime = value("viewingTime");
  return {
    viewingId,
    customer: value("customerName"),
    phone: value("phone"),
    address: value("viewingAddress"),
    month: /^2026-\d{2}/.test(viewingTime) ? viewingTime.slice(0, 7) : "",
  };
}

function openCloseDealInManager(row, setMessage) {
  const draft = closeDealDraftForRow(row);
  if (!draft) return false;
  try {
    window.sessionStorage.setItem(CLOSE_DEAL_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    return false;
  }
  setMessage(row, "Opening Sale Manager…");
  window.location.assign("/sale-manager.html");
  return true;
}

async function advanceCommissionState(row, button, setMessage) {
  const id = viewingIdForRow(row);
  if (!id || commissionStateForRow(row) === "received") return;

  button.disabled = true;
  setMessage(row, "Updating deal status…");

  try {
    const response = await fetch(COMMISSION_ENDPOINT, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "VIEWING_COMMISSION_UPDATE_FAILED");

    const state = ["pending", "received"].includes(payload.state) ? payload.state : "none";
    if (state === "none") throw new Error("VIEWING_COMMISSION_STATE_INVALID");
    commissionStates.set(id, state);
    applyCommissionState(row);
    setMessage(
      row,
      state === "pending"
        ? "Closed · commission pending."
        : "Commission received.",
    );
  } catch {
    button.disabled = false;
    setMessage(row, "Could not update the deal status. Please try again.");
  }
}

export function handleCloseDeal(row, button, setMessage) {
  if (commissionStateForRow(row) === "none") {
    if (!openCloseDealInManager(row, setMessage)) {
      setMessage(row, "Could not open Sale Manager. Please try again.");
    }
    return;
  }
  void advanceCommissionState(row, button, setMessage);
}
