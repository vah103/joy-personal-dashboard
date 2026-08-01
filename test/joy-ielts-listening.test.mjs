import assert from "node:assert/strict";
import test from "node:test";

import { blankIeltsState } from "../worker/ielts-core.js";
import { STABLE_IELTS_ASSISTANT_SERVICE } from "../worker/ielts-assistant-service.js";
import { handleJoyActionsRequest } from "../worker/joy-actions.js";
import {
  IELTS_ACTIONS,
  canPerformIeltsAction,
} from "../worker/ielts-permissions.js";

const CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: null,
  actorType: "assistant",
  actorId: "chatgpt-custom-gpt",
};

function stateHarness(initial = blankIeltsState()) {
  let data = structuredClone(initial);
  let version = 0;
  return {
    readState: async () => ({
      planId: "ielts-band-7-december-2026",
      data: structuredClone(data),
      version,
      updatedAt: 0,
    }),
    mutateState: async (_email, _env, updater) => {
      const draft = structuredClone(data);
      data = await updater(draft, { data: structuredClone(data), version }) || draft;
      version += 1;
      return {
        ok: true,
        planId: "ielts-band-7-december-2026",
        data: structuredClone(data),
        version,
        updatedAt: 1_800_000_000_000 + version,
      };
    },
    snapshot: () => ({ data: structuredClone(data), version }),
  };
}

function submissionInput(overrides = {}) {
  return {
    taskId: "baseline-listening",
    date: "2026-08-01",
    title: "Listening baseline",
    openaiFileIdRefs: [
      {
        name: "listening.m4a",
        id: "file-audio",
        mime_type: "audio/m4a",
        download_link: "https://files.oaiusercontent.com/file-audio?sig=test",
      },
      {
        name: "answers.png",
        id: "file-image",
        mime_type: "image/png",
        download_link: "https://files.oaiusercontent.com/file-image?sig=test",
      },
    ],
    studentAnswers: [
      { questionNumber: 1, answer: "fifteen", uncertain: false },
      { questionNumber: 2, answer: "", uncertain: false },
    ],
    clientRequestId: "listening-baseline-20260801",
    ...overrides,
  };
}

test("GPT Listening submission transcribes one attached audio and persists a private draft", async () => {
  const harness = stateHarness();
  let transcriptionCalls = 0;
  const dependencies = {
    ...harness,
    now: () => 1_800_000_000_000,
    downloadAudio: async () => ({
      blob: new Blob(["audio"], { type: "audio/m4a" }),
      sizeBytes: 5,
    }),
    transcribe: async () => {
      transcriptionCalls += 1;
      return {
        text: "The fee was initially fifteen pounds, but it is now fifty pounds.",
        model: "gpt-transcribe",
        languages: [{ code: "en" }],
      };
    },
  };

  const first = await STABLE_IELTS_ASSISTANT_SERVICE.prepareListeningSubmission(
    {},
    CONTEXT,
    submissionInput(),
    dependencies,
  );

  assert.equal(first.ok, true);
  assert.equal(first.deduplicated, false);
  assert.match(first.submission.transcript, /now fifty/);
  assert.equal(first.submission.files.some((file) => "downloadLink" in file), false);
  assert.equal(first.submission.studentAnswers[0].answer, "fifteen");
  assert.equal(transcriptionCalls, 1);

  const stored = harness.snapshot().data.rhythmReviews.__joyListeningSubmissions;
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, first.submission.id);
  assert.match(stored[0].transcript, /fifty pounds/);

  const second = await STABLE_IELTS_ASSISTANT_SERVICE.prepareListeningSubmission(
    {},
    CONTEXT,
    submissionInput(),
    dependencies,
  );
  assert.equal(second.deduplicated, true);
  assert.equal(second.submission.id, first.submission.id);
  assert.equal(transcriptionCalls, 1);
});

test("Listening review remains a draft until the owner confirms assessment and completion", async () => {
  const harness = stateHarness();
  const dependencies = {
    ...harness,
    now: () => 1_800_000_000_000,
    downloadAudio: async () => ({
      blob: new Blob(["audio"], { type: "audio/m4a" }),
      sizeBytes: 5,
    }),
    transcribe: async () => ({
      text: "The corrected amount is fifty pounds.",
      model: "gpt-transcribe",
      languages: [{ code: "en" }],
    }),
  };
  const prepared = await STABLE_IELTS_ASSISTANT_SERVICE.prepareListeningSubmission(
    {},
    CONTEXT,
    submissionInput(),
    dependencies,
  );

  const reviewed = await STABLE_IELTS_ASSISTANT_SERVICE.saveListeningReview(
    {},
    CONTEXT,
    prepared.submission.id,
    {
      gradingMode: "provisional-transcript",
      bandScore: null,
      questionReviews: [
        {
          questionNumber: 1,
          studentAnswer: "fifteen",
          expectedAnswer: "fifty",
          result: "incorrect",
          explanation: "The speaker corrected the first amount.",
          transcriptEvidence: "initially fifteen ... now fifty",
          confidence: 0.95,
        },
      ],
      summary: "The learner selected the distractor before the correction.",
      recurringErrors: [
        {
          label: "Stops before a correction",
          cause: "Records the first number immediately.",
          action: "Wait for contrast and correction signals.",
        },
      ],
      clientRequestId: "review-listening-baseline-20260801",
    },
    dependencies,
  );

  assert.equal(reviewed.requiresOwnerConfirmation, true);
  assert.equal(reviewed.submission.review.status, "draft");
  assert.equal(reviewed.submission.review.correctCount, 0);
  assert.equal(harness.snapshot().data.assessments.length, 0);
  assert.deepEqual(harness.snapshot().data.taskStates, {});

  const loaded = await STABLE_IELTS_ASSISTANT_SERVICE.getListeningSubmission(
    {},
    CONTEXT,
    prepared.submission.id,
    dependencies,
  );
  assert.equal(loaded.submission.status, "reviewed");
  assert.match(loaded.submission.review.summary, /distractor/);
});

test("provisional transcript grading cannot invent an IELTS band score", async () => {
  const harness = stateHarness();
  const dependencies = {
    ...harness,
    downloadAudio: async () => ({ blob: new Blob(["a"]), sizeBytes: 1 }),
    transcribe: async () => ({ text: "Transcript", model: "gpt-transcribe" }),
  };
  const prepared = await STABLE_IELTS_ASSISTANT_SERVICE.prepareListeningSubmission(
    {},
    CONTEXT,
    submissionInput(),
    dependencies,
  );

  await assert.rejects(
    STABLE_IELTS_ASSISTANT_SERVICE.saveListeningReview(
      {},
      CONTEXT,
      prepared.submission.id,
      {
        gradingMode: "provisional-transcript",
        bandScore: 6.5,
        questionReviews: [{
          questionNumber: 1,
          studentAnswer: "a",
          expectedAnswer: "b",
          result: "incorrect",
          explanation: "Different answer.",
        }],
        summary: "Provisional only.",
        clientRequestId: "invalid-provisional-band",
      },
      dependencies,
    ),
    (error) => error?.code === "IELTS_PROVISIONAL_REVIEW_CANNOT_SET_BAND",
  );
});

test("Listening file downloads reject non-OpenAI hosts before network access", async () => {
  const harness = stateHarness();
  let fetched = false;
  await assert.rejects(
    STABLE_IELTS_ASSISTANT_SERVICE.prepareListeningSubmission(
      {},
      CONTEXT,
      submissionInput({
        openaiFileIdRefs: [{
          name: "listening.mp3",
          id: "file-audio",
          mime_type: "audio/mpeg",
          download_link: "https://example.com/private-audio.mp3",
        }],
      }),
      {
        ...harness,
        fetchFile: async () => {
          fetched = true;
          throw new Error("must not fetch");
        },
        transcribe: async () => ({ text: "unused" }),
      },
    ),
    (error) => error?.code === "IELTS_LISTENING_FILE_URL_UNTRUSTED",
  );
  assert.equal(fetched, false);
});

test("GPT Actions routes conversation file references to the Listening bridge", async () => {
  let received = null;
  const ieltsService = {
    async prepareListeningSubmission(env, context, input) {
      received = { env, context, input };
      return {
        ok: true,
        deduplicated: false,
        submission: {
          id: "listening-gpt-1",
          taskId: input.taskId,
          status: "transcribed",
          studentAnswers: input.studentAnswers,
          transcript: "Transcript",
          clientRequestId: input.clientRequestId,
        },
        stateVersion: 1,
      };
    },
  };
  const response = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/ielts/listening/submissions", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submissionInput()),
    }),
    {},
    {
      authenticate: async () => CONTEXT,
      ieltsService,
    },
  );

  assert.equal(response.status, 201);
  assert.equal(received.input.openaiFileIdRefs[0].id, "file-audio");
  assert.equal((await response.json()).submission.status, "transcribed");
});

test("Listening transcription and review honor granular IELTS scopes", () => {
  assert.equal(
    canPerformIeltsAction("assistant", IELTS_ACTIONS.LISTENING_TRANSCRIBE, ["ielts:read"]),
    false,
  );
  assert.equal(
    canPerformIeltsAction(
      "assistant",
      IELTS_ACTIONS.LISTENING_TRANSCRIBE,
      [IELTS_ACTIONS.LISTENING_TRANSCRIBE],
    ),
    true,
  );
  assert.equal(
    canPerformIeltsAction("viewer", IELTS_ACTIONS.LISTENING_REVIEW),
    false,
  );
});
