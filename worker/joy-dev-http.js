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

function method(method, allowed) {
  if (allowed.includes(method)) return;
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
    return {
      status: 200,
      value: await service.getRepositoryContext(env, context, queryInput(url)),
    };
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
    const value = await service.createWorkBranch(env, context, await readBody(request));
    return { status: value.deduplicated ? 200 : 201, value };
  }

  if (path === `${prefix}/dev/changes`) {
    method(request.method, ["POST"]);
    return {
      status: 201,
      value: await service.applyRepositoryChanges(env, context, await readBody(request)),
    };
  }

  if (path === `${prefix}/dev/checks`) {
    if (request.method === "GET") {
      return {
        status: 200,
        value: await service.getRepositoryCheck(env, context, queryInput(url)),
      };
    }
    method(request.method, ["GET", "POST"]);
    return {
      status: 202,
      value: await service.runRepositoryChecks(env, context, await readBody(request)),
    };
  }

  if (path === `${prefix}/dev/pull-requests`) {
    method(request.method, ["POST"]);
    const value = await service.openPullRequest(env, context, await readBody(request));
    return { status: value.deduplicated ? 200 : 201, value };
  }

  throw new JoyCoreError("NOT_FOUND", 404);
}

export const JOY_DEV_HTTP_LIMITS = Object.freeze({
  maxBodyBytes: MAX_BODY_BYTES,
  prefix: DEV_PREFIX,
});
