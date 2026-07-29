(() => {
  const SHORT_THOUSAND_MAX = 9_999;
  const THOUSAND = 1_000;
  const AMOUNT_INPUT_SELECTOR = 'input[name="amount"]';

  function digitsOnly(value) {
    const text = String(value ?? "").trim();
    if (!text || !/^[0-9.,\s]+$/.test(text)) return "";
    return text.replace(/[^0-9]/g, "");
  }

  function parseFinanceAmount(value) {
    const digits = digitsOnly(value);
    if (!digits) return NaN;
    const amount = Number(digits);
    if (!Number.isSafeInteger(amount) || amount <= 0) return NaN;
    return amount <= SHORT_THOUSAND_MAX ? amount * THOUSAND : amount;
  }

  function financeAmountInputValue(value) {
    const amount = Number(value || 0);
    if (!Number.isSafeInteger(amount) || amount <= 0) return "";
    const shortValue = amount / THOUSAND;
    if (Number.isInteger(shortValue) && shortValue <= SHORT_THOUSAND_MAX) return String(shortValue);
    return String(amount);
  }

  function financeAmountPreview(value) {
    const amount = parseFinanceAmount(value);
    if (!Number.isFinite(amount)) return "Enter 50 for 50.000 ₫";
    return `Will save as ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)} ₫`;
  }

  const api = Object.freeze({ parseFinanceAmount, financeAmountInputValue, financeAmountPreview });
  window.JoyFinanceAmountPolicy = api;
  if (typeof document === "undefined") return;

  function previewElement(input) {
    const label = input.closest("label");
    if (!label) return null;
    let preview = label.querySelector("[data-finance-amount-preview]");
    if (!preview) {
      preview = document.createElement("small");
      preview.dataset.financeAmountPreview = "true";
      preview.className = "finance-amount-preview";
      label.append(preview);
    }
    return preview;
  }

  function updatePreview(input) {
    const preview = previewElement(input);
    if (preview) preview.textContent = financeAmountPreview(input.value);
  }

  function prepareAmountInput(input) {
    if (!(input instanceof HTMLInputElement) || input.name !== "amount") return;
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.removeAttribute("min");
    input.removeAttribute("max");
    input.removeAttribute("step");
    input.removeAttribute("pattern");
    input.placeholder = "50 = 50.000 ₫";
    if (input.dataset.financeAmountPolicy === "v3") {
      updatePreview(input);
      return;
    }
    input.dataset.financeAmountPolicy = "v3";
    input.addEventListener("input", () => updatePreview(input));
    updatePreview(input);
  }

  function prepareAmountInputs(root = document) {
    if (root.matches?.(AMOUNT_INPUT_SELECTOR)) prepareAmountInput(root);
    root.querySelectorAll?.(AMOUNT_INPUT_SELECTOR).forEach(prepareAmountInput);
  }

  function normalizeFormInput(form) {
    const input = form?.elements?.amount;
    if (!(input instanceof HTMLInputElement)) return { input: null, amount: NaN };
    prepareAmountInput(input);
    return { input, amount: parseFinanceAmount(input.value) };
  }

  const originalSaveInlineTransaction = typeof saveInlineTransaction === "function" ? saveInlineTransaction : null;
  if (originalSaveInlineTransaction) {
    saveInlineTransaction = async function saveInlineTransactionWithUnifiedAmount(event, item) {
      const form = event.currentTarget;
      const { input, amount } = normalizeFormInput(form);
      if (!Number.isFinite(amount)) {
        event.preventDefault();
        showInlineError(form.querySelector(".finance-ledger-error"), "Enter a valid amount.");
        input?.focus();
        return;
      }
      input.value = String(amount);
      const result = await originalSaveInlineTransaction(event, item);
      if (input.isConnected && !form.hidden) {
        input.value = financeAmountInputValue(input.value);
        updatePreview(input);
      }
      return result;
    };
  }

  const originalSaveFinanceTransaction = typeof saveFinanceTransaction === "function" ? saveFinanceTransaction : null;
  if (originalSaveFinanceTransaction) {
    saveFinanceTransaction = async function saveFinanceTransactionWithUnifiedAmount(event) {
      const form = event.currentTarget;
      const { input, amount } = normalizeFormInput(form);
      if (!Number.isFinite(amount)) {
        event.preventDefault();
        showFinanceToast("Enter a valid amount.");
        input?.focus();
        return;
      }
      input.value = String(amount);
      const result = await originalSaveFinanceTransaction(event);
      const modal = document.querySelector("#finance-entry-modal");
      if (input.isConnected && modal && !modal.hidden) {
        input.value = financeAmountInputValue(input.value);
        updatePreview(input);
      }
      return result;
    };

    const entryForm = document.querySelector("#finance-entry-form");
    if (entryForm) {
      entryForm.removeEventListener("submit", originalSaveFinanceTransaction);
      entryForm.addEventListener("submit", saveFinanceTransaction);
    }
  }

  const originalOpenEntryForm = typeof openEntryForm === "function" ? openEntryForm : null;
  if (originalOpenEntryForm) {
    openEntryForm = function openEntryFormWithUnifiedAmount(type = "expense", transaction = null) {
      originalOpenEntryForm(type, transaction);
      const input = document.querySelector("#finance-entry-form input[name='amount']");
      if (!input) return;
      prepareAmountInput(input);
      input.value = transaction?.amount ? financeAmountInputValue(transaction.amount) : "";
      updatePreview(input);
    };
  }

  const style = document.createElement("style");
  style.dataset.financeAmountPolicy = "v3";
  style.textContent = `
    .finance-amount-preview{display:block;margin-top:5px;color:#7c898c;font:700 8.5px "Nunito",Arial,sans-serif;letter-spacing:0;text-transform:none}
    .finance-ledger-composer .finance-amount-preview{grid-column:1/-1;margin:4px 0 0}
  `;
  document.head.append(style);

  prepareAmountInputs();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) prepareAmountInputs(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
