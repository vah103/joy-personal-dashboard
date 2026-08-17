import { isSameOrigin, json } from "./shared/http.js";
import { getSession } from "./shared/session.js";
import { sendPushToUser } from "./shared/push-send.js";

const REMINDER_LEAD_MS = 30 * 60 * 1000;
const FOLLOWUP_DELAY_MS = 2 * 60 * 60 * 1000;
const MAX_LATE_MS = 24 * 60 * 60 * 1000;
const RETRY_AFTER_MS = 2 * 60 * 1000;
const DEAL_LOCK_REVIEW_MS = 2 * 60 * 1000;
const CLOSED_STATES = new Set(["pending", "received"]);

export function isSaleViewingRoute(pathname) {
  return pathname === "/api/sales/viewings";
}

export async function handleSaleViewingRequest(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  if (request.method === "GET") return listViewings(session.user_email, env);
  if (request.method === "POST") {
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
    return createViewing(request, session.user_email, env);
  }
  if (request.method === "PATCH") {
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
    return updateViewing(request, session.user_email, env);
  }
  return json({ error: "METHOD_NOT_ALLOWED" }, 405);
}

async function listViewings(email, env) {
  const now = Date.now();
  const rows = await env.DB.prepare(`
    SELECT sale_viewings.id, customer_name, phone, viewing_address, viewing_at,
           reminder_at, reminder_notified_at, followup_at, followup_notified_at,
           cancelled_at, created_at, sale_viewings.updated_at AS updated_at,
           c.state AS commission_state,
           l.locked_at AS deal_locked_at
    FROM sale_viewings
    LEFT JOIN sale_viewing_commissions c
      ON c.viewing_id = sale_viewings.id AND c.user_email = sale_viewings.user_email
    LEFT JOIN sale_viewing_deal_locks l
      ON l.viewing_id = sale_viewings.id AND l.user_email = sale_viewings.user_email
    WHERE sale_viewings.user_email = ?
    ORDER BY viewing_at DESC, created_at DESC
    LIMIT 300
  `).bind(email).all();

  const history = (rows.results || []).map((row) => serializeViewing(row, now));
  const viewings = history
    .filter((viewing) => viewing.status === "upcoming" && !viewing.dealSaved && !viewing.dealSaving)
    .sort((a, b) => a.viewingAt.localeCompare(b.viewingAt));

  return json({
    viewings,
    history,
    count: viewings.length,
    source: "Joy D1 / sale_viewings",
    fetchedAt: now,
  });
}

async function createViewing(request, email, env) {
  const input = await request.json().catch(() => null);
  const validation = validateViewing(input);
  if (validation.error) return json({ error: validation.error }, 400);

  const now = Date.now();
  const viewing = validation.value;
  const id = crypto.randomUUID();
  const reminderAt = viewing.viewingAt - now >= REMINDER_LEAD_MS
    ? viewing.viewingAt - REMINDER_LEAD_MS
    : null;
  const followupAt = viewing.viewingAt + FOLLOWUP_DELAY_MS;

  await env.DB.prepare(`
    INSERT INTO sale_viewings (
      id, user_email, customer_name, phone, viewing_address, viewing_at,
      reminder_at, reminder_notified_at, followup_at, followup_notified_at,
      cancelled_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?)
  `).bind(
    id,
    email,
    viewing.customerName,
    viewing.phone,
    viewing.viewingAddress,
    viewing.viewingAt,
    reminderAt,
    followupAt,
    now,
    now,
  ).run();

  return json({
    ok: true,
    message: reminderAt
      ? "Đã lưu lịch. Joy sẽ nhắc bạn trước 30 phút và hỏi lại sau buổi xem."
      : "Đã lưu lịch. Lịch quá sát giờ để nhắc trước 30 phút; Joy vẫn sẽ hỏi lại sau buổi xem.",
    viewing: serializeViewing({
      id,
      customer_name: viewing.customerName,
      phone: viewing.phone,
      viewing_address: viewing.viewingAddress,
      viewing_at: viewing.viewingAt,
      reminder_at: reminderAt,
      reminder_notified_at: null,
      followup_at: followupAt,
      followup_notified_at: null,
      cancelled_at: null,
      created_at: now,
      updated_at: now,
      commission_state: null,
      deal_locked_at: null,
    }, now),
  }, 201);
}

async function updateViewing(request, email, env) {
  const input = await request.json().catch(() => null);
  const id = cleanText(input?.id, 120);
  if (!id) return json({ error: "VIEWING_ID_REQUIRED" }, 400);

  if (input?.dealSaved === true) {
    return markDealSaved(id, email, env);
  }

  const existing = await env.DB.prepare(`
    SELECT id, customer_name, phone, viewing_address, viewing_at,
           reminder_at, reminder_notified_at, followup_at, followup_notified_at,
           cancelled_at, created_at, updated_at
    FROM sale_viewings
    WHERE id = ? AND user_email = ?
    LIMIT 1
  `).bind(id, email).first();
  if (!existing) return json({ error: "VIEWING_NOT_FOUND" }, 404);

  const writeState = await viewingWriteState(id, email, env);
  if (writeState.error) return json({ error: writeState.error }, 409);

  const validation = validateViewing(input, { allowPast: true });
  if (validation.error) return json({ error: validation.error }, 400);

  const now = Date.now();
  const viewing = validation.value;
  const timeChanged = Number(existing.viewing_at) !== viewing.viewingAt;

  let reminderAt = nullableNumber(existing.reminder_at);
  let reminderNotifiedAt = nullableNumber(existing.reminder_notified_at);
  let followupAt = nullableNumber(existing.followup_at);
  let followupNotifiedAt = nullableNumber(existing.followup_notified_at);

  if (timeChanged) {
    reminderAt = viewing.viewingAt - now >= REMINDER_LEAD_MS
      ? viewing.viewingAt - REMINDER_LEAD_MS
      : null;
    reminderNotifiedAt = null;
    followupAt = viewing.viewingAt > now
      ? viewing.viewingAt + FOLLOWUP_DELAY_MS
      : null;
    followupNotifiedAt = null;
  }

  const result = await env.DB.prepare(`
    UPDATE sale_viewings
    SET customer_name = ?, phone = ?, viewing_address = ?, viewing_at = ?,
        reminder_at = ?, reminder_notified_at = ?,
        followup_at = ?, followup_notified_at = ?, updated_at = ?
    WHERE id = ? AND user_email = ?
  `).bind(
    viewing.customerName,
    viewing.phone,
    viewing.viewingAddress,
    viewing.viewingAt,
    reminderAt,
    reminderNotifiedAt,
    followupAt,
    followupNotifiedAt,
    now,
    id,
    email,
  ).run();

  if (!Number(result.meta?.changes || 0)) return json({ error: "VIEWING_NOT_FOUND" }, 404);

  return json({
    ok: true,
    message: "Đã cập nhật lịch hẹn.",
    viewing: serializeViewing({
      ...existing,
      customer_name: viewing.customerName,
      phone: viewing.phone,
      viewing_address: viewing.viewingAddress,
      viewing_at: viewing.viewingAt,
      reminder_at: reminderAt,
      reminder_notified_at: reminderNotifiedAt,
      followup_at: followupAt,
      followup_notified_at: followupNotifiedAt,
      updated_at: now,
      commission_state: null,
      deal_locked_at: null,
    }, now),
  });
}

async function viewingWriteState(id, email, env) {
  const row = await env.DB.prepare(`
    SELECT c.state AS commission_state, l.locked_at AS deal_locked_at
    FROM sale_viewings v
    LEFT JOIN sale_viewing_commissions c
      ON c.viewing_id = v.id AND c.user_email = v.user_email
    LEFT JOIN sale_viewing_deal_locks l
      ON l.viewing_id = v.id AND l.user_email = v.user_email
    WHERE v.id = ? AND v.user_email = ?
    LIMIT 1
  `).bind(id, email).first();
  if (CLOSED_STATES.has(String(row?.commission_state || ""))) {
    return { error: "VIEWING_ALREADY_CLOSED" };
  }
  const lockedAt = Number(row?.deal_locked_at || 0);
  if (lockedAt) {
    return {
      error: Date.now() - lockedAt >= DEAL_LOCK_REVIEW_MS
        ? "SALE_DEAL_SAVE_REVIEW_REQUIRED"
        : "SALE_DEAL_SAVE_IN_PROGRESS",
    };
  }
  return { error: "" };
}

async function markDealSaved(id, email, env) {
  const writeState = await viewingWriteState(id, email, env);
  if (writeState.error === "VIEWING_ALREADY_CLOSED") return json({ ok: true, dealSaved: true });
  if (writeState.error) return json({ error: writeState.error }, 409);

  const now = Date.now();
  const result = await env.DB.prepare(`
    INSERT INTO sale_viewing_commissions (viewing_id, user_email, state, updated_at)
    SELECT id, user_email, 'pending', ?
    FROM sale_viewings
    WHERE id = ? AND user_email = ?
    ON CONFLICT(viewing_id) DO UPDATE SET
      user_email = excluded.user_email,
      updated_at = excluded.updated_at
  `).bind(now, id, email).run();

  if (!Number(result.meta?.changes || 0)) return json({ error: "VIEWING_NOT_FOUND" }, 404);
  return json({ ok: true, dealSaved: true });
}

function validateViewing(input, { allowPast = false } = {}) {
  const phone = cleanPhone(input?.phone);
  const viewingAddress = cleanText(input?.viewingAddress, 220);
  const suppliedCustomerName = cleanText(input?.customerName, 100);
  const timestamp = new Date(input?.viewingAt || "").getTime();
  const now = Date.now();

  if (!viewingAddress) return { error: "VIEWING_ADDRESS_REQUIRED" };
  if (!Number.isFinite(timestamp)) return { error: "VIEWING_TIME_REQUIRED" };
  if (!allowPast && timestamp < now - 10 * 60 * 1000) return { error: "VIEWING_TIME_IN_PAST" };
  if (timestamp > now + 366 * 24 * 60 * 60 * 1000) return { error: "VIEWING_TIME_TOO_FAR" };

  return {
    value: {
      customerName: suppliedCustomerName
        || (phone ? `Khách ${phone}` : `Khách xem phòng ${viewingAddress}`),
      phone,
      viewingAddress,
      viewingAt: timestamp,
    },
  };
}

function serializeViewing(row, now = Date.now()) {
  const viewingAt = Number(row.viewing_at);
  const cancelledAt = nullableNumber(row.cancelled_at);
  const lockedAt = nullableNumber(row.deal_locked_at);
  const status = cancelledAt ? "cancelled" : viewingAt < now ? "past" : "upcoming";
  const dealSaved = CLOSED_STATES.has(String(row.commission_state || ""));
  return {
    id: String(row.id || ""),
    customerName: String(row.customer_name || "").trim(),
    phone: String(row.phone || "").trim(),
    viewingAddress: String(row.viewing_address || "").trim(),
    viewingAt: new Date(viewingAt).toISOString(),
    status,
    dealSaved,
    dealSaving: !dealSaved && Boolean(lockedAt),
    dealSavingSince: !dealSaved && lockedAt ? new Date(lockedAt).toISOString() : "",
    reminderAt: isoOrEmpty(row.reminder_at),
    reminderNotifiedAt: isoOrEmpty(row.reminder_notified_at),
    followupAt: isoOrEmpty(row.followup_at),
    followupNotifiedAt: isoOrEmpty(row.followup_notified_at),
    createdAt: isoOrEmpty(row.created_at),
    updatedAt: isoOrEmpty(row.updated_at),
  };
}

export async function runSaleViewingSchedule(env) {
  if (!(env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)) return;
  await Promise.allSettled([
    processReminderPushes(env),
    processFollowupPushes(env),
  ]);
}

async function processReminderPushes(env) {
  const now = Date.now();
  const rows = await env.DB.prepare(`
    SELECT id, user_email, customer_name, viewing_address, viewing_at, reminder_at
    FROM sale_viewings
    WHERE cancelled_at IS NULL
      AND reminder_at IS NOT NULL
      AND reminder_notified_at IS NULL
      AND reminder_at <= ?
      AND reminder_at >= ?
      AND NOT EXISTS (
        SELECT 1 FROM sale_viewing_commissions c
        WHERE c.viewing_id = sale_viewings.id
          AND c.user_email = sale_viewings.user_email
          AND c.state IN ('pending', 'received')
      )
      AND NOT EXISTS (
        SELECT 1 FROM sale_viewing_deal_locks l
        WHERE l.viewing_id = sale_viewings.id
          AND l.user_email = sale_viewings.user_email
      )
    ORDER BY reminder_at ASC
    LIMIT 30
  `).bind(now, now - MAX_LATE_MS).all();

  for (const row of rows.results || []) {
    const attemptAt = Date.now();
    const claimed = await claimNotification(row.id, "reminder_notified_at", attemptAt, env);
    if (!claimed) continue;
    const accepted = await sendPushToUser(row.user_email, {
      title: "Lịch xem phòng sắp tới",
      body: `${formatVietnamClock(row.viewing_at)} · ${row.customer_name}\n${row.viewing_address}`,
      icon: "/app-icon-192.png",
      badge: "/app-icon-64.png",
      tag: `hey-joy-sale-viewing-${row.id}`,
      renotify: true,
      data: { url: "/#sales", kind: "sale-viewing-reminder", viewingId: row.id },
    }, env, { ttl: 60 * 60, urgency: "high" });
    if (!accepted) await releaseNotification(row.id, "reminder_notified_at", attemptAt, env);
  }
}

async function processFollowupPushes(env) {
  const now = Date.now();
  const rows = await env.DB.prepare(`
    SELECT id, user_email, customer_name, viewing_address, followup_at
    FROM sale_viewings
    WHERE cancelled_at IS NULL
      AND followup_at IS NOT NULL
      AND followup_notified_at IS NULL
      AND followup_at <= ?
      AND followup_at >= ?
      AND NOT EXISTS (
        SELECT 1 FROM sale_viewing_commissions c
        WHERE c.viewing_id = sale_viewings.id
          AND c.user_email = sale_viewings.user_email
          AND c.state IN ('pending', 'received')
      )
      AND NOT EXISTS (
        SELECT 1 FROM sale_viewing_deal_locks l
        WHERE l.viewing_id = sale_viewings.id
          AND l.user_email = sale_viewings.user_email
      )
    ORDER BY followup_at ASC
    LIMIT 30
  `).bind(now, now - MAX_LATE_MS).all();

  for (const row of rows.results || []) {
    const attemptAt = Date.now();
    const claimed = await claimNotification(row.id, "followup_notified_at", attemptAt, env);
    if (!claimed) continue;
    const accepted = await sendPushToUser(row.user_email, {
      title: "Theo dõi khách xem phòng",
      body: `${row.customer_name} đã xem phòng tại ${row.viewing_address}. Bạn đã follow-up khách chưa?`,
      icon: "/app-icon-192.png",
      badge: "/app-icon-64.png",
      tag: `hey-joy-sale-followup-${row.id}`,
      renotify: true,
      data: { url: "/#sales", kind: "sale-viewing-followup", viewingId: row.id },
    }, env, { ttl: 6 * 60 * 60, urgency: "normal" });
    if (!accepted) await releaseNotification(row.id, "followup_notified_at", attemptAt, env);
  }
}

async function claimNotification(id, column, attemptAt, env) {
  if (!new Set(["reminder_notified_at", "followup_notified_at"]).has(column)) return false;
  const result = await env.DB.prepare(`
    UPDATE sale_viewings
    SET ${column} = ?, updated_at = ?
    WHERE id = ? AND cancelled_at IS NULL
      AND (${column} IS NULL OR ${column} <= ?)
      AND NOT EXISTS (
        SELECT 1 FROM sale_viewing_commissions c
        WHERE c.viewing_id = sale_viewings.id
          AND c.user_email = sale_viewings.user_email
          AND c.state IN ('pending', 'received')
      )
      AND NOT EXISTS (
        SELECT 1 FROM sale_viewing_deal_locks l
        WHERE l.viewing_id = sale_viewings.id
          AND l.user_email = sale_viewings.user_email
      )
  `).bind(attemptAt, attemptAt, id, attemptAt - RETRY_AFTER_MS).run();
  return Number(result.meta?.changes || 0) > 0;
}

async function releaseNotification(id, column, attemptAt, env) {
  if (!new Set(["reminder_notified_at", "followup_notified_at"]).has(column)) return;
  await env.DB.prepare(`
    UPDATE sale_viewings
    SET ${column} = NULL, updated_at = ?
    WHERE id = ? AND ${column} = ?
  `).bind(Date.now(), id, attemptAt).run();
}

function formatVietnamClock(timestamp) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(Number(timestamp)));
}

function cleanText(value, maximum) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").replace(/^\+84/, "0").slice(0, 20);
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isoOrEmpty(value) {
  const number = nullableNumber(value);
  return number ? new Date(number).toISOString() : "";
}
