import { JoyCoreError } from "./joy-core/service.js";

export const IELTS_REVIEW_DOCUMENT_ID = "1y_WC_yO7xFyFoniGUt3yISgLxq6mP3hBQFWahSzSueQ";
export const IELTS_REVIEW_DOCUMENT_TITLE = "New Ielts new me | Vanh";

const MAX_CONTENT_CHARS = 50_000;
const MAX_TAB_TITLE_CHARS = 120;
const MAX_CLIENT_REQUEST_ID_CHARS = 80;

function requiredText(value, field, maxLength) {
  const text = String(value || "").trim();
  if (!text) throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_INVALID_INPUT", 400, { field });
  if (text.length > maxLength) {
    throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_INVALID_INPUT", 400, { field, maxLength });
  }
  return text;
}

function normalizedDate(value) {
  const date = requiredText(value, "date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_INVALID_DATE", 400, { date });
  }
  return date;
}

function defaultTabTitle(date) {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year} · IELTS Review`;
}

function configuredWebAppUrl(env) {
  const value = String(env?.JOY_IELTS_DOCS_WEB_APP_URL || "").trim();
  if (!value) throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_NOT_CONFIGURED", 503);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_NOT_CONFIGURED", 503);
  }
  if (url.protocol !== "https:" || url.hostname !== "script.google.com") {
    throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_WEB_APP_INVALID", 503);
  }
  return url.toString();
}

function configuredSecret(env) {
  const value = String(env?.JOY_IELTS_DOCS_WEBHOOK_SECRET || "").trim();
  if (!value) throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_NOT_CONFIGURED", 503);
  return value;
}

function documentTabUrl(tabId) {
  return `https://docs.google.com/document/d/${IELTS_REVIEW_DOCUMENT_ID}/edit?tab=${encodeURIComponent(tabId)}`;
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_UPSTREAM_INVALID", 502, {
      status: response.status,
    });
  }
}

export async function saveIeltsReviewDocument(
  env,
  context,
  input = {},
  dependencies = {},
) {
  if (context?.profileId && context.profileId !== "ielts") {
    throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_FORBIDDEN", 403);
  }

  const date = normalizedDate(input.date);
  const tabTitle = requiredText(
    input.tabTitle || defaultTabTitle(date),
    "tabTitle",
    MAX_TAB_TITLE_CHARS,
  );
  const content = requiredText(input.content, "content", MAX_CONTENT_CHARS);
  const clientRequestId = requiredText(
    input.clientRequestId,
    "clientRequestId",
    MAX_CLIENT_REQUEST_ID_CHARS,
  );
  const fetchImpl = dependencies.fetch || globalThis.fetch;

  let response;
  try {
    response = await fetchImpl(configuredWebAppUrl(env), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify({
        action: "createIeltsReviewTab",
        secret: configuredSecret(env),
        documentId: IELTS_REVIEW_DOCUMENT_ID,
        date,
        tabTitle,
        content,
        clientRequestId,
      }),
      redirect: "follow",
    });
  } catch (error) {
    throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_UPSTREAM_UNAVAILABLE", 503, {
      message: String(error?.message || error || "Google Apps Script request failed").slice(0, 500),
    });
  }

  const result = await responseJson(response);
  if (!response.ok || result?.ok !== true) {
    throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_UPSTREAM_FAILED", 502, {
      status: response.status,
      upstreamError: String(result?.error || "UNKNOWN").slice(0, 200),
    });
  }
  if (String(result.documentId || "") !== IELTS_REVIEW_DOCUMENT_ID) {
    throw new JoyCoreError("IELTS_REVIEW_DOCUMENT_TARGET_MISMATCH", 502);
  }

  const tabId = requiredText(result.tabId, "upstream.tabId", 200);
  return {
    ok: true,
    documentId: IELTS_REVIEW_DOCUMENT_ID,
    documentTitle: IELTS_REVIEW_DOCUMENT_TITLE,
    documentUrl: documentTabUrl(tabId),
    tabId,
    tabTitle: String(result.tabTitle || tabTitle).slice(0, MAX_TAB_TITLE_CHARS),
    created: result.created !== false,
    deduplicated: result.deduplicated === true,
    clientRequestId,
  };
}

export const IELTS_REVIEW_DOCUMENT_SERVICE = Object.freeze({
  save: saveIeltsReviewDocument,
});
