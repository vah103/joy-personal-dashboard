import assert from "node:assert/strict";
import test from "node:test";

import {
  handleIeltsDiagnosticReviewRequest,
  isIeltsDiagnosticReviewRoute,
} from "../worker/ielts-diagnostic-review.js";

function words(count, prefix) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(" ");
}

function sessionDb() {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return { user_email: "vanh@example.com", expires_at: Date.now() + 60_000 };
            },
          };
        },
      };
    },
  };
}

function request(body) {
  return new Request("https://joy.example/api/ielts/diagnostic-review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "__Host-joy_session=test-token",
      Origin: "https://joy.example",
    },
    body: JSON.stringify(body),
  });
}

test("IELTS Writing diagnostic review uses two AI passes and server-side weighting", async () => {
  let calls = 0;
  const env = {
    DB: sessionDb(),
    AI: {
      async run() {
        calls += 1;
        if (calls === 1) {
          return {
            response: JSON.stringify({
              task1: { coverage: [], organisation: [], language: [], evidence: [] },
              task2: { coverage: [], organisation: [], language: [], evidence: [] },
              recurringPatterns: [],
              uncertainties: [],
            }),
          };
        }
        return {
          response: JSON.stringify({
            task1: {
              scores: {
                taskAchievement: 5.5,
                coherenceCohesion: 5.5,
                lexicalResource: 5.5,
                grammaticalRangeAccuracy: 5.5,
              },
              summary: "Task 1 summary",
              evidence: [{ quote: "task one", finding: "clear comparison" }],
            },
            task2: {
              scores: {
                taskResponse: 6,
                coherenceCohesion: 6,
                lexicalResource: 6,
                grammaticalRangeAccuracy: 6,
              },
              summary: "Task 2 summary",
              evidence: [{ quote: "task two", finding: "clear position" }],
            },
            confidence: "medium",
            strengths: [{ title: "Position", evidence: "I believe", whyItMatters: "The opinion is visible." }],
            priorityErrors: [{
              code: "GRA-1",
              category: "Grammar",
              title: "Articles",
              evidence: "student needs",
              correction: "a student needs",
              explanation: "A singular countable noun needs an article.",
              severity: "high",
            }],
            learningPriorities: [{
              rank: 1,
              focus: "Develop explanations",
              reason: "Ideas stop early.",
              nextExercise: "Write one cause-effect paragraph.",
            }],
            rewritePlan: { task: "Task 2", deadlineHours: 48, instructions: ["Rewrite both body paragraphs."] },
            examinerSummary: "A usable starting point with development and grammar priorities.",
          }),
        };
      },
    },
  };

  const response = await handleIeltsDiagnosticReviewRequest(request({
    skill: "writing",
    task1Text: words(160, "t1word"),
    task2Text: words(270, "t2word"),
    task1Minutes: 20,
    task2Minutes: 40,
    learnerProfile: { overallTarget: 7, augustWritingTarget: 6 },
  }), env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.equal(payload.review.task1.band, 5.5);
  assert.equal(payload.review.task2.band, 6);
  assert.equal(payload.review.overallBand, 6);
  assert.equal(payload.review.weighting, "Task 1 ×1; Task 2 ×2");
  assert.equal(payload.methodology, "two-pass-evidence-then-scoring");
});

test("IELTS Writing diagnostic review rejects incomplete answers before calling AI", async () => {
  let calls = 0;
  const response = await handleIeltsDiagnosticReviewRequest(request({
    skill: "writing",
    task1Text: words(30, "short"),
    task2Text: words(40, "short"),
  }), {
    DB: sessionDb(),
    AI: { async run() { calls += 1; } },
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "INVALID_WRITING_DIAGNOSTIC");
  assert.equal(calls, 0);
});

test("IELTS diagnostic review route is exact", () => {
  assert.equal(isIeltsDiagnosticReviewRoute("/api/ielts/diagnostic-review"), true);
  assert.equal(isIeltsDiagnosticReviewRoute("/api/ielts/diagnostic-review/extra"), false);
});
