import app from "./index.js";
import { saleDealRevision, validateSaleDeal } from "./finance-sales.js";
import { guardGoogleIntegration } from "./google-auth.js";
import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

const SAFE_ADD_PATH = "/api/sales/deals/idempotent";
const SAFE_UPDATE_PATH = "/api/sales/deals/safe-update";
const REVIEW_PATH = "/api/sales/deals/idempotent/review";
const REVIEW_AFTER_MS = 2 * 60 * 1000;

export function isSaleDealGuardRoute(pathname) {
  return pathname === SAFE_ADD_PATH || pathname === SAFE_UPDATE_PATH || pathname === REVIEW_PATH;
}

export async function handleSaleDealGuardRequest(request, env) {
  const denied = await guardGoogleIntegration(request, env, "sheets");
  if (denied) return denied;
  const pathname = new URL(request.url).pathname;
  if (pathname === SAFE_ADD_PATH) return handleSafeAdd(request, env);
  if (pathname === SAFE_UPDATE_PATH) return handleSafeUpdate(request, env);
  return handleAddReview(request, env);
}

async function handleSafeAdd(request, env) {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const input = await readJson(request);
  const requestId = cleanRequestId(input?.requestId);
  if (!requestId) return json({ error: "SALE_DEAL_REQUEST_ID_REQUIRED" }, 400);
  const validation = validateSaleDeal(input);
  if (validation.error) return json({ error: validation.error }, 400);
  const revision = saleDealRevision(validation.value);

  const claim = await claimWriteRequest(requestId, session.user_email, revision, env);
  if (!claim.acquired) {
    if (claim.error) return json({ error: claim.error, requestId }, 409);
    return committedResponse(validation.value, claim.row, requestId, true);
  }

  try {
    const response = await forwardDealRequest(request, env, "POST", validation.value);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (payload.error === "SALE_WRITE_FAILED") {
        return json({ error: "SALE_DEAL_SAVE_REVIEW_REQUIRED", requestId }, 409);
      }
      await clearWriteRequest(requestId, session.user_email, env);
      return json(payload, response.status);
    }

    const sourceRow = Number(payload.deal?.sourceRow || 0);
    const detailRow = Number(payload.deal?.detailRow || 0);
    await completeWriteRequest(requestId, session.user_email, sourceRow, detailRow, env);
    return json({ ...payload, requestId, idempotent: false }, response.status);
  } catch (error) {
    console.error("Sale idempotent add failed", error);
    return json({ error: "SALE_DEAL_SAVE_REVIEW_REQUIRED", requestId }, 409);
  }
}

async function handleSafeUpdate(request, env) {
  if (request.method !== "PATCH") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const input = await readJson(request);
  const expectedRevision = String(input?.expectedRevision || "");
  if (!expectedRevision) return json({ error: "SALE_DEAL_REVISION_REQUIRED" }, 400);
  const validation = validateSaleDeal(input, { requireSourceRow: true });
  if (validation.error) return json({ error: validation.error }, 400);

  const current = await loadCurrentDeals(request, env);
  if (current.error) return json(current.payload, current.status);
  const matches = current.deals.filter((deal) => String(deal.revision || "") === expectedRevision);
  if (!matches.length) return json({ error: "SALE_DEAL_STALE" }, 409);
  if (matches.length > 1) return json({ error: "SALE_DEAL_AMBIGUOUS" }, 409);
  const existing = matches[0];
  if (existing.month !== validation.value.month) return json({ error: "SALE_DEAL_STALE" }, 409);

  const response = await forwardDealRequest(request, env, "PATCH", {
    ...validation.value,
    sourceRow: Number(existing.sourceRow || 0),
  });
  const payload = await response.json().catch(() => ({}));
  return json(payload, response.status);
}

async function handleAddReview(request, env) {
  if (request.method !== "PATCH") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const input = await readJson(request);
  const requestId = cleanRequestId(input?.requestId);
  const resolution = String(input?.resolution || "").trim();
  if (!requestId) return json({ error: "SALE_DEAL_REQUEST_ID_REQUIRED" }, 400);
  if (!["saved", "retry"].includes(resolution)) return json({ error: "SALE_DEAL_REVIEW_RESOLUTION_REQUIRED" }, 400);

  const row = await getWriteRequest(requestId, session.user_email, env);
  if (!row) return json({ error: "SALE_DEAL_REVIEW_NOT_REQUIRED" }, 409);
  if (row.state === "committed") {
    return json({ ok: true, alreadySaved: true, sourceRow: Number(row.source_row || 0), detailRow: Number(row.detail_row || 0) });
  }
  if (Date.now() - Number(row.created_at || 0) < REVIEW_AFTER_MS) {
    return json({ error: "SALE_DEAL_SAVE_IN_PROGRESS" }, 409);
  }

  const current = await loadCurrentDeals(request, env);
  if (current.error) return json(current.payload, current.status);
  const matches = current.deals.filter((deal) => String(deal.revision || "") === String(row.payload_revision || ""));

  if (resolution === "saved") {
    if (!matches.length) return json({ error: "SALE_DEAL_REVIEW_NOT_FOUND" }, 409);
    if (matches.length > 1) return json({ error: "SALE_DEAL_REVIEW_AMBIGUOUS" }, 409);
    const deal = matches[0];
    await completeWriteRequest(requestId, session.user_email, deal.sourceRow, deal.detailRow, env);
    return json({ ok: true, deal, requestId });
  }

  if (matches.length) {
    return json({ error: matches.length > 1 ? "SALE_DEAL_REVIEW_AMBIGUOUS" : "SALE_DEAL_REVIEW_DEAL_PRESENT" }, 409);
  }
  await clearWriteRequest(requestId, session.user_email, env);
  return json({ ok: true, retryAllowed: true, requestId });
}

async function claimWriteRequest(requestId, email, revision, env) {
  const now = Date.now();
  const result = await env.DB.prepare(`
    INSERT INTO sale_deal_write_requests (
      user_email, request_id, payload_revision, state, source_row, detail_row, created_at, updated_at
    ) VALUES (?, ?, ?, 'started', NULL, NULL, ?, ?)
    ON CONFLICT(user_email, request_id) DO NOTHING
  `).bind(email, requestId, revision, now, now).run();
  if (Number(result.meta?.changes || 0) > 0) return { acquired: true };

  const row = await getWriteRequest(requestId, email, env);
  if (!row) return { acquired: false, error: "SALE_DEAL_REQUEST_CONFLICT" };
  if (String(row.payload_revision || "") !== revision) {
    return { acquired: false, error: "SALE_DEAL_REQUEST_CONFLICT", row };
  }
  if (row.state === "committed") return { acquired: false, row };
  return {
    acquired: false,
    row,
    error: Date.now() - Number(row.created_at || 0) >= REVIEW_AFTER_MS
      ? "SALE_DEAL_SAVE_REVIEW_REQUIRED"
      : "SALE_DEAL_SAVE_IN_PROGRESS",
  };
}

async function getWriteRequest(requestId, email, env) {
  return env.DB.prepare(`
    SELECT request_id, payload_revision, state, source_row, detail_row, created_at, updated_at
    FROM sale_deal_write_requests
    WHERE user_email = ? AND request_id = ?
    LIMIT 1
  `).bind(email, requestId).first();
}

async function completeWriteRequest(requestId, email, sourceRow, detailRow, env) {
  await env.DB.prepare(`
    UPDATE sale_deal_write_requests
    SET state = 'committed', source_row = ?, detail_row = ?, updated_at = ?
    WHERE user_email = ? AND request_id = ?
  `).bind(Number(sourceRow || 0), Number(detailRow || 0), Date.now(), email, requestId).run();
}

async function clearWriteRequest(requestId, email, env) {
  await env.DB.prepare(`
    DELETE FROM sale_deal_write_requests
    WHERE user_email = ? AND request_id = ? AND state = 'started'
  `).bind(email, requestId).run();
}

async function loadCurrentDeals(request, env) {
  const response = await app.fetch(new Request(new URL("/api/sales/deals", request.url), {
    method: "GET",
    headers: new Headers(request.headers),
  }), env, {});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { error: true, payload, status: response.status, deals: [] };
  return {
    error: false,
    payload,
    status: response.status,
    deals: (Array.isArray(payload.months) ? payload.months : []).flatMap((month) => month.deals || []),
  };
}

async function forwardDealRequest(request, env, method, body) {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  return app.fetch(new Request(new URL("/api/sales/deals", request.url), {
    method,
    headers,
    body: JSON.stringify(body),
  }), env, {});
}

function committedResponse(value, row, requestId, idempotent) {
  return json({
    ok: true,
    requestId,
    idempotent,
    deal: {
      ...value,
      sourceRow: Number(row?.source_row || 0),
      detailRow: Number(row?.detail_row || 0),
    },
  }, 200);
}

function cleanRequestId(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9:_-]{8,160}$/.test(text) ? text : "";
}
