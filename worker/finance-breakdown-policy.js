export const FINANCE_BREAKDOWN_CUTOFF = "2026-08-01";
export const FINANCE_BREAKDOWN_IMPORT_KEY = "finance-breakdown-2026-v1";

export const FINANCE_SUBCATEGORIES = Object.freeze({
  home: Object.freeze(["Rent", "Services", "Household shopping", "Other home expense"]),
  meals: Object.freeze(["Home meals", "Eating out", "Reward after closing a room", "Other meals"]),
  transportation: Object.freeze(["Fuel", "Ride-hailing", "Other transportation"]),
  "hanging-out": Object.freeze(["Friends", "Family", "Other"]),
  haircare: Object.freeze(["Haircut", "Hair products", "Other haircare"]),
  "money-leaks": Object.freeze(["Snacks", "Random purchases", "Mistakes", "Lost money", "Other money leaks"]),
});

export const FINANCE_BREAKDOWN_SEED = Object.freeze([
  Object.freeze({
    id: "breakdown-2026-08-expense-home-services",
    occurredOn: "2026-08-28",
    month: 8,
    type: "expense",
    category: "home",
    subcategory: "Services",
    amount: 280_000,
    status: "planned",
    note: "Detailed plan migrated from Finance Tracker",
  }),
  Object.freeze({
    id: "breakdown-2026-08-expense-home-household-shopping",
    occurredOn: "2026-08-28",
    month: 8,
    type: "expense",
    category: "home",
    subcategory: "Household shopping",
    amount: 300_000,
    status: "planned",
    note: "Detailed plan migrated from Finance Tracker",
  }),
  Object.freeze({
    id: "breakdown-2026-08-expense-haircare-haircut",
    occurredOn: "2026-08-28",
    month: 8,
    type: "expense",
    category: "haircare",
    subcategory: "Haircut",
    amount: 150_000,
    status: "planned",
    note: "Detailed plan migrated from Finance Tracker",
  }),
  Object.freeze({
    id: "breakdown-2026-10-expense-home-rent",
    occurredOn: "2026-10-28",
    month: 10,
    type: "expense",
    category: "home",
    subcategory: "Rent",
    amount: 3_900_000,
    status: "planned",
    note: "Detailed plan migrated from Finance Tracker",
  }),
]);

export const FINANCE_BREAKDOWN_REPLACED_IDS = Object.freeze([
  "sheet-2026-08-expense-home",
  "sheet-2026-08-expense-haircare",
  "sheet-2026-10-expense-home",
]);

export function isDetailedFinanceDate(value) {
  const date = String(value || "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)
    && date >= FINANCE_BREAKDOWN_CUTOFF;
}

export function validateFinanceBreakdownPayload(body) {
  const source = body && typeof body === "object" ? body : {};
  const type = cleanText(source.type).toLowerCase();
  const category = cleanText(source.category).toLowerCase();
  const subcategory = cleanText(source.subcategory);
  const occurredOn = cleanText(source.occurred_on || source.date);

  if (type !== "expense") return "";

  const allowed = FINANCE_SUBCATEGORIES[category];
  if (!allowed) return subcategory ? "FINANCE_SUBCATEGORY_INVALID" : "";
  if (!subcategory) return isDetailedFinanceDate(occurredOn) ? "FINANCE_SUBCATEGORY_REQUIRED" : "";
  return allowed.includes(subcategory) ? "" : "FINANCE_SUBCATEGORY_INVALID";
}

export function financeBreakdownSeedTotals() {
  return FINANCE_BREAKDOWN_SEED.reduce((totals, transaction) => {
    const key = `${transaction.month}:${transaction.category}`;
    totals[key] = Number(totals[key] || 0) + Number(transaction.amount || 0);
    return totals;
  }, {});
}

function cleanText(value) {
  return String(value ?? "").trim();
}
