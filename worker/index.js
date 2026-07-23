import { normalizeUpcomingViewings } from "./sales.js";
import {
  monthHeading,
  parseFinanceTracker,
  parseSaleLedger,
  validateSaleDeal,
} from "./finance-sales.js";

const SESSION_COOKIE = "__Host-joy_session";
const OAUTH_STATE_COOKIE = "__Host-joy_oauth_state";
const PKCE_COOKIE = "__Host-joy_pkce";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;
const OAUTH_COOKIE_MAX_AGE = 10 * 60;
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const APPOINTMENTS_RANGE = "Appointments!A2:F";
const FINANCE_TRACKER_RANGE = "'Finance Tracker'!A1:AH40";
const SALE_LEDGER_RANGE = "Sale!A1:E1000";
const PERSONAL_FINANCE_YEAR = 2026;
const SALE_SHEET_TITLE = "Sale";

export default {
  async fetch(request, env, ctx) {
    try {
      return await routeRequest(request, env, ctx);
    } catch (error) {
      console.error("Joy Worker error", error);
      if (new URL(request.url).pathname.startsWith("/api/")) {
        return json({ error: "Joy could not complete this request." }, 500);
      }
      return htmlError("Joy ran into a server error. Please try again.", 500);
    }
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(syncEveryConnectedInbox(env));
  },
};

async function routeRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/auth/start" && request.method === "GET") return startGoogleAuthorization(request, env);
  if (pathname === "/auth/callback" && request.method === "GET") return finishGoogleAuthorization(request, env);
  if (pathname === "/api/health" && request.method === "GET") return json({ ok: true });
  if (pathname === "/api/session" && request.method === "GET") return sessionStatus(request, env);

  if (pathname.startsWith("/api/")) {
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "GET" && !isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

    if (pathname === "/api/emails" && request.method === "GET") return listEmails(session.user_email, env);
    if (pathname === "/api/sales/viewings" && request.method === "GET") return listUpcomingViewings(session.user_email, env);
    if (pathname === "/api/finance/summary" && request.method === "GET") return getFinanceSummary(session.user_email, env);
    if (pathname === "/api/sales/deals" && request.method === "GET") return listSaleDeals(session.user_email, env);
    if (pathname === "/api/sales/deals" && request.method === "POST") return addSaleDeal(request, session.user_email, env);
    if (pathname === "/api/sales/deals" && request.method === "PATCH") return updateSaleDeal(request, session.user_email, env);
    if (pathname === "/api/emails/pin" && request.method === "POST") return updateEmailPin(request, session.user_email, env);
    if (pathname === "/api/emails/dismiss" && request.method === "POST") return dismissEmail(request, session.user_email, env);
    if (pathname === "/api/emails/restore" && request.method === "POST") return restoreEmails(session.user_email, env);
    if (pathname === "/api/disconnect" && request.method === "POST") return disconnectGoogle(request, session.user_email, env);
    return json({ error: "NOT_FOUND" }, 404);
  }

  return env.ASSETS.fetch(request);
}

function requiredConfig(env) {
  const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALLOWED_EMAIL", "TOKEN_ENCRYPTION_SECRET"];
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing Worker secrets: ${missing.join(", ")}`);
}

async function startGoogleAuthorization(request, env) {
  requiredConfig(env);
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/auth/callback`;
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = await sha256Base64Url(verifier);

  const parameters = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `openid email ${GMAIL_SCOPE} ${GOOGLE_SHEETS_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const headers = new Headers({ Location: `https://accounts.google.com/o/oauth2/v2/auth?${parameters}` });
  headers.append("Set-Cookie", cookie(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_MAX_AGE));
  headers.append("Set-Cookie", cookie(PKCE_COOKIE, verifier, OAUTH_COOKIE_MAX_AGE));
  return new Response(null, { status: 302, headers });
}

async function finishGoogleAuthorization(request, env) {
  requiredConfig(env);
  const url = new URL(request.url);
  const cookies = readCookies(request);
  const state = url.searchParams.get("state") || "";
  const expectedState = cookies[OAUTH_STATE_COOKIE] || "";
  const verifier = cookies[PKCE_COOKIE] || "";
  const code = url.searchParams.get("code");

  if (!code || !verifier || !constantTimeEqual(state, expectedState)) {
    return htmlError("Google sign-in could not be verified. Return to Joy and try again.", 400);
  }

  const redirectUri = `${url.origin}/auth/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token || !tokens.id_token) {
    console.error("Google token exchange failed", tokens.error);
    return htmlError("Google did not complete the connection. Return to Joy and try again.", 400);
  }

  const identity = await verifyGoogleIdentity(tokens.id_token, env);
  if (!identity) return htmlError("This Google account is not allowed to open Joy.", 403);

  const email = identity.email.toLowerCase();
  const existing = await env.DB.prepare(
    "SELECT refresh_token_encrypted FROM oauth_tokens WHERE user_email = ?",
  ).bind(email).first();
  const refreshTokenEncrypted = tokens.refresh_token
    ? await encryptSecret(tokens.refresh_token, env.TOKEN_ENCRYPTION_SECRET)
    : existing?.refresh_token_encrypted;
  if (!refreshTokenEncrypted) {
    return htmlError("Google did not issue offline access. Remove Joy from Google Account permissions, then connect again.", 400);
  }

  const now = Date.now();
  const accessTokenEncrypted = await encryptSecret(tokens.access_token, env.TOKEN_ENCRYPTION_SECRET);
  await env.DB.prepare(`
    INSERT INTO oauth_tokens (
      user_email, refresh_token_encrypted, access_token_encrypted, access_token_expires_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      access_token_encrypted = excluded.access_token_encrypted,
      access_token_expires_at = excluded.access_token_expires_at,
      updated_at = excluded.updated_at
  `).bind(email, refreshTokenEncrypted, accessTokenEncrypted, now + Number(tokens.expires_in || 3600) * 1000, now).run();

  const session = await createSession(email, env);
  await syncGmail(email, env).catch((error) => console.error("Initial Gmail sync failed", error));

  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, session, SESSION_MAX_AGE));
  headers.append("Set-Cookie", clearCookie(OAUTH_STATE_COOKIE));
  headers.append("Set-Cookie", clearCookie(PKCE_COOKIE));
  return new Response(null, { status: 302, headers });
}

async function verifyGoogleIdentity(idToken, env) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) return null;
  const identity = await response.json();
  const verified = identity.email_verified === true || identity.email_verified === "true";
  const allowedEmail = String(env.ALLOWED_EMAIL).trim().toLowerCase();
  if (identity.aud !== env.GOOGLE_CLIENT_ID || !verified || identity.email?.toLowerCase() !== allowedEmail) return null;
  return identity;
}

async function createSession(email, env) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_email, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .bind(tokenHash, email, now + SESSION_MAX_AGE * 1000, now),
  ]);
  return token;
}

async function getSession(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return env.DB.prepare(
    "SELECT user_email, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?",
  ).bind(tokenHash, Date.now()).first();
}

async function sessionStatus(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ connected: false });
  const token = await env.DB.prepare("SELECT 1 AS connected FROM oauth_tokens WHERE user_email = ?")
    .bind(session.user_email).first();
  return json({ connected: Boolean(token), email: session.user_email });
}

async function getAccessToken(email, env) {
  const row = await env.DB.prepare(`
    SELECT refresh_token_encrypted, access_token_encrypted, access_token_expires_at
    FROM oauth_tokens WHERE user_email = ?
  `).bind(email).first();
  if (!row) throw new Error("Gmail is not connected");

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
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) throw new Error(`Google refresh failed: ${tokens.error || response.status}`);

  const encrypted = await encryptSecret(tokens.access_token, env.TOKEN_ENCRYPTION_SECRET);
  const now = Date.now();
  await env.DB.prepare(`
    UPDATE oauth_tokens SET access_token_encrypted = ?, access_token_expires_at = ?, updated_at = ?
    WHERE user_email = ?
  `).bind(encrypted, now + Number(tokens.expires_in || 3600) * 1000, now, email).run();
  return tokens.access_token;
}

async function gmailApi(accessToken, path) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const error = new Error(`Gmail API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function sheetsApi(accessToken, spreadsheetId, range, valueRenderOption = "FORMATTED_VALUE") {
  const parameters = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption,
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${parameters}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
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

async function sheetsSpreadsheetApi(accessToken, spreadsheetId, path = "", options = {}) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
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

async function sheetsBatchUpdate(accessToken, spreadsheetId, requests) {
  return sheetsSpreadsheetApi(accessToken, spreadsheetId, ":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

async function sheetsValuesBatchUpdate(accessToken, spreadsheetId, data, valueInputOption) {
  return sheetsSpreadsheetApi(accessToken, spreadsheetId, "/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({ valueInputOption, data }),
  });
}

async function getSheetId(accessToken, spreadsheetId, title) {
  const metadata = await sheetsSpreadsheetApi(
    accessToken,
    spreadsheetId,
    "?fields=sheets.properties(sheetId,title)",
  );
  const sheet = (metadata.sheets || []).find((item) => item.properties?.title === title);
  if (!sheet) {
    const error = new Error(`Sheet ${title} was not found`);
    error.status = 404;
    throw error;
  }
  return Number(sheet.properties.sheetId);
}

async function getFinanceSummary(email, env) {
  if (!env.FINANCE_SPREADSHEET_ID) return json({ error: "FINANCE_SHEET_NOT_CONFIGURED" }, 503);

  try {
    const accessToken = await getAccessToken(email, env);
    const [sheet, saleSheet] = await Promise.all([
      sheetsApi(accessToken, env.FINANCE_SPREADSHEET_ID, FINANCE_TRACKER_RANGE, "UNFORMATTED_VALUE"),
      sheetsApi(accessToken, env.FINANCE_SPREADSHEET_ID, SALE_LEDGER_RANGE, "UNFORMATTED_VALUE"),
    ]);
    const finance = parseFinanceTracker(sheet.values, {
      year: PERSONAL_FINANCE_YEAR,
      selectedMonth: vietnamMonthKey(),
    });
    const ledger = parseSaleLedger(saleSheet.values, PERSONAL_FINANCE_YEAR);
    const saleMonth = ledger.months.find((month) => month.key === finance.current.key) || { total: 0, count: 0 };
    return json({
      ...finance,
      sale: { income: saleMonth.total, count: saleMonth.count },
      gold: { chi: 0.5 },
      source: "2026 | Vanh / Finance Tracker",
      spreadsheetUrl: financeSpreadsheetUrl(env.FINANCE_SPREADSHEET_ID),
      fetchedAt: Date.now(),
    });
  } catch (error) {
    return personalSheetError("Finance sync failed", error);
  }
}

async function listSaleDeals(email, env) {
  if (!env.FINANCE_SPREADSHEET_ID) return json({ error: "FINANCE_SHEET_NOT_CONFIGURED" }, 503);

  try {
    const accessToken = await getAccessToken(email, env);
    const sheet = await sheetsApi(
      accessToken,
      env.FINANCE_SPREADSHEET_ID,
      SALE_LEDGER_RANGE,
      "UNFORMATTED_VALUE",
    );
    const ledger = parseSaleLedger(sheet.values, PERSONAL_FINANCE_YEAR);
    return json({
      year: ledger.year,
      months: ledger.months,
      selectedMonth: vietnamMonthKey(),
      source: "2026 | Vanh / Sale",
      fetchedAt: Date.now(),
    });
  } catch (error) {
    return personalSheetError("Sale ledger sync failed", error);
  }
}

async function addSaleDeal(request, email, env) {
  if (!env.FINANCE_SPREADSHEET_ID) return json({ error: "FINANCE_SHEET_NOT_CONFIGURED" }, 503);
  const validation = validateSaleDeal(await readJson(request));
  if (validation.error) return json({ error: validation.error }, 400);

  try {
    const accessToken = await getAccessToken(email, env);
    const spreadsheetId = env.FINANCE_SPREADSHEET_ID;
    const sheet = await sheetsApi(accessToken, spreadsheetId, SALE_LEDGER_RANGE, "UNFORMATTED_VALUE");
    const ledger = parseSaleLedger(sheet.values, PERSONAL_FINANCE_YEAR);
    const sheetId = await getSheetId(accessToken, spreadsheetId, SALE_SHEET_TITLE);
    const block = ledger.blocks.find((item) => item.key === validation.value.month);
    let primaryRow;

    if (block && block.headerIndex >= 0) {
      const insertIndex = block.headerIndex + 1;
      await insertRows(accessToken, spreadsheetId, sheetId, insertIndex, 2, false);
      primaryRow = insertIndex + 1;
      const lastDetailRow = block.deals.length
        ? Math.max(...block.deals.map((deal) => deal.detailRow)) + 2
        : primaryRow + 1;
      await writeSaleDeal(accessToken, spreadsheetId, primaryRow, validation.value);
      await writeMonthTotalFormula(
        accessToken,
        spreadsheetId,
        block.headingRow,
        block.headerRow + 1,
        lastDetailRow,
      );
    } else {
      const firstHeadingIndex = ledger.blocks.length
        ? Math.min(...ledger.blocks.map((item) => item.headingIndex))
        : 0;
      await insertRows(accessToken, spreadsheetId, sheetId, firstHeadingIndex, 6);
      if (ledger.blocks.length) {
        await copySaleBlockFormat(accessToken, spreadsheetId, sheetId, firstHeadingIndex, 6);
      }
      const headingRow = firstHeadingIndex + 1;
      const headerRow = headingRow + 2;
      primaryRow = headingRow + 3;
      await sheetsValuesBatchUpdate(accessToken, spreadsheetId, [
        { range: `Sale!B${headingRow}:B${headingRow}`, values: [[monthHeading(validation.value.month)]] },
        { range: `Sale!B${headerRow}:E${headerRow}`, values: [["Address", "Customer", "Host", "Commission"]] },
      ], "RAW");
      await writeSaleDeal(accessToken, spreadsheetId, primaryRow, validation.value);
      await writeMonthTotalFormula(accessToken, spreadsheetId, headingRow, primaryRow, primaryRow + 1);
    }

    return json({
      ok: true,
      deal: { ...validation.value, sourceRow: primaryRow, detailRow: primaryRow + 1 },
    }, 201);
  } catch (error) {
    return personalSheetError("Adding a Sale deal failed", error, true);
  }
}

async function updateSaleDeal(request, email, env) {
  if (!env.FINANCE_SPREADSHEET_ID) return json({ error: "FINANCE_SHEET_NOT_CONFIGURED" }, 503);
  const validation = validateSaleDeal(await readJson(request), { requireSourceRow: true });
  if (validation.error) return json({ error: validation.error }, 400);

  try {
    const accessToken = await getAccessToken(email, env);
    const spreadsheetId = env.FINANCE_SPREADSHEET_ID;
    const sheet = await sheetsApi(accessToken, spreadsheetId, SALE_LEDGER_RANGE, "UNFORMATTED_VALUE");
    const ledger = parseSaleLedger(sheet.values, PERSONAL_FINANCE_YEAR);
    const existing = ledger.months
      .flatMap((month) => month.deals)
      .find((deal) => deal.sourceRow === validation.value.sourceRow);
    if (!existing) return json({ error: "SALE_DEAL_NOT_FOUND" }, 404);
    if (existing.month !== validation.value.month) return json({ error: "SALE_MONTH_MOVE_NOT_SUPPORTED" }, 400);

    await writeSaleDeal(accessToken, spreadsheetId, existing.sourceRow, validation.value);
    return json({
      ok: true,
      deal: { ...validation.value, sourceRow: existing.sourceRow, detailRow: existing.detailRow },
    });
  } catch (error) {
    return personalSheetError("Updating a Sale deal failed", error, true);
  }
}

async function insertRows(accessToken, spreadsheetId, sheetId, startIndex, count, inheritFromBefore = true) {
  await sheetsBatchUpdate(accessToken, spreadsheetId, [{
    insertDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex,
        endIndex: startIndex + count,
      },
      inheritFromBefore: startIndex > 0 && inheritFromBefore,
    },
  }]);
}

async function copySaleBlockFormat(accessToken, spreadsheetId, sheetId, destinationStart, rowCount) {
  await sheetsBatchUpdate(accessToken, spreadsheetId, [{
    copyPaste: {
      source: {
        sheetId,
        startRowIndex: destinationStart + rowCount,
        endRowIndex: destinationStart + rowCount * 2,
        startColumnIndex: 0,
        endColumnIndex: 5,
      },
      destination: {
        sheetId,
        startRowIndex: destinationStart,
        endRowIndex: destinationStart + rowCount,
        startColumnIndex: 0,
        endColumnIndex: 5,
      },
      pasteType: "PASTE_FORMAT",
      pasteOrientation: "NORMAL",
    },
  }]);
}

async function writeSaleDeal(accessToken, spreadsheetId, primaryRow, deal) {
  await sheetsValuesBatchUpdate(accessToken, spreadsheetId, [
    {
      range: `Sale!B${primaryRow}:D${primaryRow}`,
      values: [[deal.address, deal.customer, deal.host]],
    },
    {
      range: `Sale!B${primaryRow + 1}:D${primaryRow + 1}`,
      values: [[deal.rent, deal.phone, deal.rate]],
    },
  ], "RAW");
  await sheetsValuesBatchUpdate(accessToken, spreadsheetId, [{
    range: `Sale!E${primaryRow}:E${primaryRow}`,
    values: [[`=B${primaryRow + 1}*D${primaryRow + 1}`]],
  }], "USER_ENTERED");
}

async function writeMonthTotalFormula(accessToken, spreadsheetId, headingRow, firstDealRow, lastDealRow) {
  await sheetsValuesBatchUpdate(accessToken, spreadsheetId, [{
    range: `Sale!E${headingRow}:E${headingRow}`,
    values: [[`=SUM(E${firstDealRow}:E${lastDealRow})`]],
  }], "USER_ENTERED");
}

function personalSheetError(label, error, write = false) {
  console.error(label, error.status, error.reason);
  if (error.status === 401 || error.reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") {
    return json({ error: write ? "SHEETS_WRITE_AUTHORIZATION_REQUIRED" : "SHEETS_AUTHORIZATION_REQUIRED" }, 403);
  }
  if (error.reason === "SERVICE_DISABLED") return json({ error: "SHEETS_API_DISABLED" }, 503);
  if (error.status === 403) return json({ error: write ? "SHEETS_WRITE_ACCESS_DENIED" : "FINANCE_SHEET_ACCESS_DENIED" }, 403);
  if (error.status === 404) return json({ error: "FINANCE_SHEET_NOT_FOUND" }, 404);
  return json({ error: write ? "SALE_WRITE_FAILED" : "FINANCE_SYNC_FAILED" }, 502);
}

function vietnamMonthKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function financeSpreadsheetUrl(spreadsheetId) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit#gid=980013791`;
}

async function listUpcomingViewings(email, env) {
  if (!env.SALE_SPREADSHEET_ID) return json({ error: "SALE_SHEET_NOT_CONFIGURED" }, 503);

  try {
    const accessToken = await getAccessToken(email, env);
    const sheet = await sheetsApi(accessToken, env.SALE_SPREADSHEET_ID, APPOINTMENTS_RANGE);
    const viewings = normalizeUpcomingViewings(sheet.values, Date.now());
    return json({
      viewings,
      count: viewings.length,
      source: "Sale phòng | GPTs / Appointments",
      timeZone: "Asia/Ho_Chi_Minh",
      fetchedAt: Date.now(),
    });
  } catch (error) {
    console.error("Sales sync failed", error.status, error.reason);
    if (error.status === 401 || error.reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") {
      return json({ error: "SHEETS_AUTHORIZATION_REQUIRED" }, 403);
    }
    if (error.reason === "SERVICE_DISABLED") return json({ error: "SHEETS_API_DISABLED" }, 503);
    if (error.status === 403) return json({ error: "SALE_SHEET_ACCESS_DENIED" }, 403);
    if (error.status === 404) return json({ error: "SALE_SHEET_NOT_FOUND" }, 404);
    return json({ error: "SALE_SYNC_FAILED" }, 502);
  }
}

async function syncGmail(email, env) {
  const now = Date.now();
  try {
    const accessToken = await getAccessToken(email, env);
    const preferences = await env.DB.prepare(`
      SELECT message_id, pinned, dismissed, updated_at
      FROM email_preferences WHERE user_email = ? ORDER BY updated_at DESC
    `).bind(email).all();
    const dismissed = new Set(preferences.results.filter((row) => row.dismissed).map((row) => row.message_id));
    const pinnedIds = preferences.results
      .filter((row) => row.pinned && !row.dismissed)
      .map((row) => row.message_id);

    const listQuery = new URLSearchParams({ maxResults: "25", q: "is:unread in:inbox" });
    const list = await gmailApi(accessToken, `/messages?${listQuery}`);
    const unreadIds = (list.messages || [])
      .map((message) => String(message.id))
      .filter((id) => !dismissed.has(id))
      .slice(0, 5);
    const ids = [...new Set([...pinnedIds, ...unreadIds])];

    const messages = (await Promise.all(ids.map(async (id) => {
      try {
        const detailsQuery = new URLSearchParams({ format: "metadata" });
        ["From", "Subject", "Date"].forEach((name) => detailsQuery.append("metadataHeaders", name));
        const message = await gmailApi(accessToken, `/messages/${encodeURIComponent(id)}?${detailsQuery}`);
        return normalizeGmailMessage(message, pinnedIds.includes(id));
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    }))).filter(Boolean);

    const statements = [env.DB.prepare("DELETE FROM email_cache WHERE user_email = ?").bind(email)];
    messages.forEach((message, index) => {
      statements.push(env.DB.prepare(`
        INSERT INTO email_cache (
          user_email, message_id, thread_id, sender, subject, snippet, message_date, unread, pinned, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        email,
        message.id,
        message.threadId,
        message.sender,
        message.subject,
        message.snippet,
        message.date,
        message.unread ? 1 : 0,
        message.pinned ? 1 : 0,
        now - index,
      ));
    });
    statements.push(env.DB.prepare(`
      INSERT INTO gmail_sync (user_email, last_synced_at, last_error) VALUES (?, ?, NULL)
      ON CONFLICT(user_email) DO UPDATE SET last_synced_at = excluded.last_synced_at, last_error = NULL
    `).bind(email, now));
    await env.DB.batch(statements);
    return messages;
  } catch (error) {
    await env.DB.prepare(`
      INSERT INTO gmail_sync (user_email, last_synced_at, last_error) VALUES (?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET last_error = excluded.last_error
    `).bind(email, 0, String(error.message || error).slice(0, 300)).run();
    throw error;
  }
}

function normalizeGmailMessage(message, pinned) {
  const headers = message.payload?.headers || [];
  const header = (name) => headers.find((item) => String(item.name).toLowerCase() === name.toLowerCase())?.value || "";
  return {
    id: String(message.id),
    threadId: String(message.threadId || message.id),
    sender: senderName(header("From")),
    subject: header("Subject") || "(No subject)",
    snippet: message.snippet || "",
    date: header("Date"),
    unread: Array.isArray(message.labelIds) ? message.labelIds.includes("UNREAD") : true,
    pinned,
  };
}

function senderName(from) {
  const value = String(from || "Unknown sender");
  const withoutAddress = value.replace(/\s*<[^>]+>\s*$/, "").replace(/^"|"$/g, "").trim();
  return withoutAddress || value.split("@")[0];
}

async function listEmails(email, env) {
  const sync = await env.DB.prepare("SELECT last_synced_at, last_error FROM gmail_sync WHERE user_email = ?")
    .bind(email).first();
  let syncError = sync?.last_error || null;
  if (!sync || Number(sync.last_synced_at) < Date.now() - 45_000) {
    try {
      await syncGmail(email, env);
      syncError = null;
    } catch (error) {
      syncError = String(error.message || error);
    }
  }

  const [cache, hidden, updated] = await Promise.all([
    env.DB.prepare(`
      SELECT message_id, thread_id, sender, subject, snippet, message_date, unread, pinned
      FROM email_cache WHERE user_email = ? ORDER BY pinned DESC, fetched_at DESC
    `).bind(email).all(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM email_preferences WHERE user_email = ? AND dismissed = 1")
      .bind(email).first(),
    env.DB.prepare("SELECT last_synced_at FROM gmail_sync WHERE user_email = ?").bind(email).first(),
  ]);

  return json({
    messages: cache.results.map((row) => ({
      id: row.message_id,
      threadId: row.thread_id,
      sender: row.sender,
      subject: row.subject,
      snippet: row.snippet,
      date: row.message_date,
      unread: Boolean(row.unread),
      pinned: Boolean(row.pinned),
    })),
    hiddenCount: Number(hidden?.count || 0),
    syncedAt: Number(updated?.last_synced_at || 0),
    syncError,
  });
}

async function updateEmailPin(request, email, env) {
  const body = await readJson(request);
  const id = String(body.id || "");
  if (!id) return json({ error: "MESSAGE_ID_REQUIRED" }, 400);
  const pinned = body.pinned ? 1 : 0;
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO email_preferences (user_email, message_id, pinned, dismissed, updated_at)
      VALUES (?, ?, ?, 0, ?)
      ON CONFLICT(user_email, message_id) DO UPDATE SET
        pinned = excluded.pinned, dismissed = 0, updated_at = excluded.updated_at
    `).bind(email, id, pinned, now),
    env.DB.prepare("UPDATE email_cache SET pinned = ? WHERE user_email = ? AND message_id = ?")
      .bind(pinned, email, id),
  ]);
  return json({ ok: true, pinned: Boolean(pinned) });
}

async function dismissEmail(request, email, env) {
  const body = await readJson(request);
  const id = String(body.id || "");
  if (!id) return json({ error: "MESSAGE_ID_REQUIRED" }, 400);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO email_preferences (user_email, message_id, pinned, dismissed, updated_at)
      VALUES (?, ?, 0, 1, ?)
      ON CONFLICT(user_email, message_id) DO UPDATE SET
        pinned = 0, dismissed = 1, updated_at = excluded.updated_at
    `).bind(email, id, now),
    env.DB.prepare("DELETE FROM email_cache WHERE user_email = ? AND message_id = ?").bind(email, id),
  ]);
  return json({ ok: true });
}

async function restoreEmails(email, env) {
  await env.DB.prepare("UPDATE email_preferences SET dismissed = 0, updated_at = ? WHERE user_email = ? AND dismissed = 1")
    .bind(Date.now(), email).run();
  await syncGmail(email, env);
  return json({ ok: true });
}

async function disconnectGoogle(request, email, env) {
  const row = await env.DB.prepare("SELECT refresh_token_encrypted FROM oauth_tokens WHERE user_email = ?")
    .bind(email).first();
  if (row?.refresh_token_encrypted) {
    const refreshToken = await decryptSecret(row.refresh_token_encrypted, env.TOKEN_ENCRYPTION_SECRET);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    }).catch(() => {});
  }

  const sessionToken = readCookies(request)[SESSION_COOKIE];
  const sessionHash = sessionToken ? await sha256Hex(sessionToken) : "";
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_email = ? OR token_hash = ?").bind(email, sessionHash),
    env.DB.prepare("DELETE FROM oauth_tokens WHERE user_email = ?").bind(email),
    env.DB.prepare("DELETE FROM email_cache WHERE user_email = ?").bind(email),
    env.DB.prepare("DELETE FROM email_preferences WHERE user_email = ?").bind(email),
    env.DB.prepare("DELETE FROM gmail_sync WHERE user_email = ?").bind(email),
  ]);

  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  return new Response(JSON.stringify({ ok: true }), { headers });
}

async function syncEveryConnectedInbox(env) {
  requiredConfig(env);
  const users = await env.DB.prepare("SELECT user_email FROM oauth_tokens").all();
  await Promise.allSettled(users.results.map(({ user_email: email }) => syncGmail(email, env)));
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()).run();
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

function randomToken(length) {
  return base64Url(crypto.getRandomValues(new Uint8Array(length)));
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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

function constantTimeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function readCookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [name, rest.join("=")];
  }).filter(([name]) => name));
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name) {
  return cookie(name, "", 0);
}

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function htmlError(message, status) {
  const safeMessage = String(message).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Joy</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eceff2;color:#22272e;font:16px system-ui}.card{max-width:480px;margin:20px;padding:28px;border:1px solid #d7dce2;border-radius:18px;background:#fff}a{color:#405c76;font-weight:700}</style><div class="card"><h1>Joy could not connect</h1><p>${safeMessage}</p><a href="/">Return to dashboard</a></div></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
