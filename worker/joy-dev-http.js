import { JoyCoreError } from "./joy-core/service.js";
import {
  applyJoyRepositoryChanges,
  createJoyWorkBranch,
  getJoyRepositoryCheck,
  getJoyRepositoryContext,
  openJoyPullRequest,
  readJoyRepositoryFile,
  runJoyRepositoryChecks,
  searchJoyRepository,
} from "./joy-dev-bridge.js";

const DEFAULT_PREFIX = "/api/joy/v1";
const DEV_PREFIX = `${DEFAULT_PREFIX}/dev`;
const MAX_BODY_BYTES = 900_000;

const defaultService = {
  getRepositoryContext: getJoyRepositoryContext,
  searchRepository: searchJoyRepository,
  readRepositoryFile: readJoyRepositoryFile,
  createWorkBranch: createJoyWorkBranch,
  applyRepositoryChanges: applyJoyRepositoryChanges,
  runRepositoryChecks: runJoyRepositoryChecks,
  getRepositoryCheck: getJoyRepositoryCheck,
  openPullRequest: openJoyPullRequest,
};

function method(methodName, allowed) {
  if (allowed.includes(methodName)) return;
  throw new JoyCoreError("METHOD_NOT_ALLOWED", 405, { allowed });
}

async function readBody(request) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new JoyCoreError("JOY_DEV_BODY_TOO_LARGE", 413, { maxBytes: MAX_BODY_BYTES });
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new JoyCoreError("JOY_DEV_BODY_TOO_LARGE", 413, { maxBytes: MAX_BODY_BYTES });
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new JoyCoreError("JOY_DEV_INVALID_JSON", 400);
  }
}

function queryInput(url) {
  return Object.fromEntries(url.searchParams.entries());
}

function allowedProjects(context) {
  if (!Array.isArray(context?.allowedProjectIds) || context.allowedProjectIds.length === 0) {
    return null;
  }
  return new Set(context.allowedProjectIds.map((value) => String(value).trim().toLowerCase()));
}

function assertProjectAccess(context, projectId) {
  const allowed = allowedProjects(context);
  if (!allowed) return String(projectId || "").trim().toLowerCase();
  const normalized = String(projectId || "").trim().toLowerCase();
  if (!allowed.has(normalized)) {
    throw new JoyCoreError("JOY_PROJECT_SCOPE_FORBIDDEN", 403, {
      projectId: normalized,
      allowedProjectIds: [...allowed],
      profileId: context?.profileId || null,
    });
  }
  return normalized;
}

function assertBranchAccess(context, branch) {
  const allowed = allowedProjects(context);
  if (!allowed || !branch) return;
  const normalized = String(branch).trim().toLowerCase();
  if (![...allowed].some((projectId) => normalized.startsWith(`joy/${projectId}/`))) {
    throw new JoyCoreError("JOY_DEV_BRANCH_PROJECT_MISMATCH", 403, {
      branch,
      allowedProjectIds: [...allowed],
    });
  }
}

function assertWritePathAccess(context, projectId, path) {
  assertProjectAccess(context, projectId);
  const profile = String(context?.repositoryWriteProfile || "").toLowerCase();
  if (!profile) return;
  const normalized = String(path || "").replace(/^\/+/, "").toLowerCase();
  if (normalized.startsWith("project-data/")
    && !normalized.startsWith(`project-data/${projectId}/`)) {
    throw new JoyCoreError("JOY_DEV_PROJECT_PATH_FORBIDDEN", 403, {
      path,
      projectId,
      reason: "A specialized GPT may write only its own project-data directory.",
    });
  }
  const foreignMarkers = profile === "ielts"
    ? ["turtlebot"]
    : profile === "turtlebot4"
      ? ["ielts"]
      : [];
  if (foreignMarkers.some((marker) => normalized.includes(marker))) {
    throw new JoyCoreError("JOY_DEV_PROJECT_PATH_FORBIDDEN", 403, {
      path,
      projectId,
      profileId: context?.profileId || null,
    });
  }
}

function scopedRepositoryContext(context, value) {
  const allowed = allowedProjects(context);
  if (!allowed) return value;
  return {
    ...value,
    openPullRequests: (value?.openPullRequests || []).filter((pull) => {
      const branch = String(pull?.headBranch || "").toLowerCase();
      return [...allowed].some((projectId) => branch.startsWith(`joy/${projectId}/`));
    }),
    policy: {
      ...(value?.policy || {}),
      allowedProjectIds: [...allowed],
      repositoryWriteProfile: context?.repositoryWriteProfile || null,
    },
  };
}

function validateCheckSuite(context, projectId, suite) {
  if (!allowedProjects(context)) return;
  const normalizedSuite = String(suite || "full").toLowerCase();
  if (normalizedSuite !== "full" && normalizedSuite !== projectId) {
    throw new JoyCoreError("JOY_DEV_CHECK_SUITE_FORBIDDEN", 403, {
      projectId,
      suite: normalizedSuite,
    });
  }
}

export function isJoyDevRoute(pathname, prefix = DEFAULT_PREFIX) {
  return pathname === `${prefix}/dev/repository`
    || pathname === `${prefix}/dev/search`
    || pathname === `${prefix}/dev/files`
    || pathname === `${prefix}/dev/branches`
    || pathname === `${prefix}/dev/changes`
    || pathname === `${prefix}/dev/checks`
    || pathname === `${prefix}/dev/pull-requests`;
}

export async function handleJoyDevRequest(
  request,
  env,
  context,
  options = {},
) {
  const prefix = options.prefix || DEFAULT_PREFIX;
  const service = options.service || defaultService;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === `${prefix}/dev/repository`) {
    method(request.method, ["GET"]);
    const value = await service.getRepositoryContext(env, context, queryInput(url));
    return { status: 200, value: scopedRepositoryContext(context, value) };
  }

  if (path === `${prefix}/dev/search`) {
    method(request.method, ["GET"]);
    return {
      status: 200,
      value: await service.searchRepository(env, context, queryInput(url)),
    };
  }

  if (path === `${prefix}/dev/files`) {
    method(request.method, ["GET"]);
    return {
      status: 200,
      value: await service.readRepositoryFile(env, context, queryInput(url)),
    };
  }

  if (path === `${prefix}/dev/branches`) {
    method(request.method, ["POST"]);
    const input = await readBody(request);
    assertProjectAccess(context, input.projectId);
    const value = await service.createWorkBranch(env, context, input);
    assertBranchAccess(context, value.branch);
    return { status: value.deduplicated ? 200 : 201, value };
  }

  if (path === `${prefix}/dev/changes`) {
    method(request.method, ["POST"]);
    const input = await readBody(request);
    const projectId = assertProjectAccess(context, input.projectId);
    assertBranchAccess(context, input.branch);
    for (const change of input.changes || []) {
      assertWritePathAccess(context, projectId, change?.path);
    }
    return {
      status: 201,
      value: await service.applyRepositoryChanges(env, context, input),
    };
  }

  if (path === `${prefix}/dev/checks`) {
    if (request.method === "GET") {
      const input = queryInput(url);
      if (input.branch) assertBranchAccess(context, input.branch);
      const value = await service.getRepositoryCheck(env, context, input);
      if (value?.run?.branch) assertBranchAccess(context, value.run.branch);
      return { status: 200, value };
    }
    method(request.method, ["GET", "POST"]);
    const input = await readBody(request);
    const projectId = assertProjectAccess(context, input.projectId);
    assertBranchAccess(context, input.branch);
    validateCheckSuite(context, projectId, input.suite);
    return {
      status: 202,
      value: await service.runRepositoryChecks(env, context, input),
    };
  }

  if (path === `${prefix}/dev/pull-requests`) {
    method(request.method, ["POST"]);
    const input = await readBody(request);
    assertProjectAccess(context, input.projectId);
    assertBranchAccess(context, input.branch);
    const value = await service.openPullRequest(env, context, input);
    if (value?.pullRequest?.headBranch) assertBranchAccess(context, value.pullRequest.headBranch);
    return { status: value.deduplicated ? 200 : 201, value };
  }

  throw new JoyCoreError("NOT_FOUND", 404);
}

export const JOY_DEV_HTTP_LIMITS = Object.freeze({
  maxBodyBytes: MAX_BODY_BYTES,
  prefix: DEV_PREFIX,
});
