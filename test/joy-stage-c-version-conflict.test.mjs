import assert from "node:assert/strict";
import test from "node:test";

import { handleJoyCoreWebRequest } from "../worker/joy-core-web.js";
import { JoyCoreError } from "../worker/joy-core/service.js";

const ORIGIN = "https://app.hey-joy.workers.dev";

function patchRequest(body) {
  return new Request(`${ORIGIN}/api/joy-core/v1/projects/turtlebot4`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
    },
    body: JSON.stringify(body),
  });
}

test("web project update retries once after compatibility promotion changes the version", async () => {
  const versions = [];
  const service = {
    async updateProject(_env, _context, projectId, body) {
      versions.push(body.baseVersion);
      if (versions.length === 1) {
        throw new JoyCoreError("JOY_PROJECT_VERSION_CONFLICT", 409, {
          current: {
            id: projectId,
            title: "TurtleBot4 Graduation Thesis",
            version: 1,
          },
        });
      }
      return {
        id: projectId,
        title: "TurtleBot4 Graduation Thesis",
        progress: body.progress,
        currentFocus: body.currentFocus,
        version: 2,
      };
    },
  };

  const response = await handleJoyCoreWebRequest(
    patchRequest({
      progress: 32,
      currentFocus: "Navigation benchmark",
      baseVersion: 0,
    }),
    {},
    {
      getSession: async () => ({ user_email: "owner@example.com" }),
      service,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(versions, [0, 1]);
  const project = await response.json();
  assert.equal(project.version, 2);
  assert.equal(project.progress, 32);
});

test("web project update does not loop when the retry also conflicts", async () => {
  let calls = 0;
  const service = {
    async updateProject() {
      calls += 1;
      throw new JoyCoreError("JOY_PROJECT_VERSION_CONFLICT", 409, {
        current: { id: "turtlebot4", version: calls },
      });
    },
  };

  const response = await handleJoyCoreWebRequest(
    patchRequest({ progress: 32, baseVersion: 0 }),
    {},
    {
      getSession: async () => ({ user_email: "owner@example.com" }),
      service,
    },
  );

  assert.equal(response.status, 409);
  assert.equal(calls, 2);
  assert.equal((await response.json()).error, "JOY_PROJECT_VERSION_CONFLICT");
});
