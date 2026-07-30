import { isSameOrigin, json, readJson } from "./shared/http.js";
import { readCookies, sha256Hex } from "./shared/session.js";

const SESSION_COOKIE = "__Host-joy_session";
const DEFAULT_YEAR = 2026;
const MAX_AMOUNT = 10_000_000_000;

export const FINANCE_CATEGORIES = {
  income: [
    { id: "sale", label: "Sale", subcategories: [] },
    { id: "allowance", label: "Allowance", subcategories: [] },
    { id: "carryover", label: "Carryover", subcategories: [] },
    { id: "other-income", label: "Other income", subcategories: [] },
  ],
  expense: [
    { id: "home", label: "House", subcategories: ["Rent", "Services", "Household shopping", "Other home expense"] },
    { id: "meals", label: "Meals", subcategories: ["Home meals", "Eating out", "Reward after closing a room", "Other meals"] },
    { id: "transportation", label: "Transportation", subcategories: ["Fuel", "Ride-hailing", "Other transportation"] },
    { id: "clothing", label: "Clothing", subcategories: [] },
    { id: "dating", label: "Dating", subcategories: [] },
    { id: "hanging-out", label: "Hanging out", subcategories: ["Friends", "Family", "Other"] },
    { id: "haircare", label: "Haircare", subcategories: ["Haircut", "Hair products", "Other haircare"] },
    { id: "money-leaks", label: "Money leaks", subcategories: ["Snacks", "Random purchases", "Mistakes", "Lost money", "Other money leaks"] },
    { id: "other", label: "Other", subcategories: [] },
  ],
};

const CATEGORY_IDS = {
  income: new Set(FINANCE_CATEGORIES.income.map((category) => category.id)),
  expense: new Set(FINANCE_CATEGORIES.expense.map((category) => category.id)),
};

export function isFinanceLedgerRoute(pathname) {
  return pathname === "/api/finance/summary"
    || pathname === "/api/finance/transactions"
    || pathname.startsWith("/api/finance/transactions/");
}

export async function handleFinanceLedgerRequest(request, env) {
  const url = new URL(request.url);
  const email = await financeSessionEmail(request, env);
  if (!email) return json({ error: "AUTH_REQUIRED" }, 401);
  if (request.method !== "GET" && !isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  if (url.pathname === "/api/finance/summary" && request.method === "GET") {
    return getFinanceLedgerSummary(url, email, env);
  }
  if (url.pathname === "/api/finance/transactions" && request.method === "GET") {
    return getFinanceTransactions(url, email, env);
  }
  if (url.pathname === "/api/finance/transactions" && request.method === "POST") {
    return createFinanceTransaction(request, email, env);
  }

  const id = decodeURIComponent(url.pathname.split("/").at(-1) || "");
  if (!id) return json({ error: "FINANCE_TRANSACTION_NOT_FOUND" }, 404);
  if (request.method === "PATCH") return updateFinanceTransaction(request, email, id, env);
  if (request.method === "DELETE") return deleteFinanceTransaction(email, id, env);
  return json({ error: "NOT_FOUND" }, 404);
}

async function getFinanceLedgerSummary(url, email, env) {
  const year = normalizeYear(url.searchParams.get("year"));
  const selectedMonth = normalizeMonthKey(url.searchParams.get("month"), year) || vietnamMonthKey(year);
  const rows = await env.DB.prepare(`
    SELECT id, occurred_on, year, month, type, category, subcategory, amount, status, note, source, created_at, updated_at
    FROM finance_transactions
    WHERE user_email = ? AND year = ? AND deleted_at IS NULL
    ORDER BY occurred_on ASC, created_at ASC
  `).bind(email, year).all();

  return json({
    ...summarizeFinanceTransactions(rows.results || [], { year, selectedMonth }),
    categories: FINANCE_CATEGORIES,
    source: "Joy Finance",
    fetchedAt: Date.now(),
  });
}

async function getFinanceTransactions(url, email, env) {
  const year = normalizeYear(url.searchParams.get("year"));
  const monthKey = normalizeMonthKey(url.searchParams.get("month"), year);
  const status = cleanText(url.searchParams.get("status"));
  const bindings = [email, year];
  let where = "user_email = ? AND year = ? AND deleted_at IS NULL";

  if (monthKey) {
    where += " AND month = ?";
    bindings.push(Number(monthKey.slice(5)));
  }
  if (["actual", "planned"].includes(status)) {
    where += " AND status = ?";
    bindings.push(status);
  }

  const rows = await env.DB.prepare(`
    SELECT id, occurred_on, year, month, type, category, subcategory, amount, status, note, source, created_at, updated_at
    FROM finance_transactions
    WHERE ${where}
    ORDER BY occurred_on DESC, created_at DESC
  `).bind(...bindings).all();
  return json({ transactions: rows.results || [], month: monthKey, year });
}

async function createFinanceTransaction(request, email, env) {
  const validation = validateFinanceTransaction(await readJson(request));
  if (validation.error) return json({ error: validation.error }, 400);
  const transaction = {
    id: crypto.randomUUID(),
    ...validation.value,
    source: "joy",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await env.DB.prepare(`
    INSERT INTO finance_transactions (
      user_email, id, occurred_on, year, month, type, category, subcategory,
      amount, status, note, source, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).bind(
    email,
    transaction.id,
    transaction.occurred_on,
    transaction.year,
    transaction.month,
    transaction.type,
    transaction.category,
    transaction.subcategory,
    transaction.amount,
    transaction.status,
    transaction.note,
    transaction.source,
    transaction.created_at,
    transaction.updated_at,
  ).run();

  return json({ ok: true, transaction }, 201);
}

async function updateFinanceTransaction(request, email, id, env) {
  const existing = await env.DB.prepare(`
    SELECT id FROM finance_transactions
    WHERE user_email = ? AND id = ? AND deleted_at IS NULL
  `).bind(email, id).first();
  if (!existing) return json({ error: "FINANCE_TRANSACTION_NOT_FOUND" }, 404);

  const validation = validateFinanceTransaction(await readJson(request));
  if (validation.error) return json({ error: validation.error }, 400);
  const updatedAt = Date.now();
  await env.DB.prepare(`
    UPDATE finance_transactions SET
      occurred_on = ?, year = ?, month = ?, type = ?, category = ?, subcategory = ?,
      amount = ?, status = ?, note = ?, updated_at = ?
    WHERE user_email = ? AND id = ? AND deleted_at IS NULL
  `).bind(
    validation.value.occurred_on,
    validation.value.year,
    validation.value.month,
    validation.value.type,
    validation.value.category,
    validation.value.subcategory,
    validation.value.amount,
    validation.value.status,
    validation.value.note,
    updatedAt,
    email,
    id,
  ).run();
  return json({ ok: true, transaction: { id, ...validation.value, updated_at: updatedAt } });
}

async function deleteFinanceTransaction(email, id, env) {
  const result = await env.DB.prepare(`
    UPDATE finance_transactions SET deleted_at = ?, updated_at = ?
    WHERE user_email = ? AND id = ? AND deleted_at IS NULL
  `).bind(Date.now(), Date.now(), email, id).run();
  if (!result.meta?.changes) return json({ error: "FINANCE_TRANSACTION_NOT_FOUND" }, 404);
  return json({ ok: true, id });
}

export function validateFinanceTransaction(body) {
  const source = body && typeof body === "object" ? body : {};
  const type = cleanText(source.type).toLowerCase();
  const category = cleanText(source.category).toLowerCase();
  const occurredOn = cleanText(source.occurred_on || source.date);
  const amount = Number(source.amount);
  const status = cleanText(source.status || "actual").toLowerCase();
  const subcategory = cleanText(source.subcategory).slice(0, 80);
  const note = cleanText(source.note).slice(0, 300);

  if (!["income", "expense"].includes(type)) return { error: "FINANCE_TYPE_INVALID" };
  if (!CATEGORY_IDS[type].has(category)) return { error: "FINANCE_CATEGORY_INVALID" };
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(occurredOn)) return { error: "FINANCE_DATE_INVALID" };
  const date = new Date(`${occurredOn}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== occurredOn) return { error: "FINANCE_DATE_INVALID" };
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return { error: "FINANCE_AMOUNT_INVALID" };
  if (!["actual", "planned"].includes(status)) return { error: "FINANCE_STATUS_INVALID" };

  return {
    value: {
      occurred_on: occurredOn,
      year: Number(occurredOn.slice(0, 4)),
      month: Number(occurredOn.slice(5, 7)),
      type,
      category,
      subcategory,
      amount: Math.round(amount),
      status,
      note,
    },
  };
}

export function summarizeFinanceTransactions(transactions, { year = DEFAULT_YEAR, selectedMonth } = {}) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    key: `${year}-${String(index + 1).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, index, 1))),
    shortLabel: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, index, 1))),
    transactions: [],
  }));

  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    const monthIndex = Number(transaction.month) - 1;
    if (Number(transaction.year) !== year || monthIndex < 0 || monthIndex > 11) continue;
    months[monthIndex].transactions.push({
      ...transaction,
      amount: Number(transaction.amount || 0),
      type: cleanText(transaction.type),
      category: cleanText(transaction.category),
      status: cleanText(transaction.status || "actual"),
    });
  }

  const actualSeries = calculateMonthSeries(months, false);
  const projectedSeries = calculateMonthSeries(months, true);
  const currentKey = normalizeMonthKey(selectedMonth, year) || vietnamMonthKey(year);
  const currentIndex = Math.max(0, months.findIndex((month) => month.key === currentKey));

  const enrichedMonths = months.map((month, index) => ({
    key: month.key,
    label: month.label,
    shortLabel: month.shortLabel,
    actual: actualSeries[index],
    projected: projectedSeries[index],
    transactionCount: month.transactions.length,
    status: index < currentIndex ? "actual" : index === currentIndex ? "in-progress" : "planned",
  }));

  const actualTransactions = months.flatMap((month) => month.transactions).filter((transaction) => transaction.status === "actual");
  const projectedTransactions = months.flatMap((month) => month.transactions);
  const actualIncome = sumTransactions(actualTransactions, "income", { excludeCarryover: true });
  const projectedIncome = sumTransactions(projectedTransactions, "income", { excludeCarryover: true });
  const actualExpenses = sumTransactions(actualTransactions, "expense");
  const projectedExpenses = sumTransactions(projectedTransactions, "expense");
  const current = enrichedMonths[currentIndex] || enrichedMonths[0];
  const currentTransactions = months[currentIndex]?.transactions || [];

  return {
    year,
    selectedMonth: current.key,
    current: {
      ...current,
      categories: expenseCategoryTotals(currentTransactions),
      recent: [...currentTransactions]
        .sort((a, b) => String(b.occurred_on).localeCompare(String(a.occurred_on)) || Number(b.created_at || 0) - Number(a.created_at || 0))
        .slice(0, 5),
    },
    months: enrichedMonths,
    annual: {
      actualIncome,
      projectedIncome,
      actualExpenses,
      projectedExpenses,
      currentBalance: current.actual.remaining,
      projectedYearEnd: enrichedMonths.at(-1)?.projected.remaining || 0,
    },
  };
}

function calculateMonthSeries(months, includePlanned) {
  let previousClosing = 0;
  return months.map((month) => {
    const included = month.transactions.filter((transaction) => includePlanned || transaction.status === "actual");
    const explicitCarryover = included.filter((transaction) => transaction.type === "income" && transaction.category === "carryover");
    const carryover = explicitCarryover.length
      ? explicitCarryover.reduce((sum, transaction) => sum + transaction.amount, 0)
      : previousClosing;
    const newIncome = included
      .filter((transaction) => transaction.type === "income" && transaction.category !== "carryover")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = included
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const remaining = carryover + newIncome - expenses;
    previousClosing = remaining;
    return { carryover, newIncome, income: carryover + newIncome, expenses, remaining };
  });
}

function expenseCategoryTotals(transactions) {
  const totals = new Map(FINANCE_CATEGORIES.expense.map((category) => [category.id, 0]));
  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    totals.set(transaction.category, (totals.get(transaction.category) || 0) + Number(transaction.amount || 0));
  }
  return FINANCE_CATEGORIES.expense
    .map((category) => ({ id: category.id, label: category.label, amount: totals.get(category.id) || 0 }))
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function sumTransactions(transactions, type, { excludeCarryover = false } = {}) {
  return transactions
    .filter((transaction) => transaction.type === type && (!excludeCarryover || transaction.category !== "carryover"))
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
}

async function financeSessionEmail(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token) return "";
  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(`
    SELECT user_email FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).bind(tokenHash, Date.now()).first();
  return cleanText(session?.user_email).toLowerCase();
}

function normalizeYear(value) {
  const year = Number(value || DEFAULT_YEAR);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : DEFAULT_YEAR;
}

function normalizeMonthKey(value, year) {
  const key = cleanText(value);
  return new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(key) ? key : "";
}

function vietnamMonthKey(year) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const month = parts.find((part) => part.type === "month")?.value || "01";
  return `${year}-${month}`;
}

function cleanText(value) {
  return String(value ?? "").trim();
}
