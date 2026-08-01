const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const errorResponse = {
  description: "The request could not be completed.",
  content: { "application/json": { schema: ref("Error") } },
};

const success = (schema, description = "Success") => ({
  description,
  content: { "application/json": { schema } },
});

const submissionIdParameter = {
  name: "submissionId",
  in: "path",
  required: true,
  schema: { type: "string", maxLength: 160 },
  description: "Exact Listening submission id returned by prepareIeltsListeningSubmission.",
};

const clientRequestId = {
  type: "string",
  maxLength: 80,
  description: "Stable idempotency key. Reuse it only when retrying the same operation.",
};

export const IELTS_LISTENING_ACTION_PATHS = {
  "/api/joy/v1/ielts/listening/submissions": {
    post: {
      operationId: "prepareIeltsListeningSubmission",
      summary: "Transcribe an attached IELTS Listening audio file",
      description: "Use when the owner attaches one Listening audio file and screenshots or documents showing the questions and entered answers. Inspect the screenshots directly in the conversation and copy the learner's answers exactly, preserving blanks, spelling and uncertainty. Put only the single audio attachment in openaiFileIdRefs; do not send the screenshots because their extracted answers are already supplied in studentAnswers. Joy downloads the audio from the temporary OpenAI URL, transcribes it, stores a private draft submission in IELTS Core, and returns the transcript for grading. This action does not complete the task or save an assessment.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: ref("IeltsListeningSubmissionInput"),
          },
        },
      },
      responses: {
        200: success(ref("IeltsListeningSubmissionResult"), "Existing idempotent submission"),
        201: success(ref("IeltsListeningSubmissionResult"), "Audio transcribed and submission created"),
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        413: errorResponse,
        502: errorResponse,
        503: errorResponse,
      },
    },
  },
  "/api/joy/v1/ielts/listening/submissions/{submissionId}": {
    get: {
      operationId: "getIeltsListeningSubmission",
      summary: "Read one IELTS Listening submission",
      description: "Retrieve the transcript, exact learner answers and any saved draft review for a prior Listening submission.",
      parameters: [submissionIdParameter],
      responses: {
        200: success(ref("IeltsListeningSubmissionReadResult")),
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        503: errorResponse,
      },
    },
  },
  "/api/joy/v1/ielts/listening/submissions/{submissionId}/review": {
    post: {
      operationId: "saveIeltsListeningReview",
      summary: "Save a draft IELTS Listening grading review",
      description: "After comparing the screenshots, learner answers and transcript, save the per-question grading and teaching explanation. Use official-key only when an official answer key is actually available. Otherwise use provisional-transcript, do not set a band score, and state uncertainty. This remains a draft: ask the owner to confirm before calling assessment, recurring-error or task-completion actions.",
      parameters: [submissionIdParameter],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: ref("IeltsListeningReviewInput"),
          },
        },
      },
      responses: {
        200: success(ref("IeltsListeningReviewResult")),
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        409: errorResponse,
        503: errorResponse,
      },
    },
  },
};

export const IELTS_LISTENING_ACTION_SCHEMAS = {
  IeltsListeningStudentAnswer: {
    type: "object",
    properties: {
      questionNumber: {
        type: "integer",
        minimum: 1,
        maximum: 100,
      },
      answer: {
        type: "string",
        maxLength: 500,
        description: "Copy exactly what the learner entered. Use an empty string for a visible blank answer.",
      },
      questionText: {
        type: "string",
        maxLength: 2000,
        description: "Optional visible question wording or gap context from the screenshot.",
      },
      uncertain: {
        type: "boolean",
        description: "True only when the screenshot is unclear and the copied answer may be inaccurate.",
      },
    },
    required: ["questionNumber", "answer", "uncertain"],
    additionalProperties: false,
  },
  IeltsListeningSubmissionInput: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        maxLength: 160,
        description: "Exact Listening task id returned by getIeltsToday or getIeltsTeachingTask.",
      },
      date: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      },
      title: {
        type: "string",
        maxLength: 240,
      },
      openaiFileIdRefs: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: { type: "string" },
        description: "The single audio file attached in the current conversation (mp3, mp4, mpeg, mpga, m4a, wav or webm). Do not include answer screenshots; inspect them directly and put the extracted answers in studentAnswers. At runtime ChatGPT expands the audio reference into file metadata with a five-minute download URL.",
      },
      studentAnswers: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: ref("IeltsListeningStudentAnswer"),
      },
      clientRequestId,
    },
    required: ["taskId", "openaiFileIdRefs", "studentAnswers", "clientRequestId"],
    additionalProperties: false,
  },
  IeltsListeningSubmission: {
    type: "object",
    properties: {
      id: { type: "string" },
      taskId: { type: "string" },
      date: { type: "string" },
      title: { type: "string" },
      status: { type: "string", enum: ["transcribed", "reviewed"] },
      files: { type: "array", items: { type: "object", additionalProperties: true } },
      audio: { type: "object", additionalProperties: true },
      studentAnswers: { type: "array", items: ref("IeltsListeningStudentAnswer") },
      transcript: {
        type: "string",
        description: "Machine transcript used to explain answers. It is not an official answer key.",
      },
      transcriptTruncated: { type: "boolean" },
      detectedLanguages: { type: "array", items: { type: "object", additionalProperties: true } },
      review: {
        anyOf: [
          { type: "object", additionalProperties: true },
          { type: "null" },
        ],
      },
      source: { type: "string" },
      clientRequestId: { type: "string" },
      createdAt: { type: "integer" },
      updatedAt: { type: "integer" },
    },
    required: ["id", "taskId", "status", "studentAnswers", "transcript", "clientRequestId"],
    additionalProperties: false,
  },
  IeltsListeningSubmissionResult: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      deduplicated: { type: "boolean" },
      submission: ref("IeltsListeningSubmission"),
      stateVersion: { type: "integer" },
    },
    required: ["ok", "deduplicated", "submission", "stateVersion"],
    additionalProperties: false,
  },
  IeltsListeningSubmissionReadResult: {
    type: "object",
    properties: {
      submission: ref("IeltsListeningSubmission"),
      stateVersion: { type: "integer" },
    },
    required: ["submission", "stateVersion"],
    additionalProperties: false,
  },
  IeltsListeningQuestionReview: {
    type: "object",
    properties: {
      questionNumber: { type: "integer", minimum: 1, maximum: 100 },
      studentAnswer: { type: "string", maxLength: 500 },
      expectedAnswer: { type: "string", maxLength: 500 },
      result: {
        type: "string",
        enum: ["correct", "incorrect", "unanswered", "uncertain"],
      },
      explanation: { type: "string", minLength: 1, maxLength: 4000 },
      transcriptEvidence: {
        type: "string",
        maxLength: 4000,
        description: "Short paraphrase or excerpt identifying the relevant part of the transcript.",
      },
      confidence: {
        anyOf: [
          { type: "number", minimum: 0, maximum: 1 },
          { type: "null" },
        ],
      },
    },
    required: [
      "questionNumber",
      "studentAnswer",
      "expectedAnswer",
      "result",
      "explanation",
    ],
    additionalProperties: false,
  },
  IeltsListeningRecurringErrorDraft: {
    type: "object",
    properties: {
      label: { type: "string", minLength: 1, maxLength: 240 },
      cause: { type: "string", minLength: 1, maxLength: 4000 },
      action: { type: "string", minLength: 1, maxLength: 4000 },
    },
    required: ["label", "cause", "action"],
    additionalProperties: false,
  },
  IeltsListeningReviewInput: {
    type: "object",
    properties: {
      gradingMode: {
        type: "string",
        enum: ["official-key", "provisional-transcript"],
      },
      bandScore: {
        anyOf: [
          { type: "number", minimum: 0, maximum: 9, multipleOf: 0.5 },
          { type: "null" },
        ],
        description: "Only set when gradingMode is official-key. Use null for provisional transcript-based grading.",
      },
      questionReviews: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: ref("IeltsListeningQuestionReview"),
      },
      summary: { type: "string", minLength: 1, maxLength: 20000 },
      recurringErrors: {
        type: "array",
        maxItems: 10,
        items: ref("IeltsListeningRecurringErrorDraft"),
      },
      clientRequestId,
    },
    required: ["gradingMode", "questionReviews", "summary", "clientRequestId"],
    additionalProperties: false,
  },
  IeltsListeningReviewResult: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      submission: ref("IeltsListeningSubmission"),
      stateVersion: { type: "integer" },
      requiresOwnerConfirmation: { type: "boolean" },
      nextActions: { type: "array", items: { type: "string" } },
    },
    required: [
      "ok",
      "submission",
      "stateVersion",
      "requiresOwnerConfirmation",
      "nextActions",
    ],
    additionalProperties: false,
  },
};
