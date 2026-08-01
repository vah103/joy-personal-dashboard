import { JoyCoreError } from "./joy-core/service.js";
import {
  mutateIeltsState,
  readIeltsState,
} from "./ielts-core.js";

const MAX_FILES = 10;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 60_000;
const MAX_SUBMISSIONS = 12;
const AUDIO_EXTENSIONS = new Set([
  "flac",
  "m4a",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "ogg",
  "wav",
  "webm",
]);
const AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
  "video/mp4",
  "video/webm",
]);
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const GRADING_MODES = new Set(["official-key", "provisional-transcript"]);
const ANSWER_RESULTS = new Set(["correct", "incorrect", "unanswered", "uncertain"]);

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function requiredText(value, field, maxLength = 4_000) {
  const text = String(value || "").trim();
  if (!text) throw new JoyCoreError("IELTS_INVALID_INPUT", 400, { field });
  if (text.length > maxLength) {
    throw new JoyCoreError("IELTS_INVALID_INPUT", 400, { field, maxLength });
  }
  return text;
}

function optionalText(value, maxLength = 4_000) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizedDate(value) {
  const date = String(value || new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new JoyCoreError("IELTS_INVALID_DATE", 400, { date });
  }
  return date;
}

function finiteNumber(value, field, minimum, maximum, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new JoyCoreError("IELTS_INVALID_INPUT", 400, { field, minimum, maximum });
  }
  return number;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableId(prefix, requestId) {
  const slug = String(requestId)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "request";
  return `${prefix}-${slug}-${stableHash(requestId)}`.slice(0, 80);
}

function extension(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function normalizeFileRef(value, index) {
  if (!object(value).download_link) {
    throw new JoyCoreError("IELTS_LISTENING_FILE_REFS_NOT_EXPANDED", 400, {
      index,
      hint: "GPT Actions must populate openaiFileIdRefs at runtime.",
    });
  }
  const name = requiredText(value.name || `attachment-${index + 1}`, `openaiFileIdRefs.${index}.name`, 240);
  const mimeType = String(value.mime_type || value.mimeType || "application/octet-stream")
    .trim()
    .toLowerCase()
    .slice(0, 120);
  const fileExtension = extension(name);
  const kind = AUDIO_MIME_TYPES.has(mimeType) || AUDIO_EXTENSIONS.has(fileExtension)
    ? "audio"
    : IMAGE_MIME_TYPES.has(mimeType)
      ? "image"
      : mimeType === "application/pdf"
        ? "document"
        : "other";
  return {
    id: optionalText(value.id, 160),
    name,
    mimeType,
    downloadLink: requiredText(value.download_link, `openaiFileIdRefs.${index}.download_link`, 4_000),
    kind,
  };
}

function publicFile(ref, sizeBytes = null) {
  return {
    id: ref.id || null,
    name: ref.name,
    mimeType: ref.mimeType,
    kind: ref.kind,
    sizeBytes,
  };
}

function normalizeStudentAnswer(value, index) {
  const questionNumber = Math.trunc(finiteNumber(
    value?.questionNumber,
    `studentAnswers.${index}.questionNumber`,
    1,
    100,
  ));
  return {
    questionNumber,
    answer: String(value?.answer ?? "").slice(0, 500),
    questionText: optionalText(value?.questionText, 2_000),
    uncertain: value?.uncertain === true,
  };
}

function normalizeQuestionReview(value, index) {
  const result = String(value?.result || "").trim().toLowerCase();
  if (!ANSWER_RESULTS.has(result)) {
    throw new JoyCoreError("IELTS_INVALID_LISTENING_RESULT", 400, { index, result });
  }
  return {
    questionNumber: Math.trunc(finiteNumber(
      value?.questionNumber,
      `questionReviews.${index}.questionNumber`,
      1,
      100,
    )),
    studentAnswer: String(value?.studentAnswer ?? "").slice(0, 500),
    expectedAnswer: String(value?.expectedAnswer ?? "").slice(0, 500),
    result,
    explanation: requiredText(value?.explanation, `questionReviews.${index}.explanation`, 4_000),
    transcriptEvidence: optionalText(value?.transcriptEvidence, 4_000),
    confidence: finiteNumber(value?.confidence, `questionReviews.${index}.confidence`, 0, 1, null),
  };
}

function normalizeRecurringError(value, index) {
  return {
    label: requiredText(value?.label, `recurringErrors.${index}.label`, 240),
    cause: requiredText(value?.cause, `recurringErrors.${index}.cause`, 4_000),
    action: requiredText(value?.action, `recurringErrors.${index}.action`, 4_000),
  };
}

function assertTrustedFileUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new JoyCoreError("IELTS_LISTENING_FILE_URL_INVALID", 400);
  }
  const trustedHost = url.hostname === "files.oaiusercontent.com"
    || url.hostname.endsWith(".oaiusercontent.com");
  if (url.protocol !== "https:" || !trustedHost || url.username || url.password) {
    throw new JoyCoreError("IELTS_LISTENING_FILE_URL_UNTRUSTED", 400, {
      hostname: url.hostname,
    });
  }
  return url;
}

async function downloadAudio(ref, dependencies = {}) {
  const fetchFile = dependencies.fetchFile || fetch;
  const url = assertTrustedFileUrl(ref.downloadLink);
  const response = await fetchFile(url, {
    method: "GET",
    redirect: "manual",
    headers: { Accept: ref.mimeType || "audio/*" },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new JoyCoreError("IELTS_LISTENING_FILE_REDIRECT_REJECTED", 400);
  }
  if (!response.ok) {
    throw new JoyCoreError("IELTS_LISTENING_FILE_DOWNLOAD_FAILED", 502, {
      status: response.status,
    });
  }
  const declaredLength = Number(response.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_AUDIO_BYTES) {
    throw new JoyCoreError("IELTS_LISTENING_AUDIO_TOO_LARGE", 413, {
      maxBytes: MAX_AUDIO_BYTES,
    });
  }
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_AUDIO_BYTES) {
    throw new JoyCoreError(
      bytes.byteLength ? "IELTS_LISTENING_AUDIO_TOO_LARGE" : "IELTS_LISTENING_AUDIO_EMPTY",
      bytes.byteLength ? 413 : 400,
      { maxBytes: MAX_AUDIO_BYTES },
    );
  }
  return {
    blob: new Blob([bytes], { type: ref.mimeType || "application/octet-stream" }),
    sizeBytes: bytes.byteLength,
  };
}

async function transcribeAudio(env, ref, downloaded, dependencies = {}) {
  if (dependencies.transcribe) {
    return dependencies.transcribe(env, ref, downloaded);
  }
  const apiKey = String(env?.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw new JoyCoreError("IELTS_LISTENING_TRANSCRIPTION_NOT_CONFIGURED", 503);

  const model = String(env?.OPENAI_TRANSCRIPTION_MODEL || "gpt-transcribe").trim();
  const form = new FormData();
  form.append("file", downloaded.blob, ref.name);
  form.append("model", model);
  form.append("language", "en");
  form.append(
    "prompt",
    "IELTS Academic Listening practice. Preserve names, numbers, dates, prices, addresses, spelling, corrections, and singular or plural endings exactly when audible.",
  );

  const fetchOpenAI = dependencies.fetchOpenAI || fetch;
  const response = await fetchOpenAI("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    let message = "";
    try {
      const payload = await response.json();
      message = optionalText(payload?.error?.message, 500);
    } catch {
      message = optionalText(await response.text(), 500);
    }
    throw new JoyCoreError("IELTS_LISTENING_TRANSCRIPTION_FAILED", 502, {
      status: response.status,
      message: message || null,
    });
  }
  const payload = await response.json();
  const transcript = requiredText(payload?.text, "transcript", MAX_TRANSCRIPT_CHARS * 2);
  return {
    text: transcript,
    model,
    languages: Array.isArray(payload?.languages) ? payload.languages.slice(0, 5) : [],
  };
}

function findSubmission(data, idOrRequestId) {
  return (data.listeningSubmissions || []).find((item) => (
    item.id === idOrRequestId || item.clientRequestId === idOrRequestId
  )) || null;
}

function responseSubmission(submission) {
  return JSON.parse(JSON.stringify(submission));
}

export function recentIeltsListeningSubmissions(data, limit = 5) {
  return [...(data.listeningSubmissions || [])]
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      taskId: item.taskId,
      date: item.date,
      title: item.title,
      status: item.status,
      audio: item.audio,
      studentAnswerCount: Array.isArray(item.studentAnswers) ? item.studentAnswers.length : 0,
      review: item.review ? {
        gradingMode: item.review.gradingMode,
        correctCount: item.review.correctCount,
        totalQuestions: item.review.totalQuestions,
        bandScore: item.review.bandScore,
        summary: item.review.summary,
      } : null,
      updatedAt: item.updatedAt,
    }));
}

export async function prepareIeltsListeningSubmission(
  env,
  context,
  input = {},
  dependencies = {},
) {
  const taskId = requiredText(input.taskId, "taskId", 160);
  const clientRequestId = requiredText(input.clientRequestId, "clientRequestId", 80);
  if (!Array.isArray(input.openaiFileIdRefs) || input.openaiFileIdRefs.length < 1) {
    throw new JoyCoreError("IELTS_LISTENING_FILES_REQUIRED", 400);
  }
  if (input.openaiFileIdRefs.length > MAX_FILES) {
    throw new JoyCoreError("IELTS_LISTENING_TOO_MANY_FILES", 400, { maxFiles: MAX_FILES });
  }
  if (!Array.isArray(input.studentAnswers) || input.studentAnswers.length < 1) {
    throw new JoyCoreError("IELTS_LISTENING_STUDENT_ANSWERS_REQUIRED", 400);
  }

  const refs = input.openaiFileIdRefs.map(normalizeFileRef);
  const audioFiles = refs.filter((item) => item.kind === "audio");
  if (audioFiles.length !== 1) {
    throw new JoyCoreError("IELTS_LISTENING_ONE_AUDIO_REQUIRED", 400, {
      audioFiles: audioFiles.length,
    });
  }
  const studentAnswers = input.studentAnswers
    .slice(0, 100)
    .map(normalizeStudentAnswer)
    .sort((left, right) => left.questionNumber - right.questionNumber);
  const readState = dependencies.readState || readIeltsState;
  const existingState = await readState(context.userEmail, env);
  const existing = findSubmission(existingState.data, clientRequestId);
  if (existing?.transcript) {
    return {
      ok: true,
      deduplicated: true,
      submission: responseSubmission(existing),
      stateVersion: existingState.version,
    };
  }

  const audioRef = audioFiles[0];
  const downloaded = dependencies.downloadAudio
    ? await dependencies.downloadAudio(audioRef)
    : await downloadAudio(audioRef, dependencies);
  const transcription = await transcribeAudio(env, audioRef, downloaded, dependencies);
  const now = Number(dependencies.now?.() || Date.now());
  const rawTranscript = String(transcription.text || "").trim();
  const transcript = rawTranscript.slice(0, MAX_TRANSCRIPT_CHARS);
  const submission = {
    id: stableId("listening-gpt", clientRequestId),
    taskId,
    date: normalizedDate(input.date),
    title: optionalText(input.title || "IELTS Listening submission", 240),
    status: "transcribed",
    files: refs.map((ref) => publicFile(
      ref,
      ref.id === audioRef.id && ref.name === audioRef.name ? downloaded.sizeBytes : null,
    )),
    audio: {
      fileId: audioRef.id || null,
      name: audioRef.name,
      mimeType: audioRef.mimeType,
      sizeBytes: downloaded.sizeBytes,
      transcriptionModel: transcription.model || null,
    },
    studentAnswers,
    transcript,
    transcriptTruncated: rawTranscript.length > MAX_TRANSCRIPT_CHARS,
    detectedLanguages: Array.isArray(transcription.languages)
      ? transcription.languages.slice(0, 5)
      : [],
    review: null,
    source: "chatgpt",
    clientRequestId,
    createdAt: now,
    updatedAt: now,
  };

  const mutateState = dependencies.mutateState || mutateIeltsState;
  const result = await mutateState(context.userEmail, env, (data) => {
    const current = findSubmission(data, clientRequestId);
    if (current?.transcript) return data;
    data.listeningSubmissions = [
      ...(data.listeningSubmissions || []).filter((item) => (
        item.id !== submission.id && item.clientRequestId !== clientRequestId
      )),
      submission,
    ].slice(-MAX_SUBMISSIONS);
    return data;
  });
  const saved = findSubmission(result.data, clientRequestId) || submission;
  return {
    ok: true,
    deduplicated: saved.id !== submission.id || saved.createdAt !== submission.createdAt,
    submission: responseSubmission(saved),
    stateVersion: result.version,
  };
}

export async function getIeltsListeningSubmission(
  env,
  context,
  submissionId,
  dependencies = {},
) {
  const id = requiredText(submissionId, "submissionId", 160);
  const readState = dependencies.readState || readIeltsState;
  const record = await readState(context.userEmail, env);
  const submission = findSubmission(record.data, id);
  if (!submission) {
    throw new JoyCoreError("IELTS_LISTENING_SUBMISSION_NOT_FOUND", 404, { submissionId: id });
  }
  return {
    submission: responseSubmission(submission),
    stateVersion: record.version,
  };
}

export async function saveIeltsListeningReview(
  env,
  context,
  submissionId,
  input = {},
  dependencies = {},
) {
  const id = requiredText(submissionId, "submissionId", 160);
  const clientRequestId = requiredText(input.clientRequestId, "clientRequestId", 80);
  const gradingMode = String(input.gradingMode || "").trim().toLowerCase();
  if (!GRADING_MODES.has(gradingMode)) {
    throw new JoyCoreError("IELTS_INVALID_LISTENING_GRADING_MODE", 400, { gradingMode });
  }
  if (!Array.isArray(input.questionReviews) || input.questionReviews.length < 1) {
    throw new JoyCoreError("IELTS_LISTENING_QUESTION_REVIEWS_REQUIRED", 400);
  }
  const questionReviews = input.questionReviews
    .slice(0, 100)
    .map(normalizeQuestionReview)
    .sort((left, right) => left.questionNumber - right.questionNumber);
  const correctCount = questionReviews.filter((item) => item.result === "correct").length;
  const bandScore = finiteNumber(input.bandScore, "bandScore", 0, 9, null);
  if (gradingMode !== "official-key" && bandScore !== null) {
    throw new JoyCoreError("IELTS_PROVISIONAL_REVIEW_CANNOT_SET_BAND", 400);
  }
  const now = Number(dependencies.now?.() || Date.now());
  const review = {
    gradingMode,
    correctCount,
    totalQuestions: questionReviews.length,
    bandScore,
    questionReviews,
    summary: requiredText(input.summary, "summary", 20_000),
    recurringErrors: Array.isArray(input.recurringErrors)
      ? input.recurringErrors.slice(0, 10).map(normalizeRecurringError)
      : [],
    clientRequestId,
    status: "draft",
    updatedAt: now,
  };

  const mutateState = dependencies.mutateState || mutateIeltsState;
  let saved = null;
  const result = await mutateState(context.userEmail, env, (data) => {
    const submission = findSubmission(data, id);
    if (!submission) {
      throw new JoyCoreError("IELTS_LISTENING_SUBMISSION_NOT_FOUND", 404, {
        submissionId: id,
      });
    }
    submission.status = "reviewed";
    submission.review = review;
    submission.updatedAt = now;
    saved = responseSubmission(submission);
    return data;
  });
  return {
    ok: true,
    submission: saved,
    stateVersion: result.version,
    requiresOwnerConfirmation: true,
    nextActions: [
      "Confirm the grading with the owner.",
      "Only after confirmation, save an IELTS assessment or recurring errors and complete the task if appropriate.",
    ],
  };
}

export const IELTS_LISTENING_SERVICE = Object.freeze({
  prepareListeningSubmission: prepareIeltsListeningSubmission,
  getListeningSubmission: getIeltsListeningSubmission,
  saveListeningReview: saveIeltsListeningReview,
});
