(() => {
  "use strict";

  const amountCore = globalThis.JoyFinanceAmount;
  if (!amountCore) return;

  const AMOUNT_SELECTOR = [
    "[data-p1008-service]",
    "[data-shopping-amount]",
    "[data-shopping-new-amount]",
  ].join(", ");

  function parseCommit(value) {
    const text = String(value ?? "").trim();
    if (!text || text === "0") return 0;
    const amount = amountCore.parse(text);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : Number.NaN;
  }

  function editValue(value) {
    return amountCore.inputValue(value);
  }

  function displayValue(value) {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) return "";
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);
  }

  globalThis.JoyP1008AmountInput = Object.freeze({ displayValue, editValue, parseCommit });
  if (typeof document === "undefined") return;

  function isAmountInput(target) {
    return target instanceof HTMLInputElement && target.matches(AMOUNT_SELECTOR);
  }

  function sanitizeDigits(input) {
    const value = String(input.value || "");
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const next = value.replace(/\D/g, "");
    if (next === value) return;

    const nextStart = value.slice(0, start).replace(/\D/g, "").length;
    const nextEnd = value.slice(0, end).replace(/\D/g, "").length;
    input.value = next;
    try {
      input.setSelectionRange(nextStart, nextEnd);
    } catch {
      // Some mobile keyboards do not expose a writable selection range.
    }
  }

  function prepareEdit(input) {
    const amount = parseCommit(input.value);
    if (Number.isSafeInteger(amount) && amount > 0) input.value = editValue(amount);
    input.title = "Nhập 570 để lưu 570.000 ₫";
    if (input.matches("[data-shopping-new-amount]")) input.placeholder = "570 = 570.000";
  }

  function prepareCommit(input) {
    const text = String(input.value || "").trim();
    if (!text) return true;

    const amount = parseCommit(text);
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    input.value = displayValue(amount);
    return true;
  }

  function decorate(root = document) {
    const inputs = [];
    if (root instanceof Element && root.matches(AMOUNT_SELECTOR)) inputs.push(root);
    root.querySelectorAll?.(AMOUNT_SELECTOR).forEach((input) => inputs.push(input));
    inputs.forEach((input) => {
      input.title = "Nhập 570 để lưu 570.000 ₫";
      if (input.matches("[data-shopping-new-amount]")) input.placeholder = "570 = 570.000";
    });
  }

  document.addEventListener("focus", (event) => {
    if (!isAmountInput(event.target)) return;
    prepareEdit(event.target);
  }, true);

  document.addEventListener("input", (event) => {
    if (!isAmountInput(event.target)) return;
    event.stopImmediatePropagation();
    sanitizeDigits(event.target);
    event.target.setCustomValidity("");
  }, true);

  document.addEventListener("blur", (event) => {
    if (!isAmountInput(event.target)) return;
    if (prepareCommit(event.target)) return;
    event.target.setCustomValidity("Chỉ nhập số. Ví dụ: 570 = 570.000 ₫");
  }, true);

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches("[data-shopping-form]")) return;
    const input = form.querySelector("[data-shopping-new-amount]");
    if (!input || prepareCommit(input)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    input.setCustomValidity("Chỉ nhập số. Ví dụ: 570 = 570.000 ₫");
    input.reportValidity();
    input.focus();
  }, true);

  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node instanceof Element) decorate(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorate();
})();
