import {
  buildFinanceTrackerSeed,
  handleFinanceLedgerRequest as handleSeededFinanceLedgerRequest,
  isFinanceLedgerRoute,
} from "./finance-with-seed.js";
import {
  FINANCE_BREAKDOWN_IMPORT_KEY,
  FINANCE_BREAKDOWN_REPLACED_IDS,
  financeBreakdownSeedForMigration,
  validateFinanceBreakdownPayload,
} from "./finance-breakdown-policy.js";

const SESSION_COOKIE = "__Host-joy_session";
const LEGACY_IMPORT_KEY = "finance-tracker-2026-v1";

export { isFinanceLedgerRoute };

export async function handleFinanceLedgerRequest(request, env) {
  const email = await financeSessionEmail(request, env);
  if (email) {
    await ensureLegacyFinanceImport(email, env);
    await ensureFinanceBreakdownImport(email, env);
  }

  if (["POST", "PATCH"].includes(request.method)) {
    const body = await request.clone().json().catch(() => ({}));
    const breakdownError = validateFinanceBreakdownPayload(body);
    if (breakdownError) return json({ error: breakdownError }, 400);
  }

  return handleSeededFinanceLedgerRequest(request, env);
}

async function ensureLegacyFinanceImport(email, env) {
  const imported = await hasImport(email, LEGACY_IMPORT_KEY, env);
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
  statements.push(markImport(email, LEGACY_IMPORT_KEY, now, env));
  await env.DB.batch(statements);
}

async function ensureFinanceBreakdownImport(email, env) {
  const imported = await hasImport(email, FINANCE_BREAKDOWN_IMPORT_KEY, env);
  if (imported) return;

  const now = Date.now();
  const preservedRows = await env.DB.prepare(`
    SELECT id
    FROM finance_transactions
    WHERE user_email = ?
      AND source = 'sheet-import'
      AND updated_at != created_at
      AND deleted_at IS NULL
      AND id IN (?, ?, ?)
  `).bind(email, ...FINANCE_BREAKDOWN_REPLACED_IDS).all();
  const preservedLegacyIds = new Set((preservedRows.results || []).map((row) => String(row.id || "")));
  const statements = [];

  for (const id of FINANCE_BREAKDOWN_REPLACED_IDS) {
    statements.push(env.DB.prepare(`
      UPDATE finance_transactions
      SET deleted_at = ?, updated_at = ?
      WHERE user_email = ?
        AND id = ?
        AND source = 'sheet-import'
        AND updated_at = created_at
        AND deleted_at IS NULL
    `).bind(now, now, email, id));
  }

  for (const [index, transaction] of financeBreakdownSeedForMigration(preservedLegacyIds).entries()) {
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO finance_transactions (
        user_email, id, occurred_on, year, month, type, category, subcategory,
        amount, status, note, source, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, 2026, ?, ?, ?, ?, ?, ?, ?, 'sheet-breakdown', ?, ?, NULL)
    `).bind(
      email,
      transaction.id,
      transaction.occurredOn,
      transaction.month,
      transaction.type,
      transaction.category,
      transaction.subcategory,
      transaction.amount,
      transaction.status,
      transaction.note,
      now + index + 1,
      now + index + 1,
    ));
  }

  statements.push(markImport(email, FINANCE_BREAKDOWN_IMPORT_KEY, now, env));
  await env.DB.batch(statements);
}

async function hasImport(email, importKey, env) {
  const row = await env.DB.prepare(`
    SELECT 1 AS imported
    FROM finance_imports
    WHERE user_email = ? AND import_key = ?
  `).bind(email, importKey).first();
  return Boolean(row);
}

function markImport(email, importKey, importedAt, env) {
  return env.DB.prepare(`
    INSERT OR REPLACE INTO finance_imports (user_email, import_key, imported_at)
    VALUES (?, ?, ?)
  `).bind(email, importKey, importedAt);
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

function readCookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => {
    const index = part.indexOf("=");
    if (index === -1) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
