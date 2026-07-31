import assert from "node:assert/strict";
import test from "node:test";

import {
  IELTS_ACTIONS,
  canPerformIeltsAction,
} from "../worker/ielts-permissions.js";
import { handleJoyIeltsActionRequest } from "../worker/joy-actions-ielts.js";

const BASE_CONTEXT = {
  userEmail: "owner@example.com",
  actorType: "assistant",
  actorId: "chatgpt-custom-gpt",
};

function request(path, method = "GET", body = null) {
  const init = { method };
  if (body !== null) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request(`https://app.hey-joy.workers.dev${path}`, init);
}

test("IELTS roles keep reads available while viewer writes stay blocked", () => {
  assert.equal(canPerformIeltsAction("viewer", IELTS_ACTIONS.READ), true);
  assert.equal(canPerformIeltsAction("viewer", IELTS_ACTIONS.TASK_UPDATE), false);
  assert.equal(canPerformIeltsAction("assistant", IELTS_ACTIONS.TASK_UPDATE), true);
  assert.equal(canPerformIeltsAction("owner", IELTS_ACTIONS.PLAN_UPDATE), true);
});

test("IELTS optional scopes restrict actions instead of being ignored", () => {
  assert.equal(
    canPerformIeltsAction("assistant", IELTS_ACTIONS.READ, ["ielts:read"]),
    true,
  );
  assert.equal(
    canPerformIeltsAction("assistant", IELTS_ACTIONS.TASK_UPDATE, ["ielts:read"]),
    false,
  );
  assert.equal(
    canPerformIeltsAction("assistant", IELTS_ACTIONS.TASK_UPDATE, ["ielts:*"]),
    true,
  );
  assert.equal(
    canPerformIeltsAction("assistant", IELTS_ACTIONS.PLAN_UPDATE, ["*"]),
    true,
  );
});

test("viewer context can read IELTS teaching state", async () => {
  let calls = 0;
  const result = await handleJoyIeltsActionRequest(
    request("/api/joy/v1/ielts/today"),
    {},
    { ...BASE_CONTEXT, role: "viewer", scopes: null },
    {
      service: {
        async getTeachingContext() {
          calls += 1;
          return { current: { id: "baseline" } };
        },
      },
    },
  );

  assert.equal(result.status, 200);
  assert.equal(result.value.current.id, "baseline");
  assert.equal(calls, 1);
});

test("viewer context cannot start an IELTS task", async () => {
  let calls = 0;
  await assert.rejects(
    handleJoyIeltsActionRequest(
      request("/api/joy/v1/ielts/tasks/baseline-listening/start", "POST"),
      {},
      { ...BASE_CONTEXT, role: "viewer", scopes: null },
      {
        service: {
          async startTask() {
            calls += 1;
            return { ok: true };
          },
        },
      },
    ),
    (error) => error?.code === "IELTS_FORBIDDEN" && error?.status === 403,
  );
  assert.equal(calls, 0);
});

test("read-only assistant scope cannot write IELTS state", async () => {
  let calls = 0;
  await assert.rejects(
    handleJoyIeltsActionRequest(
      request("/api/joy/v1/ielts/tasks/baseline-listening/start", "POST"),
      {},
      { ...BASE_CONTEXT, role: "assistant", scopes: ["ielts:read"] },
      {
        service: {
          async startTask() {
            calls += 1;
            return { ok: true };
          },
        },
      },
    ),
    (error) => error?.code === "IELTS_FORBIDDEN"
      && error?.details?.action === IELTS_ACTIONS.TASK_UPDATE,
  );
  assert.equal(calls, 0);
});

test("task-update assistant scope can start an IELTS task", async () => {
  let received = null;
  const result = await handleJoyIeltsActionRequest(
    request("/api/joy/v1/ielts/tasks/baseline-listening/start", "POST"),
    {},
    {
      ...BASE_CONTEXT,
      role: "assistant",
      scopes: [IELTS_ACTIONS.TASK_UPDATE],
    },
    {
      service: {
        async startTask(_env, _context, taskId, input) {
          received = { taskId, input };
          return { ok: true, taskId };
        },
      },
    },
  );

  assert.equal(result.status, 200);
  assert.equal(received.taskId, "baseline-listening");
  assert.deepEqual(received.input, {});
});
