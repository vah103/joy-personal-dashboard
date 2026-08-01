import assert from "node:assert/strict";
import test from "node:test";

import {
  addIeltsAssessment,
  completeIeltsTeachingTask,
  currentIeltsContext,
  getIeltsTeachingContext,
} from "../worker/ielts-assistant.js";
import { blankIeltsState } from "../worker/ielts-core.js";
import { JOY_ACTIONS_OPENAPI } from "../worker/joy-actions-openapi-extended.js";
import { handleJoyActionsRequest } from "../worker/joy-actions.js";

const CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: null,
  actorType: "assistant",
  actorId: "chatgpt-custom-gpt",
};

function stateHarness(initial = blankIeltsState()) {
  let data = JSON.parse(JSON.stringify(initial));
  let version = 0;
  return {
    readState: async () => ({
      planId: "ielts-band-7-december-2026",
      data: JSON.parse(JSON.stringify(data)),
      version,
      updatedAt: 0,
    }),
    mutateState: async (_email, _env, updater) => {
      const draft = JSON.parse(JSON.stringify(data));
      data = await updater(draft, { data, version }) || draft;
      version += 1;
      return {
        ok: true,
        planId: "ielts-band-7-december-2026",
        data: JSON.parse(JSON.stringify(data)),
        version,
        updatedAt: Date.now(),
      };
    },
    snapshot: () => ({ data: JSON.parse(JSON.stringify(data)), version }),
  };
}

test("1 August resolves to the exact four-skill baseline used by IELTS Journey", () => {
  const context = currentIeltsContext(blankIeltsState(), "2026-08-01");
  assert.equal(context.type, "baseline");
  assert.equal(context.id, "baseline");
  assert.equal(context.tasks.length, 4);
  assert.deepEqual(
    context.tasks.map((task) => task.id),
    [
      "baseline-listening",
      "baseline-reading",
      "baseline-writing",
      "baseline-speaking",
    ],
  );
  assert.equal(context.tasks.every((task) => task.steps.length > 0), true);
  assert.equal(context.tasks.every((task) => task.doneWhen.length > 0), true);
});

test("GPT teaching context reads current tasks, learner evidence, and the next task", async () => {
  const state = blankIeltsState();
  state.errorLogs.push({
    id: "error-1",
    skill: "listening",
    label: "Loses focus after distractors",
    cause: "Stops predicting the next answer",
    action: "Underline the next answer type",
    count: 2,
    active: true,
  });
  state.courseSessions.push({
    id: "course-1",
    date: "2026-07-31",
    title: "Task 1 overview",
    summary: "Use one clear overview paragraph.",
    updatedAt: 1,
  });
  const harness = stateHarness(state);
  const result = await getIeltsTeachingContext({}, CONTEXT, { date: "2026-08-01" }, harness);

  assert.equal(result.current.id, "baseline");
  assert.equal(result.current.tasks.length, 4);
  assert.equal(result.nextTask.id, "baseline-listening");
  assert.equal(result.activeErrors[0].label, "Loses focus after distractors");
  assert.equal(result.recentCourseSessions[0].title, "Task 1 overview");
});

test("GPT completion writes evidence and reflection into the same IELTS task state", async () => {
  const harness = stateHarness();
  const result = await completeIeltsTeachingTask(
    {},
    CONTEXT,
    "baseline-listening",
    {
      minutes: 90,
      evidence: "31/40 on the official practice test",
      reflection: "Spelling and distractors caused most lost marks.",
    },
    harness,
  );

  assert.equal(result.ok, true);
  assert.equal(result.state.status, "completed");
  assert.equal(result.state.minutes, 90);
  assert.match(result.state.evidence, /31\/40/);
  assert.match(harness.snapshot().data.taskStates["baseline-listening"].reflection, /Spelling/);
});

test("assessment writes are idempotent by clientRequestId", async () => {
  const harness = stateHarness();
  const input = {
    date: "2026-08-01",
    label: "Listening baseline",
    scores: { listening: 6.5 },
    evidence: "Official practice score with reviewed answers.",
    clientRequestId: "ielts-baseline-listening-20260801",
  };
  const first = await addIeltsAssessment({}, CONTEXT, input, harness);
  const second = await addIeltsAssessment({}, CONTEXT, input, harness);

  assert.equal(first.assessment.id, second.assessment.id);
  assert.equal(harness.snapshot().data.assessments.length, 1);
});

test("Joy Actions publishes all IELTS teaching operations without destructive endpoints", () => {
  const paths = JOY_ACTIONS_OPENAPI.paths;
  const startOperation = paths["/api/joy/v1/ielts/tasks/{taskId}/start"]?.post;
  assert.equal(JOY_ACTIONS_OPENAPI.info.version, "1.4.0");
  assert.ok(paths["/api/joy/v1/ielts/today"]?.get);
  assert.ok(paths["/api/joy/v1/ielts/tasks/{taskId}"]?.get);
  assert.ok(startOperation);
  assert.equal(Object.hasOwn(startOperation, "requestBody"), false);
  assert.ok(paths["/api/joy/v1/ielts/tasks/{taskId}/complete"]?.post);
  assert.ok(paths["/api/joy/v1/ielts/assessments"]?.post);
  assert.ok(paths["/api/joy/v1/ielts/errors"]?.post);
  assert.ok(paths["/api/joy/v1/ielts/course-sessions"]?.post);
  assert.ok(paths["/api/joy/v1/ielts/rhythms/{rhythmId}/tasks"]?.put);
  assert.ok(paths["/api/joy/v1/ielts/listening/submissions"]?.post);
  assert.ok(paths["/api/joy/v1/ielts/listening/submissions/{submissionId}"]?.get);
  assert.ok(paths["/api/joy/v1/ielts/listening/submissions/{submissionId}/review"]?.post);
  const fileRefs = JOY_ACTIONS_OPENAPI.components.schemas
    .IeltsListeningSubmissionInput.properties.openaiFileIdRefs;
  assert.equal(fileRefs.type, "array");
  assert.equal(fileRefs.items.type, "string");
  assert.equal(Object.values(paths).some((methods) => Object.hasOwn(methods, "delete")), false);
});

test("every GPT Action operation description stays within the Builder limit", () => {
  for (const [path, methods] of Object.entries(JOY_ACTIONS_OPENAPI.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation || typeof operation !== "object" || !operation.operationId) continue;
      assert.ok(
        String(operation.description || "").length <= 300,
        `${method.toUpperCase()} ${path} (${operation.operationId}) exceeds 300 characters`,
      );
    }
  }
});

test("authenticated GPT Actions route delegates IELTS today reads to the bridge", async () => {
  let received = null;
  const ieltsService = {
    async getTeachingContext(env, context, input) {
      received = { env, context, input };
      return {
        planId: "ielts-band-7-december-2026",
        date: "2026-08-01",
        current: { id: "baseline", tasks: [] },
        activeErrors: [],
        recentCourseSessions: [],
        stateVersion: 0,
      };
    },
  };
  const response = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/ielts/today", {
      headers: { Authorization: "Bearer test" },
    }),
    {},
    {
      authenticate: async () => CONTEXT,
      ieltsService,
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.current.id, "baseline");
  assert.equal(received.context.actorId, "chatgpt-custom-gpt");
});

test("authenticated GPT Actions can start an IELTS task without a request body", async () => {
  let received = null;
  const ieltsService = {
    async startTask(env, context, taskId, input) {
      received = { env, context, taskId, input };
      return {
        ok: true,
        taskId,
        state: { status: "in_progress" },
        stateVersion: 1,
      };
    },
  };
  const response = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/ielts/tasks/baseline-listening/start", {
      method: "POST",
      headers: { Authorization: "Bearer test" },
    }),
    {},
    {
      authenticate: async () => CONTEXT,
      ieltsService,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(received.taskId, "baseline-listening");
  assert.deepEqual(received.input, {});
  assert.equal((await response.json()).state.status, "in_progress");
});
