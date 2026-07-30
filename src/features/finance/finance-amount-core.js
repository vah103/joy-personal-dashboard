(function registerJoyFinanceAmount(root) {
  const SHORT_THOUSAND_MAX = 9_999;
  const THOUSAND = 1_000;

  function amountDigits(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (/^[0-9]+$/.test(text)) return text;
    if (/^[0-9]{1,3}(?:\.[0-9]{3})+$/.test(text)) return text.replaceAll(".", "");
    if (/^[0-9]{1,3}(?:,[0-9]{3})+$/.test(text)) return text.replaceAll(",", "");
    if (/^[0-9]{1,3}(?: [0-9]{3})+$/.test(text)) return text.replaceAll(" ", "");
    return "";
  }

  function parse(value) {
    const digits = amountDigits(value);
    if (!digits) return NaN;

    const amount = Number(digits);
    if (!Number.isSafeInteger(amount) || amount <= 0) return NaN;

    return amount <= SHORT_THOUSAND_MAX
      ? amount * THOUSAND
      : amount;
  }

  function inputValue(value) {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) return "";

    const shortValue = amount / THOUSAND;
    if (Number.isInteger(shortValue) && shortValue <= SHORT_THOUSAND_MAX) {
      return String(shortValue);
    }

    return String(amount);
  }

  root.JoyFinanceAmount = Object.freeze({ inputValue, parse });
})(typeof window !== "undefined" ? window : globalThis);
