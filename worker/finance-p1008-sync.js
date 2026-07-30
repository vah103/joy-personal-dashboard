import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

const FINANCE_P1008_PATH = "/api/p1008";
const MONTH_KEYS = [
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
];
const SERVICE_KEYS = ["apartment", "electricity", "water", "parking", "wifi"];
const MAX_AMOUNT = 1_000_000_000;

export function isFinanceP1008Route(pathname) {
  return pathname === FINANCE_P1008_PATH;
}

export function normalizeFinanceP1008Data(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const normalized = {};
  for (const monthKey of MONTH_KEYS) {
    const month = input[monthKey];
    if (!month || typeof month !== "object" || Array.isArray(month)) continue;

    normalized[monthKey] = Object.fromEntries(SERVICE_KEYS.map((serviceKey) => {
      const value = Number(month[serviceKey]);
      const amount = Number.isSafeInteger(value) && value >= 0 && value <= MAX_AMOUNT ? value : 0;
      return [serviceKey, amount];
    }));
  }
  return normalized;
}

function parseStoredData(value) {
  try {
    return normalizeFinanceP1008Data(JSON.parse(value || "{}"));
  } catch {
    return {};
  }
}

export async function handleFinanceP1008Request(request, env) {
  try {
    if (request.method !== "GET" && request.method !== "PUT") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET, PUT" });
    }

    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method === "PUT" && !isSameOrigin(request)) {
      return json({ error: "INVALID_ORIGIN" }, 403);
    }

    if (request.method === "GET") {
      const row = await env.DB.prepare(`
        SELECT data_json, updated_at
        FROM finance_p1008
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
      return json({ error: "INVALID_P1008_DATA" }, 400);
    }

    const data = normalizeFinanceP1008Data(body.data);
    const updatedAt = Date.now();
    await env.DB.prepare(`
      INSERT INTO finance_p1008 (user_email, data_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `).bind(session.user_email, JSON.stringify(data), updatedAt).run();

    return json({ ok: true, data, updatedAt });
  } catch (error) {
    console.error("Joy P1008 sync failed", error);
    return json({ error: "P1008_SYNC_FAILED" }, 500);
  }
}
