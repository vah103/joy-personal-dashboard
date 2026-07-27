const SESSION_COOKIE = "__Host-joy_session";
const REVIEW_PATH = "/api/ielts/diagnostic-review";
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_ANSWER_CHARS = 40_000;

const TASK_1_PROMPT = `The table shows the average number of minutes per day university students spent on three digital activities in 2016 and 2026. Summarise the main features and make relevant comparisons.

Data:
- Online study: 42 minutes in 2016; 88 minutes in 2026
- Social media: 96 minutes in 2016; 74 minutes in 2026
- Streaming: 54 minutes in 2016; 82 minutes in 2026`;

const TASK_2_PROMPT = "Some people believe university students should focus only on their main subject, while others think they should study a wider range of subjects. Discuss both views and give your own opinion.";

export function isIeltsDiagnosticReviewRoute(pathname) {
  return pathname === REVIEW_PATH;
}

export async function handleIeltsDiagnosticReviewRequest(request, env) {
  try {
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }

    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
    if (!env?.AI?.run) return json({ error: "AI_UNAVAILABLE" }, 503);

    const body = await readJson(request);
    if (body.skill !== "writing") {
      return json({ error: "UNSUPPORTED_DIAGNOSTIC_SKILL" }, 400);
    }

    const task1Text = cleanAnswer(body.task1Text);
    const task2Text = cleanAnswer(body.task2Text);
    const task1Words = wordCount(task1Text);
    const task2Words = wordCount(task2Text);

    if (
      task1Words < 150
      || task2Words < 250
      || task1Text.length > MAX_ANSWER_CHARS
      || task2Text.length > MAX_ANSWER_CHARS
    ) {
      return json({
        error: "INVALID_WRITING_DIAGNOSTIC",
        task1Words,
        task2Words,
      }, 400);
    }

    const submission = {
      task1Prompt: TASK_1_PROMPT,
      task1Text,
      task1Words,
      task1Minutes: boundedNumber(body.task1Minutes, 20, 1, 120),
      task2Prompt: TASK_2_PROMPT,
      task2Text,
      task2Words,
      task2Minutes: boundedNumber(body.task2Minutes, 40, 1, 180),
      learnerContext: normalizeLearnerContext(body.learnerProfile),
    };

    const model = env.IELTS_REVIEW_AI_MODEL || DEFAULT_AI_MODEL;
    const evidenceResult = await env.AI.run(model, {
      messages: evidenceMessages(submission),
      temperature: 0.05,
      max_tokens: 2800,
    });
    const evidence = parseJsonResult(evidenceResult);
    if (!evidence) return json({ error: "IELTS_EVIDENCE_ANALYSIS_FAILED" }, 502);

    const scoringResult = await env.AI.run(model, {
      messages: scoringMessages(submission, evidence),
      temperature: 0.03,
      max_tokens: 3600,
    });
    const scored = parseJsonResult(scoringResult);
    if (!scored) return json({ error: "IELTS_SCORING_FAILED" }, 502);

    const review = normalizeWritingReview(scored, submission);
    if (!review) return json({ error: "IELTS_REVIEW_INVALID" }, 502);

    return json({
      ok: true,
      skill: "writing",
      review,
      reviewedAt: Date.now(),
      model,
      methodology: "two-pass-evidence-then-scoring",
      disclaimer: "This is an AI diagnostic estimate, not an official IELTS result.",
    });
  } catch (error) {
    console.error("Joy IELTS diagnostic review failed", error);
    return json({ error: "IELTS_DIAGNOSTIC_REVIEW_FAILED" }, 500);
  }
}

function evidenceMessages(submission) {
  return [
    {
      role: "system",
      content: `You are the evidence analyst in a two-pass IELTS Academic Writing diagnostic.

Do not assign band scores. Analyse only what is demonstrably present in the candidate's writing. Use the official IELTS assessment areas as the framework:
- Task Achievement for Academic Task 1
- Task Response for Task 2
- Coherence and Cohesion
- Lexical Resource
- Grammatical Range and Accuracy

For Task 1, check overview, selection of key features, comparisons and data accuracy. For Task 2, check whether both views are discussed, whether the writer's position is clear, and whether ideas are relevant, extended and supported. For both tasks, identify organisation, referencing, cohesive-device use, vocabulary range/precision, spelling/word formation, sentence-form range, grammar and punctuation.

Be conservative. Never infer a strength that is not supported by the text. Quote only short exact excerpts from the candidate. Return valid JSON only, no markdown, using this shape:
{
  "task1": {
    "coverage": ["..."],
    "organisation": ["..."],
    "language": ["..."],
    "evidence": [{"quote":"...","finding":"...","criterion":"..."}]
  },
  "task2": {
    "coverage": ["..."],
    "organisation": ["..."],
    "language": ["..."],
    "evidence": [{"quote":"...","finding":"...","criterion":"..."}]
  },
  "recurringPatterns": [{"category":"...","pattern":"...","evidence":"...","suggestedCorrection":"..."}],
  "uncertainties": ["..."]
}`,
    },
    {
      role: "user",
      content: diagnosticSubmissionText(submission),
    },
  ];
}

function scoringMessages(submission, evidence) {
  return [
    {
      role: "system",
      content: `You are the senior scorer and verifier for an IELTS Academic Writing diagnostic. Independently inspect the original answers and audit the evidence analyst's notes. Correct any unsupported note.

Use the four official assessment criteria. Assign half-band scores from 0 to 9 for each criterion. Task 1 uses Task Achievement; Task 2 uses Task Response. Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy apply to both tasks. Be conservative around band boundaries. A fluent-sounding response must not receive a high task score if it misses requirements, lacks an overview, gives inaccurate data, does not discuss both views, or leaves ideas insufficiently developed.

Do not calculate the final weighted Writing band; the server will calculate it. Every strength and priority error must contain a short exact excerpt from the candidate or a precise task-level observation. Corrections must preserve the candidate's intended meaning. Return valid JSON only, no markdown, using exactly this shape:
{
  "task1": {
    "scores": {"taskAchievement": 0, "coherenceCohesion": 0, "lexicalResource": 0, "grammaticalRangeAccuracy": 0},
    "summary": "...",
    "evidence": [{"quote":"...","finding":"..."}]
  },
  "task2": {
    "scores": {"taskResponse": 0, "coherenceCohesion": 0, "lexicalResource": 0, "grammaticalRangeAccuracy": 0},
    "summary": "...",
    "evidence": [{"quote":"...","finding":"..."}]
  },
  "confidence": "low|medium|high",
  "strengths": [{"title":"...","evidence":"...","whyItMatters":"..."}],
  "priorityErrors": [{"code":"...","category":"Task|Coherence|Vocabulary|Grammar","title":"...","evidence":"...","correction":"...","explanation":"...","severity":"high|medium|low"}],
  "learningPriorities": [{"rank":1,"focus":"...","reason":"...","nextExercise":"..."}],
  "rewritePlan": {"task":"Task 1|Task 2|Both","deadlineHours":48,"instructions":["..."]},
  "examinerSummary": "..."
}`,
    },
    {
      role: "user",
      content: `${diagnosticSubmissionText(submission)}\n\nEVIDENCE ANALYST NOTES TO AUDIT:\n${JSON.stringify(evidence)}`,
    },
  ];
}

function diagnosticSubmissionText(submission) {
  const context = submission.learnerContext
    ? `LEARNER CONTEXT (do not use this to inflate the score):\n${JSON.stringify(submission.learnerContext)}\n\n`
    : "";
  return `${context}TASK 1 PROMPT:\n${submission.task1Prompt}\n\nTASK 1 ANSWER (${submission.task1Words} words; ${submission.task1Minutes} minutes):\n${submission.task1Text}\n\nTASK 2 PROMPT:\n${submission.task2Prompt}\n\nTASK 2 ANSWER (${submission.task2Words} words; ${submission.task2Minutes} minutes):\n${submission.task2Text}`;
}

function normalizeWritingReview(value, submission) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const task1Scores = {
    taskAchievement: halfBand(value.task1?.scores?.taskAchievement),
    coherenceCohesion: halfBand(value.task1?.scores?.coherenceCohesion),
    lexicalResource: halfBand(value.task1?.scores?.lexicalResource),
    grammaticalRangeAccuracy: halfBand(value.task1?.scores?.grammaticalRangeAccuracy),
  };
  const task2Scores = {
    taskResponse: halfBand(value.task2?.scores?.taskResponse),
    coherenceCohesion: halfBand(value.task2?.scores?.coherenceCohesion),
    lexicalResource: halfBand(value.task2?.scores?.lexicalResource),
    grammaticalRangeAccuracy: halfBand(value.task2?.scores?.grammaticalRangeAccuracy),
  };

  if ([...Object.values(task1Scores), ...Object.values(task2Scores)].some((score) => score === null)) {
    return null;
  }

  const task1Band = halfBand(average(Object.values(task1Scores)));
  const task2Band = halfBand(average(Object.values(task2Scores)));
  const overallBand = halfBand((task1Band + (2 * task2Band)) / 3);

  return {
    version: 1,
    task1: {
      scores: task1Scores,
      band: task1Band,
      summary: cleanText(value.task1?.summary, 1200),
      evidence: normalizeEvidence(value.task1?.evidence, 6),
      words: submission.task1Words,
      minutes: submission.task1Minutes,
    },
    task2: {
      scores: task2Scores,
      band: task2Band,
      summary: cleanText(value.task2?.summary, 1200),
      evidence: normalizeEvidence(value.task2?.evidence, 6),
      words: submission.task2Words,
      minutes: submission.task2Minutes,
    },
    overallBand,
    confidence: ["low", "medium", "high"].includes(value.confidence) ? value.confidence : "medium",
    strengths: normalizeStrengths(value.strengths, 5),
    priorityErrors: normalizeErrors(value.priorityErrors, 8),
    learningPriorities: normalizePriorities(value.learningPriorities, 5),
    rewritePlan: normalizeRewritePlan(value.rewritePlan),
    examinerSummary: cleanText(value.examinerSummary, 1800),
    weighting: "Task 1 ×1; Task 2 ×2",
  };
}

function normalizeEvidence(value, limit) {
  return array(value, limit).map((item) => ({
    quote: cleanText(item?.quote, 220),
    finding: cleanText(item?.finding, 500),
  })).filter((item) => item.quote || item.finding);
}

function normalizeStrengths(value, limit) {
  return array(value, limit).map((item) => ({
    title: cleanText(item?.title, 180),
    evidence: cleanText(item?.evidence, 240),
    whyItMatters: cleanText(item?.whyItMatters, 500),
  })).filter((item) => item.title && item.whyItMatters);
}

function normalizeErrors(value, limit) {
  return array(value, limit).map((item, index) => ({
    code: cleanText(item?.code, 60) || `WR-${index + 1}`,
    category: ["Task", "Coherence", "Vocabulary", "Grammar"].includes(item?.category)
      ? item.category
      : "Grammar",
    title: cleanText(item?.title, 180),
    evidence: cleanText(item?.evidence, 260),
    correction: cleanText(item?.correction, 400),
    explanation: cleanText(item?.explanation, 700),
    severity: ["high", "medium", "low"].includes(item?.severity) ? item.severity : "medium",
  })).filter((item) => item.title && item.explanation);
}

function normalizePriorities(value, limit) {
  return array(value, limit).map((item, index) => ({
    rank: index + 1,
    focus: cleanText(item?.focus, 180),
    reason: cleanText(item?.reason, 600),
    nextExercise: cleanText(item?.nextExercise, 600),
  })).filter((item) => item.focus && item.nextExercise);
}

function normalizeRewritePlan(value) {
  const task = ["Task 1", "Task 2", "Both"].includes(value?.task) ? value.task : "Task 2";
  return {
    task,
    deadlineHours: boundedNumber(value?.deadlineHours, 48, 12, 168),
    instructions: array(value?.instructions, 6)
      .map((item) => cleanText(item, 500))
      .filter(Boolean),
  };
}

function parseJsonResult(result) {
  const raw = result?.response ?? result?.result ?? result?.text ?? "";
  const text = typeof raw === "object" ? JSON.stringify(raw) : String(raw || "");
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalizeLearnerContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    overallTarget: boundedNumber(value.overallTarget, 7, 0, 9),
    augustWritingTarget: boundedNumber(value.augustWritingTarget, 6, 0, 9),
    writingMethod: cleanText(value.writingMethod, 300),
    strengths: cleanText(value.strengths, 800),
    concerns: cleanText(value.concerns, 800),
  };
}

function array(value, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function halfBand(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(9, Math.max(0, Math.round(number * 2) / 2));
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function cleanAnswer(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}

function cleanText(value, limit) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function wordCount(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

async function getSession(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return env.DB.prepare(`
    SELECT user_email, expires_at
    FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).bind(tokenHash, Date.now()).first();
}

function readCookies(request) {
  return Object.fromEntries(
    (request.headers.get("Cookie") || "")
      .split(";")
      .map((part) => {
        const [name, ...rest] = part.trim().split("=");
        return [name, rest.join("=")];
      })
      .filter(([name]) => name),
  );
}

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}
