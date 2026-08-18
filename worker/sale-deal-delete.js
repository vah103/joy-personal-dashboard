import { parseSaleLedger } from "./finance-sales.js";
import { guardGoogleIntegration } from "./google-auth.js";
import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

const SALE_LEDGER_RANGE = "Sale!A1:E1000";
const SALE_SHEET_TITLE = "Sale";
const PERSONAL_FINANCE_YEAR = 2026;

export function isSaleDealDeleteRoute(pathname, request) {
  return pathname === "/api/sales/deals" && request.method === "DELETE";
}

export function monthTotalFormulaAfterDelete(block, sourceRow) {
  const remainingCount = (block?.deals || []).filter((deal) => deal.sourceRow !== sourceRow).length;
  if (!remainingCount) return "=0";
  const firstDealRow = Number(block.headerRow) + 1;
  const lastDetailRow = firstDealRow + remainingCount * 2 - 1;
  return `=SUM(E${firstDealRow}:E${lastDetailRow})`;
}

export async function handleSaleDealDeleteRequest(request, env) {
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const denied = await guardGoogleIntegration(request, env, "sheets");
  if (denied) return denied;

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
  if (!env.FINANCE_SPREADSHEET_ID) return json({ error: "FINANCE_SHEET_NOT_CONFIGURED" }, 503);

  const input = await readJson(request);
  const sourceRow = Number(input?.sourceRow || 0);
  const expectedMonth = cleanText(input?.month);
  const expectedCustomer = cleanText(input?.customer);
  const expectedAddress = cleanText(input?.address);
  if (!Number.isInteger(sourceRow) || sourceRow < 1) return json({ error: "SALE_ROW_INVALID" }, 400);

  try {
    const accessToken = await getSheetsAccessToken(session.user_email, env);
    const spreadsheetId = env.FINANCE_SPREADSHEET_ID;
    const sheet = await readSheetValues(accessToken, spreadsheetId, SALE_LEDGER_RANGE);
    const ledger = parseSaleLedger(sheet.values, PERSONAL_FINANCE_YEAR);
    const existing = ledger.months
      .flatMap((month) => month.deals)
      .find((deal) => deal.sourceRow === sourceRow);
    if (!existing) return json({ error: "SALE_DEAL_NOT_FOUND" }, 404);

    if (
      (expectedMonth && existing.month !== expectedMonth)
      || (expectedCustomer && existing.customer !== expectedCustomer)
      || (expectedAddress && existing.address !== expectedAddress)
    ) {
      return json({ error: "SALE_DEAL_CHANGED" }, 409);
    }

    const block = ledger.blocks.find((item) => item.key === existing.month);
    if (!block) return json({ error: "SALE_DEAL_NOT_FOUND" }, 404);
    const sheetId = await getSheetId(accessToken, spreadsheetId, SALE_SHEET_TITLE);
    const totalFormula = monthTotalFormulaAfterDelete(block, existing.sourceRow);

    await sheetsBatchUpdate(accessToken, spreadsheetId, [
      {
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: existing.sourceRow - 1,
            endIndex: existing.detailRow,
          },
        },
      },
      {
        updateCells: {
          range: {
            sheetId,
            startRowIndex: block.headingRow - 1,
            endRowIndex: block.headingRow,
            startColumnIndex: 4,
            endColumnIndex: 5,
          },
          rows: [{ values: [{ userEnteredValue: { formulaValue: totalFormula } }] }],
          fields: "userEnteredValue",
        },
      },
    ]);

    return json({
      ok: true,
      deleted: {
        sourceRow: existing.sourceRow,
        detailRow: existing.detailRow,
        month: existing.month,
      },
    });
  } catch (error) {
    return saleDeleteError(error);
  }
}

async function getSheetsAccessToken(email, env) {
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
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) {
    const error = new Error(`Google refresh failed: ${tokens.error || response.status}`);
    error.status = response.status;
    throw error;
  }

  const encrypted = await encryptSecret(tokens.access_token, env.TOKEN_ENCRYPTION_SECRET);
  const now = Date.now();
  await env.DB.prepare(`
    UPDATE oauth_tokens SET access_token_encrypted = ?, access_token_expires_at = ?, updated_at = ?
    WHERE user_email = ?
  `).bind(encrypted, now + Number(tokens.expires_in || 3600) * 1000, now, email).run();
  return tokens.access_token;
}

async function readSheetValues(accessToken, spreadsheetId, range) {
  const parameters = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${parameters}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw sheetApiError(response, payload);
  return payload;
}

async function sheetsBatchUpdate(accessToken, spreadsheetId, requests) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw sheetApiError(response, payload);
  return payload;
}

async function getSheetId(accessToken, spreadsheetId, title) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(sheetId,title)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw sheetApiError(response, payload);
  const sheet = (payload.sheets || []).find((item) => item.properties?.title === title);
  if (!sheet) {
    const error = new Error(`Sheet ${title} was not found`);
    error.status = 404;
    throw error;
  }
  return Number(sheet.properties.sheetId);
}

function sheetApiError(response, payload) {
  const error = new Error(`Google Sheets API returned ${response.status}`);
  error.status = response.status;
  error.reason = payload.error?.details?.find((detail) => detail.reason)?.reason
    || payload.error?.status
    || "";
  return error;
}

function saleDeleteError(error) {
  console.error("Deleting a Sale deal failed", error.status, error.reason);
  if (error.status === 401 || error.reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") {
    return json({ error: "SHEETS_WRITE_AUTHORIZATION_REQUIRED" }, 403);
  }
  if (error.reason === "SERVICE_DISABLED") return json({ error: "SHEETS_API_DISABLED" }, 503);
  if (error.status === 403) return json({ error: "SHEETS_WRITE_ACCESS_DENIED" }, 403);
  if (error.status === 404) return json({ error: "FINANCE_SHEET_NOT_FOUND" }, 404);
  return json({ error: "SALE_DEAL_DELETE_FAILED" }, 502);
}

function cleanText(value) {
  return String(value ?? "").trim();
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
