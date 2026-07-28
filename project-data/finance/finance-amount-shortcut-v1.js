(() => {
  const THOUSAND_MULTIPLIER = 1_000;
  const SHORT_INPUT_MAX = 9_999;
  const FINANCE_FORM_SELECTOR = "#finance-entry-form,.finance-ledger-composer";

  function normalizeAmountInput(value) {
    const text = String(value ?? "").trim();
    if (!text) return 0;
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount <= 0) return amount;
    return amount <= SHORT_INPUT_MAX ? amount * THOUSAND_MULTIPLIER : amount;
  }

  function amountInputDisplayValue(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return "";
    if (Number.isInteger(amount / THOUSAND_MULTIPLIER) && amount / THOUSAND_MULTIPLIER <= SHORT_INPUT_MAX) {
      return String(amount / THOUSAND_MULTIPLIER);
    }
    return String(amount);
  }

  const api = Object.freeze({ normalizeAmountInput, amountInputDisplayValue });
  window.JoyFinanceAmountShortcuts = api;
  if (typeof document === "undefined") return;

  function formatVndPreview(value) {
    const amount = normalizeAmountInput(value);
    if (!Number.isFinite(amount) || amount <= 0) return "Enter 50 for 50.000 ₫";
    return `Will save as ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)} ₫`;
  }

  function previewForInput(input) {
    const container = input.closest("label") || input.parentElement;
    if (!container) return null;
    let preview = container.querySelector("[data-finance-amount-preview]");
    if (!preview) {
      preview = document.createElement("small");
      preview.dataset.financeAmountPreview = "true";
      preview.className = "finance-amount-shortcut-preview";
      container.append(preview);
    }
    return preview;
  }

  function prepareAmountInput(input) {
    if (!(input instanceof HTMLInputElement) || input.name !== "amount") return;
    input.step = "1";
    input.min = "1";
    input.placeholder = "50 = 50.000 ₫";
    if (input.dataset.financeAmountShortcutReady === "true") return;
    input.dataset.financeAmountShortcutReady = "true";

    const preview = previewForInput(input);
    const updatePreview = () => {
      if (preview) preview.textContent = formatVndPreview(input.value);
    };
    input.addEventListener("input", updatePreview);
    updatePreview();
  }

  function normalizeFormAmount(form) {
    if (!(form instanceof HTMLFormElement) || !form.matches(FINANCE_FORM_SELECTOR)) return false;
    const input = form.elements.amount;
    if (!(input instanceof HTMLInputElement)) return false;
    prepareAmountInput(input);
    const normalized = normalizeAmountInput(input.value);
    if (!Number.isFinite(normalized) || normalized <= 0) return false;
    input.value = String(normalized);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function prepareAllAmountInputs(root = document) {
    root.querySelectorAll?.('input[name="amount"]').forEach(prepareAmountInput);
  }

  function shortenEditAmount() {
    const modal = document.querySelector("#finance-entry-modal");
    if (!modal || modal.hidden) return;
    const input = modal.querySelector('input[name="amount"]');
    if (!input || !input.value) return;
    input.value = amountInputDisplayValue(input.value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  document.addEventListener("pointerdown", (event) => {
    const submitter = event.target.closest?.('button[type="submit"],input[type="submit"]');
    if (submitter?.form) normalizeFormAmount(submitter.form);
  }, true);

  document.addEventListener("click", (event) => {
    const submitter = event.target.closest?.('button[type="submit"],input[type="submit"]');
    if (submitter?.form) normalizeFormAmount(submitter.form);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "amount") return;
    if (input.form?.matches(FINANCE_FORM_SELECTOR)) normalizeFormAmount(input.form);
  }, true);

  document.addEventListener("invalid", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "amount") return;
    if (!input.form?.matches(FINANCE_FORM_SELECTOR)) return;
    prepareAmountInput(input);
    const normalized = normalizeAmountInput(input.value);
    if (!Number.isFinite(normalized) || normalized <= 0) return;
    event.preventDefault();
    input.value = String(normalized);
    if (input.dataset.financeValidationRetry === "true") return;
    input.dataset.financeValidationRetry = "true";
    window.setTimeout(() => {
      delete input.dataset.financeValidationRetry;
      input.form?.requestSubmit();
    }, 0);
  }, true);

  document.addEventListener("submit", (event) => {
    normalizeFormAmount(event.target);
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('input[name="amount"]')) prepareAmountInput(node);
        prepareAllAmountInputs(node);
      });
      if (mutation.type === "attributes" && mutation.target.id === "finance-entry-modal") {
        window.setTimeout(shortenEditAmount, 0);
      }
    }
  });

  prepareAllAmountInputs();
  const modal = document.querySelector("#finance-entry-modal");
  if (modal) observer.observe(modal, { attributes: true, attributeFilter: ["hidden"], childList: true, subtree: true });
  observer.observe(document.body, { childList: true, subtree: true });
})();