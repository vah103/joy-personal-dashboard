const IELTS_REVIEW_DOCUMENT_ID = "1y_WC_yO7xFyFoniGUt3yISgLxq6mP3hBQFWahSzSueQ";
const MAX_CONTENT_CHARS = 50000;
const MAX_TAB_TITLE_CHARS = 120;

function doPost(event) {
  try {
    const payload = parsePayload_(event);
    authorize_(payload);
    validatePayload_(payload);

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      return jsonResponse_(createOrReuseReviewTab_(payload));
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: String(error && error.message ? error.message : error || "UNKNOWN_ERROR").slice(0, 300),
    });
  }
}

function parsePayload_(event) {
  const raw = event && event.postData && event.postData.contents;
  if (!raw) throw new Error("REQUEST_BODY_REQUIRED");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("INVALID_JSON");
  }
}

function authorize_(payload) {
  const expected = PropertiesService.getScriptProperties()
    .getProperty("JOY_IELTS_DOCS_WEBHOOK_SECRET");
  if (!expected) throw new Error("WEBHOOK_SECRET_NOT_CONFIGURED");
  if (String(payload.secret || "") !== expected) throw new Error("FORBIDDEN");
}

function validatePayload_(payload) {
  if (payload.action !== "createIeltsReviewTab") throw new Error("INVALID_ACTION");
  if (String(payload.documentId || "") !== IELTS_REVIEW_DOCUMENT_ID) {
    throw new Error("DOCUMENT_TARGET_FORBIDDEN");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || ""))) {
    throw new Error("INVALID_DATE");
  }
  const title = String(payload.tabTitle || "").trim();
  const content = String(payload.content || "").trim();
  const requestId = String(payload.clientRequestId || "").trim();
  if (!title || title.length > MAX_TAB_TITLE_CHARS) throw new Error("INVALID_TAB_TITLE");
  if (!content || content.length > MAX_CONTENT_CHARS) throw new Error("INVALID_CONTENT");
  if (!requestId || requestId.length > 80) throw new Error("INVALID_CLIENT_REQUEST_ID");
}

function createOrReuseReviewTab_(payload) {
  const properties = PropertiesService.getScriptProperties();
  const requestKey = `ieltsReview.${digestHex_(payload.clientRequestId)}`;
  const saved = parseSavedResult_(properties.getProperty(requestKey));
  const currentDocument = Docs.Documents.get(IELTS_REVIEW_DOCUMENT_ID, {
    includeTabsContent: false,
  });

  if (saved && findTabById_(currentDocument.tabs || [], saved.tabId)) {
    return {
      ok: true,
      documentId: IELTS_REVIEW_DOCUMENT_ID,
      tabId: saved.tabId,
      tabTitle: saved.tabTitle,
      created: false,
      deduplicated: true,
    };
  }

  const existingTitles = new Set();
  collectTabTitles_(currentDocument.tabs || [], existingTitles);
  const tabTitle = uniqueTitle_(String(payload.tabTitle).trim(), existingTitles);

  const addResponse = Docs.Documents.batchUpdate({
    requests: [{
      addDocumentTab: {
        tabProperties: { title: tabTitle },
      },
    }],
  }, IELTS_REVIEW_DOCUMENT_ID);

  const added = addResponse
    && addResponse.replies
    && addResponse.replies[0]
    && addResponse.replies[0].addDocumentTab
    && addResponse.replies[0].addDocumentTab.tabProperties;
  const tabId = added && added.tabId;
  if (!tabId) throw new Error("TAB_CREATION_FAILED");

  const heading = `TỔNG HỢP IELTS · ${payload.date}`;
  const text = `${heading}\n\n${String(payload.content).trim()}\n`;
  const headingEnd = heading.length + 1;

  Docs.Documents.batchUpdate({
    requests: [
      {
        insertText: {
          location: { index: 1, tabId },
          text,
        },
      },
      {
        updateTextStyle: {
          range: { startIndex: 1, endIndex: text.length + 1, tabId },
          textStyle: {
            weightedFontFamily: { fontFamily: "Nunito" },
            fontSize: { magnitude: 11, unit: "PT" },
          },
          fields: "weightedFontFamily,fontSize",
        },
      },
      {
        updateTextStyle: {
          range: { startIndex: 1, endIndex: headingEnd, tabId },
          textStyle: {
            bold: true,
            fontSize: { magnitude: 18, unit: "PT" },
          },
          fields: "bold,fontSize",
        },
      },
      {
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: headingEnd, tabId },
          paragraphStyle: {
            namedStyleType: "TITLE",
            spaceBelow: { magnitude: 10, unit: "PT" },
          },
          fields: "namedStyleType,spaceBelow",
        },
      },
    ],
  }, IELTS_REVIEW_DOCUMENT_ID);

  properties.setProperty(requestKey, JSON.stringify({ tabId, tabTitle }));
  return {
    ok: true,
    documentId: IELTS_REVIEW_DOCUMENT_ID,
    tabId,
    tabTitle,
    created: true,
    deduplicated: false,
  };
}

function uniqueTitle_(baseTitle, existingTitles) {
  if (!existingTitles.has(baseTitle)) return baseTitle;
  for (let index = 2; index <= 99; index += 1) {
    const suffix = ` (${index})`;
    const candidate = `${baseTitle.slice(0, MAX_TAB_TITLE_CHARS - suffix.length)}${suffix}`;
    if (!existingTitles.has(candidate)) return candidate;
  }
  throw new Error("TOO_MANY_DUPLICATE_TAB_TITLES");
}

function collectTabTitles_(tabs, output) {
  tabs.forEach((tab) => {
    const properties = tab.tabProperties || {};
    if (properties.title) output.add(String(properties.title));
    collectTabTitles_(tab.childTabs || [], output);
  });
}

function findTabById_(tabs, tabId) {
  for (const tab of tabs) {
    if (String(tab.tabProperties && tab.tabProperties.tabId || "") === String(tabId)) {
      return tab;
    }
    const child = findTabById_(tab.childTabs || [], tabId);
    if (child) return child;
  }
  return null;
}

function parseSavedResult_(value) {
  if (!value) return null;
  try {
    const result = JSON.parse(value);
    return result && result.tabId ? result : null;
  } catch (error) {
    return null;
  }
}

function digestHex_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8,
  ).map((byte) => ((byte + 256) % 256).toString(16).padStart(2, "0")).join("");
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
