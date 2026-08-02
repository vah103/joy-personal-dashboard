import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  IELTS_REVIEW_DOCUMENT_ID,
  saveIeltsReviewDocument,
} from "../worker/ielts-review-docs.js";
import { handleJoyIeltsActionRequest } from "../worker/joy-actions-ielts.js";
import { JOY_IELTS_ACTIONS_OPENAPI } from "../worker/joy-actions-openapi-extended.js";

const CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: ["ielts:*"],
  actorType: "assistant",
  actorId: "gpt-ielts",
  profileId: "ielts",
};

const INPUT = {
  date: "2026-08-02",
  tabTitle: "02-08-2026 · IELTS Review",
  content: "Listening: 14/40\nReading: reviewed on STUDY4.",
  clientRequestId: "ielts-review-2026-08-02",
};

test("IELTS review writer posts only to the configured Apps Script and fixed document", async () => {
  let received = null;
  const result = await saveIeltsReviewDocument(
    {
      JOY_IELTS_DOCS_WEB_APP_URL: "https://script.google.com/macros/s/test/exec",
      JOY_IELTS_DOCS_WEBHOOK_SECRET: "server-secret",
    },
    CONTEXT,
    INPUT,
    {
      fetch: async (url, options) => {
        received = { url, options, body: JSON.parse(options.body) };
        return new Response(JSON.stringify({
          ok: true,
          documentId: IELTS_REVIEW_DOCUMENT_ID,
          tabId: "t.review123",
          tabTitle: INPUT.tabTitle,
          created: true,
          deduplicated: false,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );

  assert.equal(received.url, "https://script.google.com/macros/s/test/exec");
  assert.equal(received.body.documentId, IELTS_REVIEW_DOCUMENT_ID);
  assert.equal(received.body.secret, "server-secret");
  assert.equal(received.body.clientRequestId, INPUT.clientRequestId);
  assert.equal(result.documentId, IELTS_REVIEW_DOCUMENT_ID);
  assert.match(result.documentUrl, new RegExp(`${IELTS_REVIEW_DOCUMENT_ID}.*tab=t.review123`));
  assert.equal(result.created, true);
});

test("IELTS review writer refuses another specialized profile", async () => {
  await assert.rejects(
    saveIeltsReviewDocument(
      {
        JOY_IELTS_DOCS_WEB_APP_URL: "https://script.google.com/macros/s/test/exec",
        JOY_IELTS_DOCS_WEBHOOK_SECRET: "server-secret",
      },
      { ...CONTEXT, profileId: "turtlebot4" },
      INPUT,
      { fetch: async () => { throw new Error("must not run"); } },
    ),
    (error) => error.code === "IELTS_REVIEW_DOCUMENT_FORBIDDEN",
  );
});

test("IELTS Action route delegates fixed-document review writes", async () => {
  let received = null;
  const result = await handleJoyIeltsActionRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/ielts/review-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(INPUT),
    }),
    {},
    CONTEXT,
    {
      service: {
        async saveReviewDocument(env, context, input) {
          received = { env, context, input };
          return {
            ok: true,
            documentId: IELTS_REVIEW_DOCUMENT_ID,
            documentTitle: "New Ielts new me | Vanh",
            documentUrl: `https://docs.google.com/document/d/${IELTS_REVIEW_DOCUMENT_ID}/edit?tab=t.test`,
            tabId: "t.test",
            tabTitle: INPUT.tabTitle,
            created: true,
            deduplicated: false,
            clientRequestId: INPUT.clientRequestId,
          };
        },
      },
    },
  );

  assert.equal(result.status, 201);
  assert.equal(received.context.profileId, "ielts");
  assert.deepEqual(received.input, INPUT);
});

test("Joy IELTS schema publishes document export and stays within Builder operation limit", () => {
  const operation = JOY_IELTS_ACTIONS_OPENAPI.paths
    ["/api/joy/v1/ielts/review-documents"]?.post;
  assert.equal(operation.operationId, "saveIeltsReviewDocument");
  assert.ok(JOY_IELTS_ACTIONS_OPENAPI.components.schemas.IeltsReviewDocumentInput);

  const operationCount = Object.values(JOY_IELTS_ACTIONS_OPENAPI.paths)
    .flatMap((methods) => Object.values(methods))
    .filter((value) => value && typeof value === "object" && value.operationId)
    .length;
  assert.ok(operationCount <= 30, `Joy IELTS schema exposes ${operationCount} operations`);
});

test("Apps Script implementation creates a new tab, writes into it, and pins the document id", async () => {
  const script = await readFile(
    resolve("integrations/google-apps-script/ielts-review-docs/Code.gs"),
    "utf8",
  );
  assert.match(script, new RegExp(IELTS_REVIEW_DOCUMENT_ID));
  assert.match(script, /addDocumentTab/);
  assert.match(script, /insertText/);
  assert.match(script, /clientRequestId/);
  assert.match(script, /DOCUMENT_TARGET_FORBIDDEN/);
  assert.match(script, /PropertiesService\.getScriptProperties/);
});
