import {
  IELTS_ASSISTANT_SERVICE,
  getIeltsTeachingTask,
} from "./ielts-assistant.js";
import {
  mutateIeltsState,
  readIeltsState,
} from "./ielts-core.js";
import { IELTS_LISTENING_SERVICE } from "./ielts-listening.js";
import { IELTS_REVIEW_DOCUMENT_SERVICE } from "./ielts-review-docs.js";
import { JoyCoreError } from "./joy-core/service.js";
import {
  decorateIeltsTeachingContext,
  decorateIeltsTeachingTask,
} from "./ielts-source-library.js";

const LISTENING_STATE_KEY = "__joyListeningSubmissions";
const MAX_STORED_LISTENING_SUBMISSIONS = 8;
const MAX_STORED_TRANSCRIPT_CHARS = 40_000;

function boundedListeningSubmissions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_STORED_LISTENING_SUBMISSIONS).map((submission) => {
    if (!submission || typeof submission !== "object") return submission;
    const rawTranscript = String(submission.transcript || "");
    return {
      ...submission,
      transcript: rawTranscript.slice(0, MAX_STORED_TRANSCRIPT_CHARS),
      transcriptTruncated: submission.transcriptTruncated === true
        || rawTranscript.length > MAX_STORED_TRANSCRIPT_CHARS,
    };
  });
}

function attachListeningState(data) {
  if (!data || typeof data !== "object") return data;
  if (!data.rhythmReviews || typeof data.rhythmReviews !== "object" || Array.isArray(data.rhythmReviews)) {
    data.rhythmReviews = {};
  }
  data.rhythmReviews[LISTENING_STATE_KEY] = boundedListeningSubmissions(
    data.rhythmReviews[LISTENING_STATE_KEY],
  );
  Object.defineProperty(data, "listeningSubmissions", {
    configurable: true,
    enumerable: false,
    get() {
      return data.rhythmReviews[LISTENING_STATE_KEY];
    },
    set(value) {
      data.rhythmReviews[LISTENING_STATE_KEY] = boundedListeningSubmissions(value);
    },
  });
  return data;
}

function listeningDependencies(dependencies = {}) {
  const readState = dependencies.readState || readIeltsState;
  const mutateState = dependencies.mutateState || mutateIeltsState;
  return {
    ...dependencies,
    async readState(email, env) {
      const record = await readState(email, env);
      attachListeningState(record.data);
      return record;
    },
    async mutateState(email, env, updater) {
      return mutateState(email, env, (data, current) => {
        attachListeningState(data);
        return updater(data, current);
      });
    },
  };
}

async function getTeachingContext(env, context, input = {}, dependencies = {}) {
  const result = await IELTS_ASSISTANT_SERVICE.getTeachingContext(
    env,
    context,
    input,
    dependencies,
  );
  return decorateIeltsTeachingContext(result);
}

async function getTeachingTask(env, context, taskId, input = {}, dependencies = {}) {
  const result = await IELTS_ASSISTANT_SERVICE.getTeachingTask(
    env,
    context,
    taskId,
    input,
    dependencies,
  );
  return decorateIeltsTeachingTask(result);
}

async function startTask(env, context, taskId, input = {}, dependencies = {}) {
  await getIeltsTeachingTask(env, context, taskId, input, dependencies);
  const mutateState = dependencies.mutateState || mutateIeltsState;
  const result = await mutateState(context.userEmail, env, (data) => {
    const current = data.taskStates?.[taskId] || {};
    if (current.status !== "completed") {
      data.taskStates[taskId] = {
        ...current,
        status: "progress",
        startedAt: Number(current.startedAt || Date.now()),
        updatedAt: Date.now(),
      };
    }
    return data;
  });
  return {
    ok: true,
    taskId,
    state: result.data.taskStates?.[taskId] || {},
    stateVersion: result.version,
  };
}

async function prepareListeningSubmission(env, context, input = {}, dependencies = {}) {
  const task = await getIeltsTeachingTask(
    env,
    context,
    input.taskId,
    { date: input.date },
    dependencies,
  );
  if (task.task?.skill !== "listening") {
    throw new JoyCoreError("IELTS_LISTENING_TASK_REQUIRED", 400, {
      taskId: input.taskId || null,
      skill: task.task?.skill || null,
    });
  }
  return IELTS_LISTENING_SERVICE.prepareListeningSubmission(
    env,
    context,
    input,
    listeningDependencies(dependencies),
  );
}

async function getListeningSubmission(env, context, submissionId, dependencies = {}) {
  return IELTS_LISTENING_SERVICE.getListeningSubmission(
    env,
    context,
    submissionId,
    listeningDependencies(dependencies),
  );
}

async function saveListeningReview(
  env,
  context,
  submissionId,
  input = {},
  dependencies = {},
) {
  return IELTS_LISTENING_SERVICE.saveListeningReview(
    env,
    context,
    submissionId,
    input,
    listeningDependencies(dependencies),
  );
}

export const STABLE_IELTS_ASSISTANT_SERVICE = Object.freeze({
  ...IELTS_ASSISTANT_SERVICE,
  getTeachingContext,
  getTeachingTask,
  startTask,
  prepareListeningSubmission,
  getListeningSubmission,
  saveListeningReview,
  saveReviewDocument: IELTS_REVIEW_DOCUMENT_SERVICE.save,
});
