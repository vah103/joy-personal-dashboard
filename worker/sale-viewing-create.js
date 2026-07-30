import { isSameOrigin, json } from "./shared/http.js";
import { getSession, sha256Hex } from "./shared/session.js";

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const APPOINTMENTS_APPEND_RANGE = "Appointments!A:F";
const SHORT_NOTICE_MS = 60 * 60 * 1000;

export function isSaleViewingCreateRoute(pathname, method = "") {
  return pathname === "/api/sales/viewings" && String(method).toUpperCase() === "POST";
}

export function validateSaleViewingInput(input, now = Date.now()) {
  const phone = cleanPhone(input?.phone);
  const viewingAddress = cleanText(input?.viewingAddress, 220);
  const suppliedCustomerName = cleanText(input?.customerName, 100);
  const viewingAt = new Date(input?.viewingAt || "");
  const timestamp = viewingAt.getTime();

  if (!viewingAddress) return { error: "VIEWING_ADDRESS_REQUIRED" };
  if (!Number.isFinite(timestamp)) return { error: "VIEWING_TIME_REQUIRED" };
  if (timestamp < now - 10 * 60 * 1000) return { error: "VIEWING_TIME_IN_PAST" };
  if (timestamp > now + 366 * 24 * 60 * 60 * 1000) return { error: "VIEWING_TIME_TOO_FAR" };

  const customerName = suppliedCustomerName
    || (phone ? `Khách ${phone}` : `Khách xem phòng ${viewingAddress}`);
  const shortNoticeAppointment = timestamp - now < SHORT_NOTICE_MS;
  const beforeStatus = shortNoticeAppointment
    ? "EMAIL_MODE=SHORT_NOTICE; BEFORE_SKIPPED"
    : "EMAIL_MODE=NORMAL; BEFORE_PENDING";
  const afterStatus = "AFTER_PENDING";
  const reminderMessage = shortNoticeAppointment
    ? "Đã lưu lịch xem phòng. Hệ thống sẽ gửi email hỏi lại sau 2 tiếng."
    : "Đã lưu lịch xem phòng. Hệ thống sẽ gửi email nhắc đúng giờ xem và email hỏi lại sau 5 tiếng.";

  return {
    value: {
      customerName,
      phone,
      viewingAddress,
      viewingAt: viewingAt.toISOString(),
      viewingTime: formatSheetViewingTime(viewingAt),
      shortNoticeAppointment,
      beforeStatus,
      afterStatus,
      reminderMessage,
    },
  };
}

export function formatSheetViewingTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

export async function handleSaleViewingCreate(request, env) {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
  if (!env.SALE_SPREADSHEET_ID) return json({ error: "SALE_SHEET_NOT_CONFIGURED" }, 503);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const input = await request.json().catch(() => null);
  const validation = validateSaleViewingInput(input);
  if (validation.error) return json({ error: validation.error }, 400);

  try {
    const accessToken = await getAccessToken(session.user_email, env);
    const appointment = validation.value;
    const result = await appendViewing(accessToken, env.SALE_SPREADSHEET_ID, appointment);
    return json({
      ok: true,
      message: appointment.reminderMessage,
      viewing: {
        customerName: appointment.customerName,
        phone: appointment.phone,
        viewingAddress: appointment.viewingAddress,
        viewingAt: appointment.viewingAt,
        viewingTime: appointment.viewingTime,
        sourceRow: updatedRowNumber(result?.updates?.updatedRange),
        beforeStatus: appointment.beforeStatus,
        afterStatus: appointment.afterStatus,
        shortNoticeAppointment: appointment.shortNoticeAppointment,
      },
    }, 201);
  } catch (error) {
    console.error("Creating Sale viewing failed", error.status, error.reason);
    if (error.status === 401 || error.reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") {
      return json({ error: "SHEETS_WRITE_AUTHORIZATION_REQUIRED" }, 403);
    }
    if (error.reason === "SERVICE_DISABLED") return json({ error: "SHEETS_API_DISABLED" }, 503);
    if (error.status === 403) return json({ error: "SALE_SHEET_ACCESS_DENIED" }, 403);
    if (error.status === 404) return json({ error: "SALE_SHEET_NOT_FOUND" }, 404);
    return json({ error: "VIEWING_CREATE_FAILED" }, 502);
  }
}

async function appendViewing(accessToken, spreadsheetId, appointment) {
  const parameters = new URLSearchParams({
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
  });
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(APPOINTMENTS_APPEND_RANGE)}:append?${parameters}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [[
          appointment.customerName,
          appointment.phone,
          appointment.viewingAddress,
          appointment.viewingTime,
          appointment.beforeStatus,
          appointment.afterStatus,
        ]],
      }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Google Sheets API returned ${response.status}`);
    error.status = response.status;
    error.reason = payload.error?.details?.find((detail) => detail.reason)?.reason
      || payload.error?.status
      || "";
    throw error;
  }
  return payload;
}

function updatedRowNumber(range) {
  const match = String(range || "").match(/![A-Z]+(\d+):/i);
  return match ? Number(match[1]) : null;
}

function cleanText(value, maximum) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanPhone(value) {
  const phone = String(value || "").replace(/[^\d+]/g, "").replace(/^\+84/, "0");
  return phone.slice(0, 20);
}

async function getAccessToken(email, env) {
  const row = await env.DB.prepare(`
    SELECT refresh_token_encrypted, access_token_encrypted, access_token_expires_at
    FROM oauth_tokens WHERE user_email = ?
  `).bind(email).first();
  if (!row) {
    const error = new Error("Google Sheets is not connected");
    error.status = 401;
    throw error;
  }

  if (row.access_token_encrypted && Number(row.access_token_expires_at) > Date.now() + 120_000) {
    return decryptSecret(row.access_token_encrypted, env.TOKEN_ENCRYPTION_SECRET);
  }

  const refreshToken = await decryptSecret(row.refresh_token_encrypted, env.TOKEN_ENCRYPTION_SECRET);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await response.json().catch(() => ({}));
  if (!response.ok || !tokens.access_token) {
    const error = new Error(`Google refresh failed: ${tokens.error || response.status}`);
    error.status = response.status;
    throw error;
  }

  const encrypted = await encryptSecret(tokens.access_token, env.TOKEN_ENCRYPTION_SECRET);
  const now = Date.now();
  await env.DB.prepare(`
    UPDATE oauth_tokens
    SET access_token_encrypted = ?, access_token_expires_at = ?, updated_at = ?
    WHERE user_email = ?
  `).bind(
    encrypted,
    now + Number(tokens.expires_in || 3600) * 1000,
    now,
    email,
  ).run();
  return tokens.access_token;
}

async function encryptSecret(value, secret) {
  const key = await encryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(String(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function decryptSecret(value, secret) {
  const [ivPart, encryptedPart] = String(value).split(".");
  if (!ivPart || !encryptedPart) throw new Error("Stored token is invalid");
  const key = await encryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(encryptedPart),
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(secret)));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
