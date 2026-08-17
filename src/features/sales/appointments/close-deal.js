import { saleApi } from "../shared/api.js";
import { formatVnd, vietnamMonthKey } from "../shared/format.js";
import { saleText, translateSaleUiRoot } from "../shared/i18n.js";

const CLOSE_DEAL_ENDPOINT = "/api/sales/viewings/close-deal";
const CLOSE_DEAL_REVIEW_ENDPOINT = "/api/sales/viewings/close-deal/review";
export const DEAL_LOCK_REVIEW_MS = 2 * 60 * 1000;

export function dealSavingNeedsReview(viewing) {
  if (!viewing?.dealSaving || !viewing.dealSavingSince) return false;
  const lockedAt = new Date(viewing.dealSavingSince).getTime();
  return Number.isFinite(lockedAt) && Date.now() - lockedAt >= DEAL_LOCK_REVIEW_MS;
}

const CLOSE_DEAL_ERROR_KEYS = Object.freeze({
  VIEWING_ALREADY_CLOSED: ["saleAssistant.errorViewingClosed", "Deal đã được lưu. Lịch hẹn này không thể sửa hoặc xóa nữa."],
  SALE_DEAL_SAVE_IN_PROGRESS: ["saleAssistant.dealSaveProgressHelp", "Deal đang được lưu. Hãy chờ trạng thái cập nhật."],
  SALE_DEAL_SAVE_REVIEW_REQUIRED: ["saleAssistant.reviewResolveHelp", "Trạng thái lưu deal cần được kiểm tra trước khi thao tác tiếp."],
  SALE_DEAL_CREATE_FAILED: ["saleAssistant.dealSaveFailed", "Could not save the deal. Please try again."],
  SHEETS_WRITE_AUTHORIZATION_REQUIRED: ["saleAssistant.reconnectGoogle", "Reconnect Google before saving the deal."],
  SHEETS_WRITE_ACCESS_DENIED: ["saleAssistant.sheetWriteDenied", "Joy does not have permission to save this deal."],
  AUTH_REQUIRED: ["saleAssistant.errorAuthRequired", "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại Joy."],
});

function closeDealErrorMessage(code) {
  const [key, fallback] = CLOSE_DEAL_ERROR_KEYS[code] || ["saleAssistant.dealSaveFailed", "Could not save the deal. Please try again."];
  return saleText(key, fallback);
}

function reviewErrorMessage(code) {
  const [key, fallback] = CLOSE_DEAL_ERROR_KEYS[code] || ["saleAssistant.reviewFailed", "Could not resolve the deal review. Please try again."];
  return saleText(key, fallback);
}

function modalHtml() {
  return `
    <section class="sale-close-deal-modal" role="dialog" aria-modal="true" aria-labelledby="sale-close-deal-title">
      <div class="sale-close-deal-heading">
        <div><small>Sale Manager</small><h2 id="sale-close-deal-title">${saleText("saleAssistant.closeDealTitle", "Close deal")}</h2></div>
        <button type="button" aria-label="Close form" data-history-action="close-deal-form">×</button>
      </div>
      <form id="sale-close-deal-form">
        <input name="viewingId" type="hidden">
        <div class="sale-close-deal-grid">
          <label><span>${saleText("saleAssistant.customer", "Customer")}</span><input name="customer" type="text" maxlength="120" required></label>
          <label><span>${saleText("saleAssistant.phone", "Phone")}</span><input name="phone" type="tel" maxlength="30" inputmode="tel"></label>
          <label class="wide"><span>${saleText("saleAssistant.address", "Address")}</span><input name="address" type="text" maxlength="180" required></label>
          <label><span>${saleText("saleAssistant.host", "Host")}</span><input name="host" type="text" maxlength="120"></label>
          <label><span>${saleText("saleAssistant.roomPrice", "Room price")}</span><input name="rent" type="number" min="1" max="1000000000" step="1" inputmode="numeric" required></label>
          <label><span>${saleText("saleAssistant.commissionRate", "Commission rate (%)")}</span><input name="rate" type="number" min="0.01" max="100" step="0.01" inputmode="decimal" required></label>
        </div>
        <div class="sale-close-deal-preview"><span>${saleText("saleAssistant.calculatedCommission", "Calculated commission")}</span><strong>0 ₫</strong></div>
        <p class="sale-close-deal-status" hidden></p>
        <div class="sale-close-deal-actions">
          <button class="secondary-button" type="button" data-history-action="close-deal-form">${saleText("saleAssistant.cancel", "Cancel")}</button>
          <button class="primary-button" type="submit">${saleText("saleAssistant.saveDeal", "Save deal")}</button>
        </div>
      </form>
      <section class="sale-close-deal-review" id="sale-close-deal-review" hidden>
        <p>${saleText("saleAssistant.reviewExplanation", "Joy could not confirm whether Google Sheets saved this deal. Check Sale Manager, then choose the matching result below.")}</p>
        <p class="sale-close-deal-review-customer"></p>
        <p class="sale-close-deal-review-status" hidden></p>
        <div class="sale-close-deal-actions">
          <a class="secondary-button" href="/sale-manager.html" target="_blank" rel="noopener">${saleText("saleAssistant.openManager", "Open Sale Manager")}</a>
          <button class="secondary-button" type="button" data-history-action="review-deal-retry">${saleText("saleAssistant.retryMissingDeal", "Deal missing · Retry")}</button>
          <button class="primary-button" type="button" data-history-action="review-deal-saved">${saleText("saleAssistant.markExistingDeal", "Deal exists · Mark saved")}</button>
        </div>
      </section>
    </section>
  `;
}

export function createCloseDealController({
  getViewing,
  prepareOpen,
  refreshHistory,
  recoverViewingState,
  markReviewRequired,
  applyReviewResolution,
  emitSalesChanged,
}) {
  const state = {
    saving: false,
    dirty: false,
    saveSeq: 0,
    reviewSaving: false,
    reviewSeq: 0,
    installed: false,
  };

  const ensureModal = () => {
    let modal = document.querySelector("#sale-close-deal-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "modal-backdrop sale-close-deal-backdrop";
    modal.id = "sale-close-deal-modal";
    modal.hidden = true;
    modal.innerHTML = modalHtml();
    document.body.append(modal);
    translateSaleUiRoot(modal);
    return modal;
  };

  const updatePreview = () => {
    const form = document.querySelector("#sale-close-deal-form");
    const preview = document.querySelector(".sale-close-deal-preview strong");
    if (!form || !preview) return;
    const rent = Number(form.elements.rent.value || 0);
    const rate = Number(form.elements.rate.value || 0) / 100;
    preview.textContent = formatVnd(Math.round(rent * rate));
  };

  const setSaveBusy = (busy) => {
    const modal = ensureModal();
    const form = modal.querySelector("#sale-close-deal-form");
    form?.querySelectorAll("input, button").forEach((control) => { control.disabled = busy; });
    const close = modal.querySelector('.sale-close-deal-heading [data-history-action="close-deal-form"]');
    if (close) close.disabled = busy || state.reviewSaving;
  };

  const setReviewBusy = (busy) => {
    const modal = ensureModal();
    modal.querySelector("#sale-close-deal-review")?.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
    const close = modal.querySelector('.sale-close-deal-heading [data-history-action="close-deal-form"]');
    if (close) close.disabled = busy || state.saving;
  };

  const close = ({ force = false } = {}) => {
    if (!force && (state.saving || state.reviewSaving)) return false;
    const modal = document.querySelector("#sale-close-deal-modal");
    if (!modal) return true;
    const form = modal.querySelector("#sale-close-deal-form");
    if (!force && form?.hidden === false && state.dirty
      && !window.confirm(saleText("saleAssistant.discardDealChanges", "Discard unsaved deal changes?"))) return false;
    state.dirty = false;
    modal.hidden = true;
    const assistantVisible = document.querySelector("#sales-assistant-modal")?.hidden === false;
    if (!assistantVisible) document.body.classList.remove("modal-open");
    return true;
  };

  const open = (id, { message = "" } = {}) => {
    if (state.saving || state.reviewSaving || !prepareOpen(id)) return;
    const viewing = getViewing(id);
    if (!viewing || viewing.dealSaved || viewing.dealSaving) return;
    const modal = ensureModal();
    const form = modal.querySelector("#sale-close-deal-form");
    const review = modal.querySelector("#sale-close-deal-review");
    if (!form || !review) return;
    form.hidden = false;
    review.hidden = true;
    form.reset();
    form.elements.viewingId.value = viewing.id;
    form.elements.customer.value = viewing.customerName || "";
    form.elements.phone.value = viewing.phone || "";
    form.elements.address.value = viewing.viewingAddress || "";
    state.dirty = false;
    const status = modal.querySelector(".sale-close-deal-status");
    if (status) {
      status.textContent = message;
      status.hidden = !message;
    }
    const title = modal.querySelector("#sale-close-deal-title");
    if (title) title.textContent = saleText("saleAssistant.closeDealTitle", "Close deal");
    updatePreview();
    modal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => form.elements.rent.focus(), 0);
  };

  const openReview = (id) => {
    if (state.saving || state.reviewSaving || !prepareOpen(id)) return;
    const viewing = getViewing(id);
    if (!viewing || viewing.dealSaved || !dealSavingNeedsReview(viewing)) return;
    const modal = ensureModal();
    const form = modal.querySelector("#sale-close-deal-form");
    const review = modal.querySelector("#sale-close-deal-review");
    if (!form || !review) return;
    state.dirty = false;
    form.hidden = true;
    review.hidden = false;
    review.dataset.viewingId = viewing.id;
    const customer = review.querySelector(".sale-close-deal-review-customer");
    if (customer) customer.textContent = `${viewing.customerName || saleText("saleAssistant.customer", "Customer")} · ${viewing.viewingAddress || "—"}`;
    const status = review.querySelector(".sale-close-deal-review-status");
    if (status) { status.textContent = ""; status.hidden = true; }
    const title = modal.querySelector("#sale-close-deal-title");
    if (title) title.textContent = saleText("saleAssistant.reviewDealSave", "Review deal save");
    modal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => review.querySelector('[data-history-action="review-deal-saved"]')?.focus(), 0);
    translateSaleUiRoot(modal);
  };

  const save = async (event) => {
    event.preventDefault();
    if (state.saving || state.reviewSaving) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const modal = ensureModal();
    const status = modal.querySelector(".sale-close-deal-status");
    const saveButton = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const viewingId = String(data.get("viewingId") || "").trim();
    const viewing = getViewing(viewingId);
    if (!viewing || viewing.dealSaved || viewing.dealSaving) {
      state.dirty = false;
      close({ force: true });
      return;
    }
    const payload = {
      viewingId,
      month: vietnamMonthKey(),
      customer: String(data.get("customer") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      address: String(data.get("address") || "").trim(),
      host: String(data.get("host") || "").trim(),
      rent: Number(data.get("rent") || 0),
      rate: Number(data.get("rate") || 0),
    };
    const operationId = ++state.saveSeq;
    state.saving = true;
    setSaveBusy(true);
    if (saveButton) saveButton.textContent = saleText("saleAssistant.savingDeal", "Saving deal…");
    if (status) status.hidden = true;

    try {
      await saleApi(CLOSE_DEAL_ENDPOINT, { method: "POST", body: payload });
      if (operationId !== state.saveSeq) return;
      state.dirty = false;
      await refreshHistory();
      state.saving = false;
      setSaveBusy(false);
      close({ force: true });
      window.dispatchEvent(new CustomEvent("joy:sale-deal-saved"));
      emitSalesChanged("deal-saved");
    } catch (error) {
      if (operationId !== state.saveSeq) return;
      if (error.code === "SALE_DEAL_SAVE_REVIEW_REQUIRED") {
        state.dirty = false;
        markReviewRequired(viewingId);
        await refreshHistory();
        state.saving = false;
        setSaveBusy(false);
        openReview(viewingId);
        return;
      }
      if (await recoverViewingState(error.code)) {
        state.dirty = false;
        state.saving = false;
        setSaveBusy(false);
        close({ force: true });
        return;
      }
      if (status) {
        status.textContent = closeDealErrorMessage(error.code);
        status.hidden = false;
        translateSaleUiRoot(modal);
      }
    } finally {
      if (operationId === state.saveSeq && state.saving) {
        state.saving = false;
        setSaveBusy(false);
      }
      if (saveButton) saveButton.textContent = saleText("saleAssistant.saveDeal", "Save deal");
    }
  };

  const resolveReview = async (resolution) => {
    if (state.saving || state.reviewSaving) return;
    const modal = ensureModal();
    const review = modal.querySelector("#sale-close-deal-review");
    const viewingId = String(review?.dataset.viewingId || "");
    const viewing = getViewing(viewingId);
    if (!review || !viewingId || !viewing || !["saved", "retry"].includes(resolution)) return;
    const status = review.querySelector(".sale-close-deal-review-status");
    const operationId = ++state.reviewSeq;
    state.reviewSaving = true;
    setReviewBusy(true);
    if (status) {
      status.textContent = resolution === "saved"
        ? saleText("saleAssistant.confirmingSavedDeal", "Confirming saved deal…")
        : saleText("saleAssistant.preparingRetry", "Preparing a safe retry…");
      status.hidden = false;
    }

    try {
      await saleApi(CLOSE_DEAL_REVIEW_ENDPOINT, { method: "PATCH", body: { viewingId, resolution } });
      if (operationId !== state.reviewSeq) return;
      applyReviewResolution(viewingId, resolution);
      state.reviewSaving = false;
      setReviewBusy(false);
      close({ force: true });
      void refreshHistory();
      if (resolution === "saved") {
        window.dispatchEvent(new CustomEvent("joy:sale-deal-saved"));
        emitSalesChanged("deal-review-saved");
      } else {
        emitSalesChanged("deal-review-retry");
        open(viewingId, { message: saleText("saleAssistant.retryReady", "Review cleared. Enter the deal details and save again.") });
      }
    } catch (error) {
      if (operationId !== state.reviewSeq) return;
      if (status) {
        status.textContent = reviewErrorMessage(error.code);
        status.hidden = false;
        translateSaleUiRoot(modal);
      }
    } finally {
      if (operationId === state.reviewSeq && state.reviewSaving) {
        state.reviewSaving = false;
        setReviewBusy(false);
      }
    }
  };

  const install = () => {
    const modal = ensureModal();
    if (state.installed) return;
    state.installed = true;
    const form = modal.querySelector("#sale-close-deal-form");
    form?.elements.rent.addEventListener("input", updatePreview);
    form?.elements.rate.addEventListener("input", updatePreview);
    form?.addEventListener("input", () => { if (!state.saving && !form.hidden) state.dirty = true; });
    form?.addEventListener("change", () => { if (!state.saving && !form.hidden) state.dirty = true; });
    form?.addEventListener("submit", save);
    modal.addEventListener("mousedown", (event) => { if (event.target === modal) close(); });
    document.addEventListener("click", (event) => {
      const action = event.target.closest?.("[data-history-action]")?.dataset.historyAction;
      if (action === "close-deal-form") close();
      if (action === "review-deal-saved") void resolveReview("saved");
      if (action === "review-deal-retry"
        && window.confirm(saleText("saleAssistant.confirmRetry", "Only retry if the deal is not present in Sale Manager. Continue?"))) {
        void resolveReview("retry");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal.hidden === false) close();
    });
    const translate = () => translateSaleUiRoot(modal);
    window.addEventListener("joy:i18n-ready", translate);
    window.addEventListener("joy:locale-changed", translate);
  };

  return { install, open, openReview, close };
}
