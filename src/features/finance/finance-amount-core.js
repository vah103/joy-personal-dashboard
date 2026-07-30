export const FINANCE_SHORT_THOUSAND_MAX = 9_999;
export const FINANCE_THOUSAND = 1_000;

function financeAmountDigits(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^[0-9]+$/.test(text)) return text;
  if (/^[0-9]{1,3}(?:\.[0-9]{3})+$/.test(text)) return text.replaceAll(".", "");
  if (/^[0-9]{1,3}(?:,[0-9]{3})+$/.test(text)) return text.replaceAll(",", "");
  if (/^[0-9]{1,3}(?: [0-9]{3})+$/.test(text)) return text.replaceAll(" ", "");
  return "";
}

export function parseFinanceAmount(value) {
  const digits = financeAmountDigits(value);
  if (!digits) return NaN;

  const amount = Number(digits);
  if (!Number.isSafeInteger(amount) || amount <= 0) return NaN;

  return amount <= FINANCE_SHORT_THOUSAND_MAX
    ? amount * FINANCE_THOUSAND
    : amount;
}

export function financeAmountInputValue(value) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) return "";

  const shortValue = amount / FINANCE_THOUSAND;
  if (Number.isInteger(shortValue) && shortValue <= FINANCE_SHORT_THOUSAND_MAX) {
    return String(shortValue);
  }

  return String(amount);
}
