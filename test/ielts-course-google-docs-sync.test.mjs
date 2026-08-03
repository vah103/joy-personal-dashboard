import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isGoogleDocsAuthRoute } from "../worker/google-docs-auth.js";
import {
  IELTS_COURSE_DOCUMENT_ID,
  extractCourseKnowledge,
  flattenDocumentTabs,
  isIeltsCourseSyncRoute,
} from "../worker/ielts-course-sync.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function paragraph(text, style = "NORMAL_TEXT", bullet = false) {
  return {
    paragraph: {
      paragraphStyle: { namedStyleType: style },
      ...(bullet ? { bullet: { listId: "list-1" } } : {}),
      elements: [{ textRun: { content: `${text}\n` } }],
    },
  };
}

function sampleDocument(extraText = "") {
  return {
    documentId: IELTS_COURSE_DOCUMENT_ID,
    title: "Lộ trình học Writing | IELTS",
    revisionId: `revision-${extraText || "one"}`,
    tabs: [
      {
        tabProperties: { tabId: "task-1", title: "LÝ THUYẾT TASK 1" },
        documentTab: {
          body: {
            content: [
              paragraph("LÝ THUYẾT TASK 1", "TITLE"),
              paragraph("Maps", "HEADING_1"),
              paragraph("Câu bị động là cấu trúc quan trọng. Đảo ngữ vị trí dùng stand và lie."),
              paragraph("Mô tả các thay đổi theo khu vực.", "NORMAL_TEXT", true),
              paragraph("Process", "HEADING_1"),
              paragraph(`Dùng câu bị động, so that và in order to để mô tả các công đoạn. ${extraText}`),
            ],
          },
        },
        childTabs: [
          {
            tabProperties: { tabId: "class-notes", title: "VỞ GHI TASK 1" },
            documentTab: {
              body: {
                content: [
                  paragraph("Time Changing", "HEADING_1"),
                  paragraph("So sánh, mệnh đề quan hệ và câu điều kiện cho dữ liệu dự đoán."),
                ],
              },
            },
          },
        ],
      },
      {
        tabProperties: { tabId: "task-2", title: "LÝ THUYẾT TASK 2" },
        documentTab: {
          body: {
            content: [
              paragraph("Opinion essay", "HEADING_1"),
              paragraph("Develop one clear position and support it with relevant examples."),
            ],
          },
        },
      },
    ],
  };
}

test("IELTS Course exposes isolated Google Docs authorization and sync routes", async () => {
  assert.equal(isGoogleDocsAuthRoute("/auth/docs/start"), true);
  assert.equal(isGoogleDocsAuthRoute("/api/integrations/docs/status"), true);
  assert.equal(isGoogleDocsAuthRoute("/auth/callback"), false);

  const docsCallback = new Request("https://joy.test/auth/callback?state=docs-state", {
    headers: { Cookie: "__Host-joy_docs_oauth_state=docs-state" },
  });
  const normalCallback = new Request("https://joy.test/auth/callback?state=normal-state", {
    headers: { Cookie: "__Host-joy_docs_oauth_state=docs-state" },
  });
  assert.equal(isGoogleDocsAuthRoute("/auth/callback", docsCallback), true);
  assert.equal(isGoogleDocsAuthRoute("/auth/callback", normalCallback), false);
  assert.equal(isIeltsCourseSyncRoute("/api/ielts-course-sync"), true);
  assert.equal(isIeltsCourseSyncRoute("/api/ielts-core"), false);

  const [authSource, syncSource, migration] = await Promise.all([
    read("../worker/google-docs-auth.js"),
    read("../worker/ielts-course-sync.js"),
    read("../migrations/20260804_ielts_course_google_docs.sql"),
  ]);
  assert.match(authSource, /documents\.readonly/);
  assert.match(authSource, /CALLBACK_PATH = "\/auth\/callback"/);
  assert.match(syncSource, /includeTabsContent=true/);
  assert.match(syncSource, new RegExp(IELTS_COURSE_DOCUMENT_ID));
  assert.match(migration, /CREATE TABLE IF NOT EXISTS google_docs_tokens/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ielts_course_knowledge/);
});

test("course extraction reads all top-level and nested tabs into structured Writing knowledge", async () => {
  const document = sampleDocument();
  const tabs = flattenDocumentTabs(document.tabs);
  assert.deepEqual(tabs.map((tab) => tab.tabId), ["task-1", "class-notes", "task-2"]);
  assert.deepEqual(tabs[1].path, ["LÝ THUYẾT TASK 1", "VỞ GHI TASK 1"]);

  const knowledge = await extractCourseKnowledge(document, 1_786_000_000_000);
  assert.equal(knowledge.schemaVersion, 1);
  assert.equal(knowledge.stats.tabCount, 3);
  assert.ok(knowledge.stats.topicCount >= 4);
  assert.equal(knowledge.source.documentId, IELTS_COURSE_DOCUMENT_ID);
  assert.equal(knowledge.source.syncedAt, 1_786_000_000_000);

  const maps = knowledge.topics.find((topic) => topic.taskType === "Task 1 · Maps");
  assert.ok(maps);
  assert.ok(maps.grammar.includes("passive voice"));
  assert.ok(maps.grammar.includes("location inversion"));
  assert.equal(maps.source.tabId, "task-1");

  const process = knowledge.topics.find((topic) => topic.taskType === "Task 1 · Process");
  assert.ok(process);
  assert.ok(process.grammar.includes("passive voice"));
  assert.ok(process.grammar.includes("cause and result"));

  const timeChanging = knowledge.topics.find((topic) => topic.taskType === "Task 1 · Time Changing");
  assert.ok(timeChanging);
  assert.ok(timeChanging.grammar.includes("comparisons"));
  assert.ok(timeChanging.grammar.includes("future prediction"));
});

test("content hashing is stable for unchanged notes and changes when lesson content changes", async () => {
  const first = await extractCourseKnowledge(sampleDocument(), 100);
  const repeated = await extractCourseKnowledge(sampleDocument(), 200);
  const changed = await extractCourseKnowledge(sampleDocument("New teacher feedback."), 300);

  assert.equal(first.source.contentHash, repeated.source.contentHash);
  assert.notEqual(first.source.contentHash, changed.source.contentHash);
  assert.notEqual(first.source.revisionId, changed.source.revisionId);
});

test("Course UI keeps Google Docs canonical and combines manual sync with a daily automatic check", async () => {
  const [frontend, promptBridge, build, router] = await Promise.all([
    read("../src/features/ielts/course-sync.js"),
    read("../src/features/ielts/course-prompt-bridge.js"),
    read("../scripts/build.mjs"),
    read("../worker/router.js"),
  ]);

  assert.match(frontend, /Open Google Docs/);
  assert.match(frontend, /Sync latest notes/);
  assert.match(frontend, /24 \* 60 \* 60 \* 1000/);
  assert.match(frontend, /relevantCourseTopics/);
  assert.match(promptBridge, /assigned STUDY4 or YouPass test/);
  assert.match(promptBridge, /Relevant synchronized Writing-course knowledge/);
  assert.ok(build.indexOf('"course-sync.js"') < build.indexOf('"course-prompt-bridge.js"'));
  assert.match(router, /isGoogleDocsAuthRoute\(pathname, request\)/);
  assert.match(router, /isIeltsCourseSyncRoute\(pathname\)/);
  assert.match(router, /runIeltsCourseSyncSchedule\(env\)/);
});
