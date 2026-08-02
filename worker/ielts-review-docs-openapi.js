const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const errorResponse = {
  description: "The request could not be completed.",
  content: { "application/json": { schema: ref("Error") } },
};

export const IELTS_REVIEW_DOCUMENT_ACTION_PATHS = {
  "/api/joy/v1/ielts/review-documents": {
    post: {
      operationId: "saveIeltsReviewDocument",
      summary: "Save an IELTS review in the fixed Google Doc",
      description: "Use when the owner asks to save a verified IELTS lesson or result. It creates one new tab in the fixed document, writes the supplied review, and returns a direct tab URL. Never claim success without this Action result.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: ref("IeltsReviewDocumentInput"),
          },
        },
      },
      responses: {
        200: {
          description: "The existing idempotent result",
          content: { "application/json": { schema: ref("IeltsReviewDocumentResult") } },
        },
        201: {
          description: "A new document tab was created",
          content: { "application/json": { schema: ref("IeltsReviewDocumentResult") } },
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        413: errorResponse,
        502: errorResponse,
        503: errorResponse,
      },
    },
  },
};

export const IELTS_REVIEW_DOCUMENT_ACTION_SCHEMAS = {
  IeltsReviewDocumentInput: {
    type: "object",
    properties: {
      date: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "Vietnam calendar date covered by the review.",
      },
      tabTitle: {
        type: "string",
        minLength: 1,
        maxLength: 120,
        description: "Optional new tab title. Omit to use DD-MM-YYYY · IELTS Review.",
      },
      content: {
        type: "string",
        minLength: 1,
        maxLength: 50000,
        description: "Verified review text containing sources, results, findings, errors, and next actions. Do not invent missing evidence.",
      },
      clientRequestId: {
        type: "string",
        minLength: 1,
        maxLength: 80,
        description: "Stable idempotency key. Reuse only when retrying the exact same document write.",
      },
    },
    required: ["date", "content", "clientRequestId"],
    additionalProperties: false,
  },
  IeltsReviewDocumentResult: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      documentId: { type: "string" },
      documentTitle: { type: "string" },
      documentUrl: { type: "string", format: "uri" },
      tabId: { type: "string" },
      tabTitle: { type: "string" },
      created: { type: "boolean" },
      deduplicated: { type: "boolean" },
      clientRequestId: { type: "string" },
    },
    required: [
      "ok",
      "documentId",
      "documentTitle",
      "documentUrl",
      "tabId",
      "tabTitle",
      "created",
      "deduplicated",
      "clientRequestId"
    ],
    additionalProperties: false,
  },
};
