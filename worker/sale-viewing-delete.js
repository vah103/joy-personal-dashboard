import { isSameOrigin, json } from "./shared/http.js";
import { getSession } from "./shared/session.js";

const DELETE_PATH = "/api/sales/viewings/delete";
const COMMISSION_PATH = "/api/sales/viewings/commission";

export function isSaleViewingDeleteRoute(pathname) {
  return pathname === DELETE_PATH || pathname === COMMISSION_PATH;
}

export async function handleSaleViewingDeleteRequest(request, env) {
  const pathname = new URL(request.url).pathname;
  if (pathname === COMMISSION_PATH) {
    return handleSaleViewingCommissionRequest(request, env);
  }
  return handleSaleViewingDelete(request, env);
}

async function handleSaleViewingDelete(request, env) {
  if (request.method !== "DELETE") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const input = await request.json().catch(() => null);
  const id = cleanViewingId(input?.id);
  if (!id) return json({ error: "VIEWING_ID_REQUIRED" }, 400);

  await env.DB.prepare(`
    DELETE FROM sale_viewing_commissions
    WHERE viewing_id = ? AND user_email = ?
  `).bind(id, session.user_email).run();

  const result = await env.DB.prepare(`
    DELETE FROM sale_viewings
    WHERE id = ? AND user_email = ?
  `).bind(id, session.user_email).run();

  if (!Number(result.meta?.changes || 0)) {
    return json({ error: "VIEWING_NOT_FOUND" }, 404);
  }

  return json({
    ok: true,
    id,
    message: "Đã xóa lịch hẹn.",
  });
}

async function handleSaleViewingCommissionRequest(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  if (request.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT viewing_id, state, updated_at
      FROM sale_viewing_commissions
      WHERE user_email = ?
      ORDER BY updated_at DESC
    `).bind(session.user_email).all();

    return json({
      states: (rows.results || []).map((row) => ({
        viewingId: String(row.viewing_id || ""),
        state: normalizeCommissionState(row.state),
        updatedAt: Number(row.updated_at || 0),
      })),
    });
  }

  if (request.method !== "PATCH") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const input = await request.json().catch(() => null);
  const id = cleanViewingId(input?.id);
  if (!id) return json({ error: "VIEWING_ID_REQUIRED" }, 400);

  const viewing = await env.DB.prepare(`
    SELECT id
    FROM sale_viewings
    WHERE id = ? AND user_email = ?
    LIMIT 1
  `).bind(id, session.user_email).first();
  if (!viewing) return json({ error: "VIEWING_NOT_FOUND" }, 404);

  const existing = await env.DB.prepare(`
    SELECT state
    FROM sale_viewing_commissions
    WHERE viewing_id = ? AND user_email = ?
    LIMIT 1
  `).bind(id, session.user_email).first();

  const currentState = normalizeCommissionState(existing?.state);
  const state = currentState === "pending" || currentState === "received"
    ? "received"
    : "pending";
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO sale_viewing_commissions (viewing_id, user_email, state, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(viewing_id) DO UPDATE SET
      user_email = excluded.user_email,
      state = excluded.state,
      updated_at = excluded.updated_at
  `).bind(id, session.user_email, state, now).run();

  return json({
    ok: true,
    viewingId: id,
    state,
    message: state === "pending"
      ? "Đã chốt khách, chưa nhận hoa hồng."
      : "Đã ghi nhận hoa hồng.",
  });
}

function cleanViewingId(value) {
  return String(value || "").trim().slice(0, 120);
}

function normalizeCommissionState(value) {
  if (value === "pending" || value === "received") return value;
  return "none";
}
