(() => {
  const SHORT_THOUSAND_MAX = 9_999;
  const THOUSAND = 1_000;
  const AMOUNT_INPUT_SELECTOR = 'input[name="amount"]';
  const FINANCE_FORM_SELECTOR = "#finance-entry-form,.finance-ledger-composer";

  function amountDigits(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (/^[0-9]+$/.test(text)) return text;
    if (/^[0-9]{1,3}(?:\.[0-9]{3})+$/.test(text)) return text.replaceAll(".", "");
    if (/^[0-9]{1,3}(?:,[0-9]{3})+$/.test(text)) return text.replaceAll(",", "");
    if (/^[0-9]{1,3}(?: [0-9]{3})+$/.test(text)) return text.replaceAll(" ", "");
    return "";
  }

  function parseFinanceAmount(value) {
    const digits = amountDigits(value);
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
    input.setCustomValidity("");

    if (input.dataset.financeAmountPolicy !== "v4") {
      input.dataset.financeAmountPolicy = "v4";
      input.addEventListener("input", () => {
        input.setCustomValidity("");
        updatePreview(input);
      });
    }
    updatePreview(input);
  }

  function prepareAmountInputs(root = document) {
    if (root.matches?.(AMOUNT_INPUT_SELECTOR)) prepareAmountInput(root);
    root.querySelectorAll?.(AMOUNT_INPUT_SELECTOR).forEach(prepareAmountInput);
  }

  function restoreShortValue(input, amount) {
    if (!input?.isConnected) return;
    input.value = financeAmountInputValue(amount);
    updatePreview(input);
  }

  function handleFinanceSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches(FINANCE_FORM_SELECTOR)) return;
    const input = form.elements.amount;
    if (!(input instanceof HTMLInputElement)) return;

    prepareAmountInput(input);
    const amount = parseFinanceAmount(input.value);
    if (!Number.isFinite(amount)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      input.setCustomValidity("Enter a valid amount.");
      input.reportValidity();
      input.focus();
      return;
    }

    input.setCustomValidity("");
    input.value = String(amount);
    queueMicrotask(() => restoreShortValue(input, amount));
  }

  function startObserver() {
    prepareAmountInputs();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) prepareAmountInputs(node);
        });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener("submit", handleFinanceSubmit, true);
  document.addEventListener("focusin", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "amount") return;
    prepareAmountInput(input);

    if (input.closest("#finance-entry-modal") && /^[0-9]+$/.test(input.value)) {
      const storedAmount = Number(input.value);
      if (Number.isSafeInteger(storedAmount) && storedAmount >= THOUSAND) {
        input.value = financeAmountInputValue(storedAmount);
        updatePreview(input);
      }
    }
  }, true);

  const style = document.createElement("style");
  style.dataset.financeAmountPolicy = "v4";
  style.textContent = `
    .finance-amount-preview{display:block;margin-top:5px;color:#7c898c;font:700 8.5px "Nunito",Arial,sans-serif;letter-spacing:0;text-transform:none}
    .finance-ledger-composer .finance-amount-preview{grid-column:1/-1;margin:4px 0 0}
  `;
  document.head.append(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  else startObserver();
})();
