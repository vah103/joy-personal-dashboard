import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";
import {
  handleProjectMemoryRequest,
  isProjectMemoryRoute,
} from "./project-memory-http.js";
import {
  JoyCoreError,
  appendJoyProgressLog,
  attachJoyEvidence,
  createJoyMilestone,
  createJoyTask,
  getJoyOverview,
  getJoyProject,
  listJoyProjects,
  updateJoyMilestone,
  updateJoyProject,
  updateJoyTask,
} from "./joy-core/service.js";

const API_PREFIX = "/api/joy-core/v1";
const MAX_BODY_BYTES = 64_000;

const defaultService = {
  getOverview: getJoyOverview,
  listProjects: listJoyProjects,
  getProject: getJoyProject,
  updateProject: updateJoyProject,
  createTask: createJoyTask,
  updateTask: updateJoyTask,
  createMilestone: createJoyMilestone,
  updateMilestone: updateJoyMilestone,
  appendProgressLog: appendJoyProgressLog,
  attachEvidence: attachJoyEvidence,
};

export function isJoyCoreWebRoute(pathname) {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

function ownerContext(session) {
  const userEmail = String(session?.user_email || "").trim().toLowerCase();
  if (!userEmail) throw new JoyCoreError("JOY_WEB_AUTH_REQUIRED", 401);
  return {
    userEmail,
    role: "owner",
    scopes: null,
    actorType: "user",
    actorId: userEmail,
  };
}

function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new JoyCoreError("JOY_INVALID_PATH", 400);
  }
}

async function requestBody(request) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new JoyCoreError("JOY_CORE_BODY_TOO_LARGE", 413);
  }
  return readJson(request);
}

function apiJson(value, status = 200, headers = {}) {
  return json(value, status, {
    "X-Joy-Core-Version": "2",
    ...headers,
  });
}

function methodNotAllowed(allowed) {
  return apiJson({ error: "METHOD_NOT_ALLOWED" }, 405, {
    Allow: allowed.join(", "),
  });
}

function errorResponse(error) {
  const status = Number(error?.status || 500);
  const code = String(error?.code || (error instanceof TypeError
    ? "JOY_INVALID_INPUT"
    : "JOY_CORE_WEB_FAILED"));
  if (status >= 500) console.error("Joy Core web API failed", error);
  return apiJson({
    error: code,
    details: error?.details || null,
  }, status);
}

async function updateProjectWithConflictRetry(service, env, context, projectId, body) {
  try {
    return await service.updateProject(env, context, projectId, body);
  } catch (error) {
    const requestedVersion = Number(body?.baseVersion);
    const currentVersion = Number(error?.details?.current?.version);
    const canRetry = error?.code === "JOY_PROJECT_VERSION_CONFLICT"
      && Number.isFinite(requestedVersion)
      && Number.isFinite(currentVersion)
      && currentVersion > requestedVersion;
    if (!canRetry) throw error;
    return service.updateProject(env, context, projectId, {
      ...body,
      baseVersion: currentVersion,
    });
  }
}

export async function handleJoyCoreWebRequest(request, env, dependencies = {}) {
  const service = dependencies.service || defaultService;
  const readSession = dependencies.getSession || getSession;
  const url = new URL(request.url);
  const { pathname } = url;

  try {
    if (!isJoyCoreWebRoute(pathname)) return apiJson({ error: "NOT_FOUND" }, 404);

    const session = await readSession(request, env);
    if (!session) return apiJson({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "GET" && !isSameOrigin(request)) {
      return apiJson({ error: "INVALID_ORIGIN" }, 403);
    }

    const context = ownerContext(session);

    if (isProjectMemoryRoute(pathname, API_PREFIX)) {
      const result = await handleProjectMemoryRequest(request, env, context, {
        prefix: API_PREFIX,
        service: dependencies.projectMemoryService,
      });
      return apiJson(result.value, result.status);
    }

    if (pathname === `${API_PREFIX}/overview`) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson(await service.getOverview(env, context));
    }

    if (pathname === `${API_PREFIX}/projects`) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson({ projects: await service.listProjects(env, context) });
    }

    let match = pathname.match(/^\/api\/joy-core\/v1\/projects\/([^/]+)$/);
    if (match) {
      const projectId = decodePathPart(match[1]);
      if (request.method === "GET") {
        return apiJson(await service.getProject(env, context, projectId));
      }
      if (request.method === "PATCH") {
        const body = await requestBody(request);
        return apiJson(await updateProjectWithConflictRetry(
          service,
          env,
          context,
          projectId,
          body,
        ));
      }
      return methodNotAllowed(["GET", "PATCH"]);
    }

    match = pathname.match(/^\/api\/joy-core\/v1\/projects\/([^/]+)\/tasks$/);
    if (match) {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      const result = await service.createTask(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      );
      return apiJson(result, result.deduplicated ? 200 : 201);
    }

    match = pathname.match(/^\/api\/joy-core\/v1\/tasks\/([^/]+)$/);
    if (match) {
      if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
      return apiJson(await service.updateTask(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      ));
    }

    match = pathname.match(/^\/api\/joy-core\/v1\/projects\/([^/]+)\/milestones$/);
    if (match) {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      const result = await service.createMilestone(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      );
      return apiJson(result, result.deduplicated ? 200 : 201);
    }

    match = pathname.match(/^\/api\/joy-core\/v1\/milestones\/([^/]+)$/);
    if (match) {
      if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
      return apiJson(await service.updateMilestone(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      ));
    }

    match = pathname.match(/^\/api\/joy-core\/v1\/projects\/([^/]+)\/logs$/);
    if (match) {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      const result = await service.appendProgressLog(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      );
      return apiJson(result, result.deduplicated ? 200 : 201);
    }

    match = pathname.match(/^\/api\/joy-core\/v1\/projects\/([^/]+)\/evidence$/);
    if (match) {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      const result = await service.attachEvidence(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      );
      return apiJson(result, result.deduplicated ? 200 : 201);
    }

    return apiJson({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
