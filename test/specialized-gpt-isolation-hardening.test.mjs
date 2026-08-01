import assert from "node:assert/strict";
import test from "node:test";

import { handleJoyDevRequest } from "../worker/joy-dev-http.js";
import { handleProjectMemoryRequest } from "../worker/project-memory-http.js";

const IELTS_CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: [
    "workspace:read",
    "workspace:update",
    "session:create",
    "session:update",
    "memory:create",
    "repository:read",
    "repository:write",
  ],
  actorType: "assistant",
  actorId: "gpt-ielts",
  profileId: "ielts",
  allowedProjectIds: ["ielts"],
  repositoryWriteProfile: "ielts",
};

test("specialized GPTs can read main and shared repository refs", async () => {
  let received = null;
  const result = await handleJoyDevRequest(
    new Request(
      "https://app.hey-joy.workers.dev/api/joy/v1/dev/files?path=src/shared/project-card.js&ref=main",
    ),
    {},
    IELTS_CONTEXT,
    {
      service: {
        async readRepositoryFile(_env, _context, input) {
          received = input;
          return {
            path: input.path,
            ref: input.ref,
            content: "export const shared = true;",
          };
        },
      },
    },
  );

  assert.equal(result.status, 200);
  assert.equal(received.ref, "main");
  assert.equal(received.path, "src/shared/project-card.js");
});

test("an IELTS GPT cannot start a TurtleBot4 work session", async () => {
  let called = false;
  await assert.rejects(
    handleProjectMemoryRequest(
      new Request("https://app.hey-joy.workers.dev/api/joy/v1/workspaces/turtlebot4/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Wrong project session",
          goal: "Must never start",
          clientRequestId: "wrong-project-session",
        }),
      }),
      {},
      IELTS_CONTEXT,
      {
        service: {
          async startWorkSession() {
            called = true;
            return {};
          },
        },
      },
    ),
    (error) => error.code === "JOY_PROJECT_SCOPE_FORBIDDEN" && error.status === 403,
  );
  assert.equal(called, false);
});

test("specialized GPTs cannot modify project-memory isolation files", async () => {
  let called = false;
  await assert.rejects(
    handleJoyDevRequest(
      new Request("https://app.hey-joy.workers.dev/api/joy/v1/dev/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "ielts",
          branch: "joy/ielts/security-test-123",
          changes: [{
            path: "worker/project-memory-http.js",
            operation: "upsert",
            content: "export const unsafe = true;",
          }],
        }),
      }),
      {},
      IELTS_CONTEXT,
      {
        service: {
          async applyRepositoryChanges() {
            called = true;
            return {};
          },
        },
      },
    ),
    (error) => error.code === "JOY_DEV_PROTECTED_PATH" && error.status === 403,
  );
  assert.equal(called, false);
});
