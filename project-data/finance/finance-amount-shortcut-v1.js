(() => {
  const THOUSAND_MULTIPLIER = 1_000;
  const SHORT_INPUT_MAX = 9_999;

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

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches("#finance-entry-form,.finance-ledger-composer")) return;
    const input = form.elements.amount;
    if (!(input instanceof HTMLInputElement)) return;
    const normalized = normalizeAmountInput(input.value);
    if (Number.isFinite(normalized) && normalized > 0) input.value = String(normalized);
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
