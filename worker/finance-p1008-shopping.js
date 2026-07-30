import { isSameOrigin, json, readJson } from "./shared/http.js";
import { CREATE_FINANCE_P1008_SHOPPING_TABLE } from "./shared/schema.js";
import { getSession } from "./shared/session.js";

const FINANCE_P1008_SHOPPING_PATH = "/api/p1008-shopping";
const MONTH_KEYS = [
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
];
const VALID_SPLIT_COUNTS = new Set([4, 5, 6]);
const MAX_ITEMS_PER_MONTH = 100;
const MAX_AMOUNT = 1_000_000_000;
const MAX_NAME_LENGTH = 80;

export function isFinanceP1008ShoppingRoute(pathname) {
  return pathname === FINANCE_P1008_SHOPPING_PATH;
}

function normalizeShoppingItem(raw, fallbackIndex) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const name = String(raw.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  const amount = Number(raw.amount);
  const splitCount = Number(raw.splitCount);
  const sourceId = String(raw.id || "").trim();
  const id = /^[A-Za-z0-9_-]{1,64}$/.test(sourceId)
    ? sourceId
    : `item-${fallbackIndex}-${Math.abs(name.length * 997 + amount)}`;

  if (!name || !Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
  if (!VALID_SPLIT_COUNTS.has(splitCount)) return null;
  return { id, name, amount, splitCount };
}

export function normalizeFinanceP1008ShoppingData(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const normalized = {};
  for (const monthKey of MONTH_KEYS) {
    const items = input[monthKey];
    if (!Array.isArray(items)) continue;

    const seen = new Set();
    normalized[monthKey] = items
      .slice(0, MAX_ITEMS_PER_MONTH)
      .map((item, index) => normalizeShoppingItem(item, index))
      .filter((item) => {
        if (!item || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }
  return normalized;
}

function parseStoredData(value) {
  try {
    return normalizeFinanceP1008ShoppingData(JSON.parse(value || "{}"));
  } catch {
    return {};
  }
}

async function ensureFinanceP1008ShoppingTable(env) {
  await env.DB.prepare(CREATE_FINANCE_P1008_SHOPPING_TABLE).run();
}

export async function handleFinanceP1008ShoppingRequest(request, env) {
  try {
    if (request.method !== "GET" && request.method !== "PUT") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET, PUT" });
    }

    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method === "PUT" && !isSameOrigin(request)) {
      return json({ error: "INVALID_ORIGIN" }, 403);
    }

    await ensureFinanceP1008ShoppingTable(env);

    if (request.method === "GET") {
      const row = await env.DB.prepare(`
        SELECT data_json, updated_at
        FROM finance_p1008_shopping
        WHERE user_email = ?
      `).bind(session.user_email).first();

      return json({
        data: parseStoredData(row?.data_json),
        exists: Boolean(row),
        updatedAt: Number(row?.updated_at || 0),
      });
    }

    const body = await readJson(request);
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return json({ error: "INVALID_P1008_SHOPPING_DATA" }, 400);
    }

    const data = normalizeFinanceP1008ShoppingData(body.data);
    const updatedAt = Date.now();
    await env.DB.prepare(`
      INSERT INTO finance_p1008_shopping (user_email, data_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `).bind(session.user_email, JSON.stringify(data), updatedAt).run();

    return json({ ok: true, data, updatedAt });
  } catch (error) {
    console.error("Joy P1008 shopping sync failed", error);
    return json({ error: "P1008_SHOPPING_SYNC_FAILED" }, 500);
  }
}
