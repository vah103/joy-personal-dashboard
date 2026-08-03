import { isSameOrigin, json } from "./shared/http.js";
import { getSession } from "./shared/session.js";
import {
  getGoogleDocsAccessToken,
  hasGoogleDocsToken,
} from "./google-docs-auth.js";

export const IELTS_COURSE_DOCUMENT_ID = "18KxStmQagYYJUbySCnUzgvyWPI5IaQXVN7y7B3HPK_s";
export const IELTS_COURSE_DOCUMENT_URL = `https://docs.google.com/document/d/${IELTS_COURSE_DOCUMENT_ID}/edit`;

const ROUTE = "/api/ielts-course-sync";
const AUTO_CHECK_INTERVAL = 24 * 60 * 60 * 1000;
const MAX_TOPICS = 120;
const MAX_TOPIC_TEXT = 2_200;
const MAX_TOTAL_TEXT = 180_000;

const GRAMMAR_PATTERNS = [
  ["comparisons", /so sánh|comparison|comparative|superlative/i],
  ["question noun phrases", /cụm danh từ câu hỏi|question noun phrase|the number of/i],
  ["relative clauses", /mệnh đề quan hệ|relative clause|which|whose/i],
  ["participle clauses", /rút gọn trùng chủ|participle clause|\bving\b|\bvp2\b/i],
  ["future prediction", /câu điều kiện|dự đoán|projection|predicted|anticipated/i],
  ["only inversion", /đảo ngữ.*only|only \+/i],
  ["cleft sentences", /chủ ngữ giả|it is .* that|not until/i],
  ["cause and result", /nguyên nhân.*kết quả|so that|with the result that|in order to|so as to/i],
  ["passive voice", /câu bị động|passive voice|be \+ v3/i],
  ["location inversion", /đảo ngữ vị trí|stood|\blay\b/i],
];

const TASK_TYPE_PATTERNS = [
  ["Task 1 · Time Changing", /time changing/i],
  ["Task 1 · Time Fixed", /time fixed/i],
  ["Task 1 · Maps", /\bmaps?\b/i],
  ["Task 1 · Process", /\bprocess\b/i],
  ["Task 1 · Mixed Chart", /mixed chart/i],
  ["Task 2 · Opinion", /opinion essay|agree or disagree/i],
  ["Task 2 · Discussion", /discussion essay|discuss both views/i],
  ["Task 2 · Advantages and Disadvantages", /advantage|disadvantage/i],
  ["Task 2 · Problems and Solutions", /problem.*solution|cause.*solution/i],
  ["Task 2 · Two-part Question", /two-part|direct question/i],
  ["Task 2", /task\s*2/i],
  ["Task 1", /task\s*1/i],
];

export function isIeltsCourseSyncRoute(pathname) {
  return pathname === ROUTE;
}

export async function handleIeltsCourseSyncRequest(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  if (request.method === "GET") {
    const [connected, record] = await Promise.all([
      hasGoogleDocsToken(session.user_email, env),
      readIeltsCourseKnowledge(session.user_email, env),
    ]);
    return json({
      connected,
      documentUrl: IELTS_COURSE_DOCUMENT_URL,
      knowledge: record,
    });
  }

  if (request.method === "POST") {
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
    try {
      const result = await syncIeltsCourseForUser(session.user_email, env);
      return json({
        ok: true,
        connected: true,
        documentUrl: IELTS_COURSE_DOCUMENT_URL,
        ...result,
      });
    } catch (error) {
      console.error("IELTS course Google Docs sync failed", error);
      return json({
        error: error?.code || "IELTS_COURSE_SYNC_FAILED",
      }, Number(error?.status || 500));
    }
  }

  return json({ error: "METHOD_NOT_ALLOWED" }, 405);
}

export async function readIeltsCourseKnowledge(email, env) {
  const row = await env.DB.prepare(`
    SELECT data_json, synced_at, last_checked_at
    FROM ielts_course_knowledge
    WHERE user_email = ?
  `).bind(String(email || "").trim().toLowerCase()).first();
  if (!row?.data_json) return null;
  const knowledge = safeJson(row.data_json, null);
  if (!knowledge) return null;
  return {
    ...knowledge,
    source: {
      ...(knowledge.source || {}),
      syncedAt: Number(row.synced_at || knowledge.source?.syncedAt || 0),
      lastCheckedAt: Number(row.last_checked_at || 0),
    },
  };
}

export async function syncIeltsCourseForUser(email, env, dependencies = {}) {
  const userEmail = String(email || "").trim().toLowerCase();
  const now = Number(dependencies.now?.() || Date.now());
  const accessToken = await (dependencies.getAccessToken || getGoogleDocsAccessToken)(userEmail, env);
  const document = await (dependencies.fetchDocument || fetchGoogleDocument)(accessToken);
  const extracted = await extractCourseKnowledge(document, now);
  const current = await env.DB.prepare(`
    SELECT content_hash, data_json, synced_at
    FROM ielts_course_knowledge
    WHERE user_email = ?
  `).bind(userEmail).first();

  if (current?.content_hash && current.content_hash === extracted.source.contentHash) {
    await env.DB.prepare(`
      UPDATE ielts_course_knowledge
      SET revision_id = ?, last_checked_at = ?, updated_at = ?
      WHERE user_email = ?
    `).bind(extracted.source.revisionId, now, now, userEmail).run();
    const knowledge = safeJson(current.data_json, extracted);
    return {
      changed: false,
      knowledge: {
        ...knowledge,
        source: {
          ...(knowledge.source || {}),
          revisionId: extracted.source.revisionId,
          syncedAt: Number(current.synced_at || knowledge.source?.syncedAt || 0),
          lastCheckedAt: now,
        },
      },
    };
  }

  const serialized = JSON.stringify(extracted);
  await env.DB.prepare(`
    INSERT INTO ielts_course_knowledge (
      user_email, document_id, revision_id, content_hash, data_json,
      synced_at, last_checked_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      document_id = excluded.document_id,
      revision_id = excluded.revision_id,
      content_hash = excluded.content_hash,
      data_json = excluded.data_json,
      synced_at = excluded.synced_at,
      last_checked_at = excluded.last_checked_at,
      updated_at = excluded.updated_at
  `).bind(
    userEmail,
    IELTS_COURSE_DOCUMENT_ID,
    extracted.source.revisionId,
    extracted.source.contentHash,
    serialized,
    now,
    now,
    now,
  ).run();

  return {
    changed: true,
    knowledge: {
      ...extracted,
      source: { ...extracted.source, lastCheckedAt: now },
    },
  };
}

export async function runIeltsCourseSyncSchedule(env, dependencies = {}) {
  const now = Number(dependencies.now?.() || Date.now());
  const dueBefore = now - AUTO_CHECK_INTERVAL;
  const rows = await env.DB.prepare(`
    SELECT tokens.user_email
    FROM google_docs_tokens tokens
    LEFT JOIN ielts_course_knowledge knowledge
      ON knowledge.user_email = tokens.user_email
    WHERE COALESCE(knowledge.last_checked_at, 0) <= ?
    ORDER BY COALESCE(knowledge.last_checked_at, 0) ASC
    LIMIT 10
  `).bind(dueBefore).all();

  await Promise.allSettled((rows.results || []).map((row) => (
    syncIeltsCourseForUser(row.user_email, env, dependencies)
  )));
}

async function fetchGoogleDocument(accessToken) {
  const url = `https://docs.googleapis.com/v1/documents/${encodeURIComponent(IELTS_COURSE_DOCUMENT_ID)}?includeTabsContent=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("GOOGLE_DOCS_READ_FAILED");
    error.code = response.status === 401 || response.status === 403
      ? "DOCS_AUTHORIZATION_REQUIRED"
      : response.status === 404
        ? "IELTS_COURSE_DOCUMENT_NOT_FOUND"
        : "GOOGLE_DOCS_READ_FAILED";
    error.status = response.status === 401 || response.status === 403
      ? 403
      : response.status === 404
        ? 404
        : 502;
    throw error;
  }
  return payload;
}

export async function extractCourseKnowledge(document, syncedAt = Date.now()) {
  const tabs = flattenDocumentTabs(document?.tabs || []);
  const sections = tabs.flatMap((tab) => sectionsFromTab(tab));
  const boundedSections = [];
  let totalText = 0;
  for (const section of sections) {
    if (boundedSections.length >= MAX_TOPICS || totalText >= MAX_TOTAL_TEXT) break;
    const remaining = MAX_TOTAL_TEXT - totalText;
    const text = cleanText(section.text).slice(0, Math.min(MAX_TOPIC_TEXT, remaining));
    if (text.length < 24) continue;
    boundedSections.push({ ...section, text });
    totalText += text.length;
  }

  const topics = boundedSections.map((section, index) => topicFromSection(section, index));
  const contentForHash = JSON.stringify(tabs.map((tab) => ({
    id: tab.tabId,
    title: tab.title,
    text: readStructuralText(tab.body?.content || []),
  })));
  const contentHash = await sha256Hex(contentForHash);
  const revisionId = String(document?.revisionId || contentHash).slice(0, 300);

  return {
    schemaVersion: 1,
    source: {
      provider: "Google Docs",
      documentId: IELTS_COURSE_DOCUMENT_ID,
      documentUrl: IELTS_COURSE_DOCUMENT_URL,
      title: cleanText(document?.title || "Writing Course Notes").slice(0, 240),
      revisionId,
      contentHash,
      syncedAt: Number(syncedAt),
      lastCheckedAt: Number(syncedAt),
    },
    stats: {
      tabCount: tabs.length,
      topicCount: topics.length,
      textCharacters: totalText,
    },
    topics,
  };
}

export function flattenDocumentTabs(tabs, parents = []) {
  const output = [];
  for (const tab of Array.isArray(tabs) ? tabs : []) {
    const title = cleanText(tab?.tabProperties?.title || "Untitled tab") || "Untitled tab";
    const path = [...parents, title];
    output.push({
      tabId: String(tab?.tabProperties?.tabId || ""),
      title,
      path,
      body: tab?.documentTab?.body || { content: [] },
    });
    output.push(...flattenDocumentTabs(tab?.childTabs || [], path));
  }
  return output;
}

function sectionsFromTab(tab) {
  const paragraphs = structuralParagraphs(tab.body?.content || []);
  const sections = [];
  let current = {
    tabId: tab.tabId,
    tabTitle: tab.title,
    tabPath: tab.path,
    heading: tab.title,
    headingStyle: "TAB",
    text: "",
  };

  const commit = () => {
    if (cleanText(current.text)) sections.push({ ...current, text: cleanText(current.text) });
  };

  for (const paragraph of paragraphs) {
    const text = cleanText(paragraph.text);
    if (!text) continue;
    if (/^(TITLE|SUBTITLE|HEADING_[1-6])$/.test(paragraph.style)) {
      commit();
      current = {
        tabId: tab.tabId,
        tabTitle: tab.title,
        tabPath: tab.path,
        heading: text,
        headingStyle: paragraph.style,
        text: "",
      };
      continue;
    }
    current.text += `${current.text ? "\n" : ""}${paragraph.bullet ? "• " : ""}${text}`;
  }
  commit();
  return sections;
}

function structuralParagraphs(elements, output = []) {
  for (const element of Array.isArray(elements) ? elements : []) {
    if (element?.paragraph) {
      output.push({
        style: String(element.paragraph.paragraphStyle?.namedStyleType || "NORMAL_TEXT"),
        bullet: Boolean(element.paragraph.bullet),
        text: paragraphText(element.paragraph),
      });
    } else if (element?.table) {
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) structuralParagraphs(cell.content || [], output);
      }
    } else if (element?.tableOfContents) {
      structuralParagraphs(element.tableOfContents.content || [], output);
    }
  }
  return output;
}

function readStructuralText(elements) {
  return structuralParagraphs(elements)
    .map((paragraph) => cleanText(paragraph.text))
    .filter(Boolean)
    .join("\n");
}

function paragraphText(paragraph) {
  return (paragraph.elements || []).map((element) => (
    element?.textRun?.content
    || element?.autoText?.content
    || ""
  )).join("");
}

function topicFromSection(section, index) {
  const sourceText = `${section.tabTitle}\n${section.heading}\n${section.text}`;
  const taskType = TASK_TYPE_PATTERNS.find(([, pattern]) => pattern.test(sourceText))?.[0]
    || (/task\s*2/i.test(section.tabTitle) ? "Task 2" : /task\s*1/i.test(section.tabTitle) ? "Task 1" : "Writing");
  const grammar = GRAMMAR_PATTERNS
    .filter(([, pattern]) => pattern.test(sourceText))
    .map(([label]) => label);
  const heading = cleanText(section.heading || section.tabTitle);
  return {
    id: `course-topic-${String(index + 1).padStart(3, "0")}-${slug(heading).slice(0, 48)}`,
    skill: "writing",
    taskType,
    title: heading,
    summary: section.text,
    grammar,
    source: {
      tabId: section.tabId,
      tabTitle: section.tabTitle,
      tabPath: section.tabPath,
      heading,
    },
  };
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "notes";
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}
