import assert from "node:assert/strict";
import test from "node:test";

import { STABLE_IELTS_ASSISTANT_SERVICE } from "../worker/ielts-assistant-service.js";
import { blankIeltsState } from "../worker/ielts-core.js";

const CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: null,
  actorType: "assistant",
  actorId: "chatgpt-custom-gpt",
};

function harness() {
  const data = blankIeltsState();
  return {
    readState: async () => ({
      planId: "ielts-band-7-december-2026",
      data: structuredClone(data),
      version: 0,
      updatedAt: 0,
    }),
    mutateState: async () => {
      throw new Error("must not mutate");
    },
  };
}

test("Listening transcription rejects a non-Listening IELTS task before file download", async () => {
  let downloaded = false;
  await assert.rejects(
    STABLE_IELTS_ASSISTANT_SERVICE.prepareListeningSubmission(
      {},
      CONTEXT,
      {
        taskId: "baseline-reading",
        date: "2026-08-01",
        openaiFileIdRefs: [{
          name: "audio.m4a",
          id: "file-audio",
          mime_type: "audio/m4a",
          download_link: "https://files.oaiusercontent.com/file-audio?sig=test",
        }],
        studentAnswers: [{ questionNumber: 1, answer: "answer", uncertain: false }],
        clientRequestId: "wrong-task",
      },
      {
        ...harness(),
        downloadAudio: async () => {
          downloaded = true;
          return { blob: new Blob(["audio"]), sizeBytes: 5 };
        },
        transcribe: async () => ({ text: "unused" }),
      },
    ),
    (error) => error?.code === "IELTS_LISTENING_TASK_REQUIRED"
      && error?.details?.skill === "reading",
  );
  assert.equal(downloaded, false);
});
