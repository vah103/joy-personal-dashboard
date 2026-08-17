import app from "./index.js";
import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";
import {
  handleSaleRoomSummaryAiRequest,
  SALE_ROOM_SUMMARY_AI_PATH,
} from "./sale-room-summary-ai.js";

const DELETE_PATH = "/api/sales/viewings/delete";
const COMMISSION_PATH = "/api/sales/viewings/commission";
const CLOSE_DEAL_PATH = "/api/sales/viewings/close-deal";
const CLOSED_STATES = new Set(["pending", "received"]);

export function isSaleViewingDeleteRoute(pathname) {
  return pathname === DELETE_PATH
    || pathname === COMMISSION_PATH
    || pathname === CLOSE_DEAL_PATH
    || pathname === SALE_ROOM_SUMMARY_AI_PATH;
}

export async function handleSaleViewingDeleteRequest(request, env) {
  const pathname = new URL(request.url).pathname;
  if (pathname === SALE_ROOM_SUMMARY_AI_PATH) {
    return handleSaleRoomSummaryAiRequest(request, env);
  }
  if (pathname === COMMISSION_PATH) {
    return handleSaleViewingCommissionRequest(request, env);
  }
  if (pathname === CLOSE_DEAL_PATH) {
    return handleSaleViewingCloseDeal(request, env);
  }
  return handleSaleViewingDelete(request, env);
}

async function viewingDealMarker(id, email, env) {
  return env.DB.prepare(`
    SELECT state, updated_at
    FROM sale_viewing_commissions
    WHERE viewing_id = ? AND user_email = ?
    LIMIT 1
  `).bind(id, email).first();
}

function isClosedMarker(row) {
  return CLOSED_STATES.has(String(row?.state || ""));
}

async function handleSaleViewingDelete(request, env) {
  if (request.method !== "DELETE") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const input = await readJson(request);
  const id = cleanViewingId(input?.id);
  if (!id) return json({ error: "VIEWING_ID_REQUIRED" }, 400);

  if (isClosedMarker(await viewingDealMarker(id, session.user_email, env))) {
    return json({ error: "VIEWING_ALREADY_CLOSED" }, 409);
  }

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

async function handleSaleViewingCloseDeal(request, env) {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const input = await readJson(request);
  const viewingId = cleanViewingId(input?.viewingId);
  if (!viewingId) return json({ error: "VIEWING_ID_REQUIRED" }, 400);

  const viewing = await env.DB.prepare(`
    SELECT id
    FROM sale_viewings
    WHERE id = ? AND user_email = ?
    LIMIT 1
  `).bind(viewingId, session.user_email).first();
  if (!viewing) return json({ error: "VIEWING_NOT_FOUND" }, 404);

  const existingMarker = await viewingDealMarker(viewingId, session.user_email, env);
  if (isClosedMarker(existingMarker)) {
    return json({ ok: true, alreadySaved: true, dealSaved: true });
  }

  const now = Date.now();
  const reservation = await env.DB.prepare(`
    INSERT INTO sale_viewing_commissions (viewing_id, user_email, state, updated_at)
    VALUES (?, ?, 'pending', ?)
    ON CONFLICT(viewing_id) DO NOTHING
  `).bind(viewingId, session.user_email, now).run();

  if (!Number(reservation.meta?.changes || 0)) {
    const marker = await viewingDealMarker(viewingId, session.user_email, env);
    if (isClosedMarker(marker)) {
      return json({ ok: true, alreadySaved: true, dealSaved: true });
    }
    return json({ error: "SALE_DEAL_SAVE_IN_PROGRESS" }, 409);
  }

  try {
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.set("content-type", "application/json");
    const dealRequest = new Request(new URL("/api/sales/deals", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({
        month: input.month,
        customer: input.customer,
        phone: input.phone,
        address: input.address,
        host: input.host,
        rent: input.rent,
        rate: input.rate,
      }),
    });

    const dealResponse = await app.fetch(dealRequest, env, {});
    const payload = await dealResponse.json().catch(() => ({}));
    if (!dealResponse.ok) {
      await releaseCloseDealReservation(viewingId, session.user_email, env);
      return json(payload, dealResponse.status);
    }

    return json({ ...payload, dealSaved: true }, dealResponse.status);
  } catch (error) {
    await releaseCloseDealReservation(viewingId, session.user_email, env);
    throw error;
  }
}

async function releaseCloseDealReservation(id, email, env) {
  await env.DB.prepare(`
    DELETE FROM sale_viewing_commissions
    WHERE viewing_id = ? AND user_email = ? AND state = 'pending'
  `).bind(id, email).run();
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

  const input = await readJson(request);
  const id = cleanViewingId(input?.id);
  if (!id) return json({ error: "VIEWING_ID_REQUIRED" }, 400);

  const viewing = await env.DB.prepare(`
    SELECT id
    FROM sale_viewings
    WHERE id = ? AND user_email = ?
    LIMIT 1
  `).bind(id, session.user_email).first();
  if (!viewing) return json({ error: "VIEWING_NOT_FOUND" }, 404);

  const existing = await viewingDealMarker(id, session.user_email, env);
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
