import {
  handleFinanceLedgerRequest as handleBaseFinanceLedgerRequest,
  isFinanceLedgerRoute,
} from "./finance-ledger.js";
import { json } from "./shared/http.js";
import { readCookies, sha256Hex } from "./shared/session.js";

const SESSION_COOKIE = "__Host-joy_session";
const IMPORT_KEY = "finance-tracker-2026-v1";

const FINANCE_2026_MONTHS = [
  {
    month: 1,
    status: "actual",
    carryover: 9_770_000,
    income: { allowance: 5_500_000 },
    expense: { home: 8_150_000, meals: 380_000, transportation: 800_000, clothing: 390_000, dating: 1_480_000, "hanging-out": 270_000, haircare: 280_000, "money-leaks": 90_000, other: 3_150_000 },
  },
  {
    month: 2,
    status: "actual",
    income: { sale: 1_040_000, allowance: 5_000_000, "other-income": 6_150_000 },
    expense: { home: 900_000, meals: 720_000, transportation: 480_000, clothing: 250_000, dating: 610_000, "hanging-out": 250_000, haircare: 240_000, "money-leaks": 50_000, other: 3_590_000 },
  },
  {
    month: 3,
    status: "actual",
    income: { sale: 6_650_000, allowance: 5_500_000, "other-income": -2_120_000 },
    expense: { home: 990_000, meals: 300_000, transportation: 230_000, "hanging-out": 660_000, haircare: 430_000, "money-leaks": 80_000, other: 5_580_000 },
  },
  {
    month: 4,
    status: "actual",
    income: { sale: 800_000, allowance: 5_000_000, "other-income": 2_550_000 },
    expense: { home: 4_400_000, meals: 330_000, transportation: 440_000, clothing: 1_310_000, dating: 1_790_000, "hanging-out": 2_670_000, haircare: 1_020_000, "money-leaks": 30_000, other: 290_000 },
  },
  {
    month: 5,
    status: "actual",
    income: { sale: 1_160_000, allowance: 5_500_000, "other-income": 2_200_000 },
    expense: { home: 760_000, meals: 380_000, transportation: 510_000, clothing: 250_000, dating: 260_000, "hanging-out": 530_000, haircare: 160_000, "money-leaks": 1_410_000, other: 2_380_000 },
  },
  {
    month: 6,
    status: "actual",
    income: { sale: 1_200_000, allowance: 4_500_000, "other-income": -7_480_000 },
    expense: { home: 330_000, meals: 280_000, transportation: 60_000, clothing: 270_000, dating: 2_870_000, haircare: 320_000, "money-leaks": 870_000, other: 270_000 },
  },
  {
    month: 7,
    status: "actual",
    income: { sale: 7_340_000, allowance: 8_000_000, "other-income": 800_000 },
    expense: { home: 5_000_000, meals: 250_000, transportation: 770_000, clothing: 280_000, dating: 280_000, haircare: 450_000, "money-leaks": 3_760_000, other: 1_220_000 },
  },
  {
    month: 8,
    status: "planned",
    income: { allowance: 4_500_000 },
    expense: { home: 580_000, dating: 140_000, haircare: 150_000 },
  },
  { month: 9, status: "planned", income: { allowance: 4_500_000 }, expense: {} },
  { month: 10, status: "planned", income: { allowance: 4_500_000 }, expense: { home: 3_900_000 } },
  { month: 11, status: "planned", income: { allowance: 4_500_000 }, expense: {} },
  { month: 12, status: "planned", income: { allowance: 4_500_000 }, expense: {} },
];

export { isFinanceLedgerRoute };

export async function handleFinanceLedgerRequest(request, env) {
  const email = await financeSessionEmail(request, env);
  if (email) await ensureFinanceTrackerImport(email, env);

  const response = await handleBaseFinanceLedgerRequest(request, env);
  const url = new URL(request.url);
  if (!response.ok || request.method !== "GET" || url.pathname !== "/api/finance/summary") {
    return response;
  }

  const payload = await response.json();
  const currentMonthKey = vietnamMonthKey(Number(payload.year || 2026));
  const currentMonth = payload.months?.find((month) => month.key === currentMonthKey);
  if (payload.annual && currentMonth) payload.annual.currentBalance = Number(currentMonth.actual?.remaining || 0);
  payload.source = "Joy Finance · Finance Tracker 2026 imported once";
  return json(payload, response.status);
}

export function buildFinanceTrackerSeed() {
  const transactions = [];
  for (const month of FINANCE_2026_MONTHS) {
    const monthText = String(month.month).padStart(2, "0");
    const incomeDate = `2026-${monthText}-01`;
    const expenseDate = `2026-${monthText}-${month.month === 7 ? "27" : "28"}`;

    if (Number.isFinite(month.carryover) && month.carryover !== 0) {
      transactions.push(seedTransaction(month.month, incomeDate, "income", "carryover", month.carryover, month.status));
    }
    for (const [category, amount] of Object.entries(month.income || {})) {
      if (Number(amount)) transactions.push(seedTransaction(month.month, incomeDate, "income", category, amount, month.status));
    }
    for (const [category, amount] of Object.entries(month.expense || {})) {
      if (Number(amount)) transactions.push(seedTransaction(month.month, expenseDate, "expense", category, amount, month.status));
    }
  }
  return transactions;
}

function seedTransaction(month, occurredOn, type, category, amount, status) {
  return {
    id: `sheet-2026-${String(month).padStart(2, "0")}-${type}-${category}`,
    occurredOn,
    month,
    type,
    category,
    amount: Number(amount),
    status,
    note: "Imported monthly total from Finance Tracker",
  };
}

async function ensureFinanceTrackerImport(email, env) {
  const imported = await env.DB.prepare(`
    SELECT 1 AS imported
    FROM finance_imports
    WHERE user_email = ? AND import_key = ?
  `).bind(email, IMPORT_KEY).first();
  if (imported) return;

  const now = Date.now();
  const statements = buildFinanceTrackerSeed().map((transaction, index) => env.DB.prepare(`
    INSERT OR IGNORE INTO finance_transactions (
      user_email, id, occurred_on, year, month, type, category, subcategory,
      amount, status, note, source, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, 2026, ?, ?, ?, '', ?, ?, ?, 'sheet-import', ?, ?, NULL)
  `).bind(
    email,
    transaction.id,
    transaction.occurredOn,
    transaction.month,
    transaction.type,
    transaction.category,
    transaction.amount,
    transaction.status,
    transaction.note,
    now + index,
    now + index,
  ));
  statements.push(env.DB.prepare(`
    INSERT OR REPLACE INTO finance_imports (user_email, import_key, imported_at)
    VALUES (?, ?, ?)
  `).bind(email, IMPORT_KEY, now));
  await env.DB.batch(statements);
}

async function financeSessionEmail(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token) return "";
  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(`
    SELECT user_email
    FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).bind(tokenHash, Date.now()).first();
  return String(session?.user_email || "").trim().toLowerCase();
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
