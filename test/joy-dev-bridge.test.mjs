import assert from "node:assert/strict";
import test from "node:test";

import { JOY_ACTIONS_OPENAPI } from "../worker/joy-actions-openapi-extended.js";
import { handleJoyActionsRequest } from "../worker/joy-actions.js";
import {
  applyJoyRepositoryChanges,
  createJoyWorkBranch,
  describeJoyDevPolicy,
  getJoyRepositoryContext,
  readJoyRepositoryFile,
  searchJoyRepository,
} from "../worker/joy-dev-bridge.js";
import {
  JOY_CORE_ACTIONS,
  canPerformJoyCoreAction,
} from "../worker/joy-core/permissions.js";

const ENV = {
  JOY_GITHUB_TOKEN: "github-test-token",
  JOY_DEV_REPOSITORIES: "vah103/joy-personal-dashboard",
};
const CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: null,
  actorType: "assistant",
  actorId: "gpt-ielts",
};

function response(status, body = null) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: body === null ? {} : { "Content-Type": "application/json" },
  });
}

test("Joy Dev policy protects main, infrastructure, secrets, and bridge security", async () => {
  const policy = describeJoyDevPolicy(ENV);
  assert.equal(policy.defaultBranch, "main");
  assert.equal(policy.prohibitedOperations.includes("merge pull requests"), true);
  assert.equal(policy.protectedPaths.includes("migrations/"), true);
  assert.equal(policy.protectedPaths.includes("worker/joy-dev-bridge.js"), true);

  await assert.rejects(
    applyJoyRepositoryChanges(ENV, CONTEXT, {
      projectId: "ielts",
      branch: "main",
      expectedHeadSha: "abc1234",
      commitMessage: "Unsafe main write",
      changes: [{ path: "src/features/ielts/test.js", operation: "upsert", content: "ok" }],
      clientRequestId: "unsafe-main",
    }, { fetch: async () => { throw new Error("network must not be called"); } }),
    (error) => error.code === "JOY_DEV_PROTECTED_BRANCH",
  );

  await assert.rejects(
    applyJoyRepositoryChanges(ENV, CONTEXT, {
      projectId: "ielts",
      branch: "joy/ielts/safe-change-123",
      expectedHeadSha: "abc1234",
      commitMessage: "Unsafe migration write",
      changes: [{ path: "migrations/unsafe.sql", operation: "upsert", content: "DROP TABLE x;" }],
      clientRequestId: "unsafe-migration",
    }, { fetch: async () => { throw new Error("network must not be called"); } }),
    (error) => error.code === "JOY_DEV_PATH_NOT_WRITABLE" || error.code === "JOY_DEV_PROTECTED_PATH",
  );
});

test("assistant can develop on branches while viewer stays read-only", () => {
  assert.equal(canPerformJoyCoreAction("viewer", JOY_CORE_ACTIONS.REPOSITORY_READ), true);
  assert.equal(canPerformJoyCoreAction("viewer", JOY_CORE_ACTIONS.REPOSITORY_WRITE), false);
  assert.equal(canPerformJoyCoreAction("assistant", JOY_CORE_ACTIONS.REPOSITORY_BRANCH_CREATE), true);
  assert.equal(canPerformJoyCoreAction("assistant", JOY_CORE_ACTIONS.REPOSITORY_WRITE), true);
  assert.equal(canPerformJoyCoreAction("assistant", JOY_CORE_ACTIONS.REPOSITORY_CHECK_RUN), true);
  assert.equal(canPerformJoyCoreAction("assistant", JOY_CORE_ACTIONS.REPOSITORY_PR_CREATE), true);
});

test("repository context, search, and file reads send the required GitHub REST headers", async () => {
  const calls = [];
  const fetchMock = async (url, init = {}) => {
    calls.push({ url, headers: new Headers(init.headers) });
    if (url.endsWith("/repos/vah103/joy-personal-dashboard")) {
      return response(200, {
        default_branch: "main",
        private: true,
        html_url: "https://github.com/vah103/joy-personal-dashboard",
      });
    }
    if (url.endsWith("/git/ref/heads/main")) {
      return response(200, { object: { sha: "main-sha" } });
    }
    if (url.includes("/pulls?")) return response(200, []);
    if (url.includes("/search/code?")) {
      return response(200, { total_count: 1, items: [{ path: "worker/joy-dev-bridge.js" }] });
    }
    if (url.includes("/contents/worker/joy-dev-bridge.js?")) {
      return response(200, {
        type: "file",
        size: 12,
        sha: "file-sha",
        encoding: "base64",
        content: btoa("export {};\n"),
      });
    }
    throw new Error(`Unexpected request: ${init.method || "GET"} ${url}`);
  };
  const options = { fetch: fetchMock };

  await getJoyRepositoryContext(ENV, CONTEXT, {}, options);
  await searchJoyRepository(ENV, CONTEXT, { query: "githubRequest" }, options);
  await readJoyRepositoryFile(ENV, CONTEXT, { path: "worker/joy-dev-bridge.js" }, options);

  assert.equal(calls.length, 5);
  for (const call of calls) {
    assert.equal(call.headers.get("User-Agent"), "Joy-Personal-Dashboard/1.0", call.url);
    assert.equal(call.headers.get("Authorization"), "Bearer github-test-token", call.url);
    assert.equal(call.headers.get("Accept"), "application/vnd.github+json", call.url);
    assert.equal(call.headers.get("X-GitHub-Api-Version"), "2022-11-28", call.url);
  }
});

test("createJoyWorkBranch creates a deterministic branch from current main", async () => {
  const calls = [];
  const fetchMock = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    if (url.includes("/git/ref/heads/joy/ielts/")) return response(404, { message: "Not Found" });
    if (url.endsWith("/git/ref/heads/main")) return response(200, { object: { sha: "main-sha" } });
    if (url.endsWith("/git/refs") && init.method === "POST") {
      const body = JSON.parse(init.body);
      return response(201, { ref: body.ref, object: { sha: body.sha } });
    }
    throw new Error(`Unexpected request: ${init.method || "GET"} ${url}`);
  };

  const result = await createJoyWorkBranch(ENV, CONTEXT, {
    projectId: "ielts",
    slug: "writing-ui",
    clientRequestId: "session-20260801-writing-ui",
  }, { fetch: fetchMock });

  assert.match(result.branch, /^joy\/ielts\/writing-ui-/);
  assert.equal(result.headSha, "main-sha");
  assert.equal(result.baseBranch, "main");
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(calls.at(-1).body.ref, `refs/heads/${result.branch}`);
});

test("applyJoyRepositoryChanges creates one atomic commit and advances only the work branch", async () => {
  const calls = [];
  let blobCounter = 0;
  const fetchMock = async (url, init = {}) => {
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });
    if (url.includes("/git/ref/heads/joy/ielts/writing-ui-abc123")) {
      return response(200, { object: { sha: "head-before" } });
    }
    if (url.endsWith("/git/commits/head-before")) {
      return response(200, { sha: "head-before", tree: { sha: "tree-before" } });
    }
    if (url.endsWith("/git/blobs") && method === "POST") {
      blobCounter += 1;
      return response(201, { sha: `blob-${blobCounter}` });
    }
    if (url.endsWith("/git/trees") && method === "POST") {
      return response(201, { sha: "tree-after" });
    }
    if (url.endsWith("/git/commits") && method === "POST") {
      return response(201, { sha: "commit-after" });
    }
    if (url.includes("/git/refs/heads/joy/ielts/writing-ui-abc123") && method === "PATCH") {
      return response(200, { object: { sha: body.sha } });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const result = await applyJoyRepositoryChanges(ENV, CONTEXT, {
    projectId: "ielts",
    branch: "joy/ielts/writing-ui-abc123",
    expectedHeadSha: "head-before",
    commitMessage: "Refine IELTS Writing task layout",
    changes: [
      { path: "src/features/ielts/writing-card.js", operation: "upsert", content: "export const card = true;\n" },
      { path: "test/ielts-writing-card.test.mjs", operation: "upsert", content: "// regression\n" },
    ],
    clientRequestId: "writing-ui-commit-1",
  }, { fetch: fetchMock });

  assert.equal(result.previousHeadSha, "head-before");
  assert.equal(result.headSha, "commit-after");
  assert.equal(result.changes.length, 2);
  assert.equal(calls.filter((call) => call.url.endsWith("/git/commits") && call.method === "POST").length, 1);
  const treeCall = calls.find((call) => call.url.endsWith("/git/trees") && call.method === "POST");
  assert.equal(treeCall.body.base_tree, "tree-before");
  assert.equal(treeCall.body.tree.length, 2);
  const refCall = calls.find((call) => call.method === "PATCH");
  assert.equal(refCall.body.force, false);
  assert.equal(refCall.body.sha, "commit-after");
  assert.equal(refCall.url.includes("refs/heads/main"), false);
});

test("stale branch heads are rejected before creating blobs or commits", async () => {
  let requests = 0;
  const fetchMock = async (url) => {
    requests += 1;
    if (url.includes("/git/ref/heads/joy/turtlebot4/navigation-fix-abc")) {
      return response(200, { object: { sha: "newer-head" } });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  await assert.rejects(
    applyJoyRepositoryChanges(ENV, CONTEXT, {
      projectId: "turtlebot4",
      branch: "joy/turtlebot4/navigation-fix-abc",
      expectedHeadSha: "stale-head",
      commitMessage: "Fix navigation",
      changes: [{ path: "src/features/turtlebot4/navigation.js", operation: "upsert", content: "export {};\n" }],
      clientRequestId: "navigation-fix-stale",
    }, { fetch: fetchMock }),
    (error) => error.code === "JOY_DEV_BRANCH_HEAD_CONFLICT" && error.details.currentHeadSha === "newer-head",
  );
  assert.equal(requests, 1);
});

test("GPT Actions publishes the complete Dev Bridge without merge or deploy operations", () => {
  assert.equal(JOY_ACTIONS_OPENAPI.info.version, "1.4.0");
  const operations = Object.values(JOY_ACTIONS_OPENAPI.paths)
    .flatMap((methods) => Object.values(methods))
    .filter((operation) => operation && typeof operation === "object" && operation.operationId);
  const operationIds = operations.map((operation) => operation.operationId);
  for (const operationId of [
    "getJoyRepositoryContext",
    "searchJoyRepository",
    "readJoyRepositoryFile",
    "createJoyWorkBranch",
    "applyJoyRepositoryChanges",
    "runJoyRepositoryChecks",
    "getJoyRepositoryCheck",
    "openJoyPullRequest",
  ]) {
    assert.equal(operationIds.includes(operationId), true, operationId);
  }
  assert.equal(operationIds.some((id) => /merge|deploy|secret/i.test(id)), false);
  for (const operation of operations) {
    assert.ok(String(operation.description || "").length <= 300, operation.operationId);
  }
});

test("authenticated Joy Actions delegates repository context reads to Dev Bridge", async () => {
  let received = null;
  const responseValue = {
    repository: "vah103/joy-personal-dashboard",
    defaultBranch: "main",
    mainHeadSha: "abc",
    openPullRequests: [],
    policy: {},
  };
  const responseObject = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/dev/repository?repository=vah103%2Fjoy-personal-dashboard", {
      headers: { Authorization: "Bearer test" },
    }),
    {},
    {
      authenticate: async () => CONTEXT,
      joyDevService: {
        async getRepositoryContext(env, context, input) {
          received = { env, context, input };
          return responseValue;
        },
      },
    },
  );

  assert.equal(responseObject.status, 200);
  assert.equal((await responseObject.json()).mainHeadSha, "abc");
  assert.equal(received.input.repository, "vah103/joy-personal-dashboard");
  assert.equal(received.context.actorId, "gpt-ielts");
});
