import { json, readJson } from "./shared/http.js";
import {
  JOY_ACTIONS_OPENAPI,
  JOY_IELTS_ACTIONS_OPENAPI,
  JOY_TURTLEBOT4_ACTIONS_OPENAPI,
} from "./joy-actions-openapi-extended.js";
import {
  handleJoyIeltsActionRequest,
  isJoyIeltsActionRoute,
} from "./joy-actions-ielts.js";
import {
  handleProjectMemoryRequest,
  isProjectMemoryRoute,
} from "./project-memory-http.js";
import { getWorkSession } from "./project-memory/repository.js";
import {
  handleJoyDevRequest,
  isJoyDevRoute,
} from "./joy-dev-http.js";
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

const API_PREFIX = "/api/joy/v1";
const OPENAPI_PATH = `${API_PREFIX}/openapi.json`;
const IELTS_OPENAPI_PATH = `${API_PREFIX}/openapi/ielts.json`;
const TURTLEBOT4_OPENAPI_PATH = `${API_PREFIX}/openapi/turtlebot4.json`;
const PRIVACY_PATH = `${API_PREFIX}/privacy`;
const HEALTH_PATH = `${API_PREFIX}/health`;
const MAX_BODY_BYTES = 64_000;

const DEVELOPER_SCOPES = Object.freeze([
  "project:read",
  "project:update",
  "task:read",
  "task:create",
  "task:update",
  "milestone:read",
  "milestone:create",
  "milestone:update",
  "log:read",
  "log:create",
  "evidence:read",
  "evidence:create",
  "workspace:read",
  "workspace:update",
  "session:create",
  "session:update",
  "memory:create",
  "repository:read",
  "repository:branch:create",
  "repository:write",
  "repository:checks:run",
  "repository:pr:create",
]);

const ACTION_PROFILES = Object.freeze([
  Object.freeze({
    id: "ielts",
    keyEnv: "JOY_IELTS_GPT_ACTION_KEY",
    scopesEnv: "JOY_IELTS_GPT_ACTION_SCOPES",
    actorId: "gpt-ielts",
    allowedProjectIds: Object.freeze(["ielts"]),
    repositoryWriteProfile: "ielts",
    defaultScopes: Object.freeze([...DEVELOPER_SCOPES, "ielts:*"]),
  }),
  Object.freeze({
    id: "turtlebot4",
    keyEnv: "JOY_TURTLEBOT4_GPT_ACTION_KEY",
    scopesEnv: "JOY_TURTLEBOT4_GPT_ACTION_SCOPES",
    actorId: "gpt-turtlebot4",
    allowedProjectIds: Object.freeze(["turtlebot4"]),
    repositoryWriteProfile: "turtlebot4",
    defaultScopes: DEVELOPER_SCOPES,
  }),
  Object.freeze({
    id: "legacy",
    keyEnv: "JOY_GPT_ACTION_KEY",
    scopesEnv: "JOY_GPT_ACTION_SCOPES",
    actorId: "chatgpt-custom-gpt",
    allowedProjectIds: null,
    repositoryWriteProfile: null,
    defaultScopes: null,
  }),
]);

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

function apiJson(value, status = 200, headers = {}) {
  return json(value, status, {
    "X-Robots-Tag": "noindex, nofollow",
    "X-Joy-API-Version": "1",
    ...headers,
  });
}

function privacyResponse() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Joy Actions Privacy</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.65;color:#20262b}
    h1,h2{line-height:1.25} code{background:#f1f3f5;padding:2px 5px;border-radius:4px}
  </style>
</head>
<body>
  <h1>Joy Actions Privacy</h1>
  <p>Joy Actions is a private integration for the owner of the Joy Personal Dashboard.</p>
  <h2>Data used</h2>
  <p>When the owner invokes an action, Joy may return or update project, task, milestone, progress-log, evidence-reference, work-session, project-memory, IELTS learning, repository source, branch, commit, pull-request, and workflow-check data.</p>
  <h2>Specialized GPT identities</h2>
  <p>IELTS and TurtleBot4 GPT credentials are mapped server-side to separate actor identities and project allowlists. A specialized credential cannot update the other project's state or project-specific source files.</p>
  <h2>Sharing</h2>
  <p>Action request and response data is sent to ChatGPT to complete the owner's request. Repository operations are sent to GitHub through the owner's private server-side credential. Joy does not sell this data or expose it through unauthenticated project, memory, IELTS, or development endpoints.</p>
  <h2>Security and retention</h2>
  <p>Requests require a private bearer key. Project and memory writes are audited. Development Actions can read allowed repositories and write only protected work branches; they cannot write main, merge, deploy, modify secrets, migrations, workflows, dependencies, or Dev Bridge security files.</p>
  <h2>Contact</h2>
  <p>This integration is maintained privately through the Joy Personal Dashboard repository.</p>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function bearerToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(value)),
  ));
}

async function constantTimeEqual(left, right) {
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % a.length] || 0) ^ (b[index % b.length] || 0);
  }
  return difference === 0;
}

function scopesFromValue(value) {
  const scopes = String(value || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes.length ? scopes : null;
}

function configuredProfiles(env) {
  return ACTION_PROFILES
    .map((profile) => ({
      ...profile,
      key: String(env?.[profile.keyEnv] || "").trim(),
    }))
    .filter((profile) => profile.key);
}

function profileScopes(env, profile) {
  const configured = scopesFromValue(env?.[profile.scopesEnv]);
  if (configured) return configured;
  return profile.defaultScopes ? [...profile.defaultScopes] : null;
}

export async function authenticateJoyActions(request, env) {
  const userEmail = String(env?.JOY_OWNER_EMAIL || "").trim().toLowerCase();
  const profiles = configuredProfiles(env);
  if (!userEmail || profiles.length === 0) {
    throw new JoyCoreError("JOY_ACTIONS_NOT_CONFIGURED", 503);
  }
  const suppliedKey = bearerToken(request);
  if (!suppliedKey) {
    throw new JoyCoreError("JOY_ACTIONS_AUTH_REQUIRED", 401);
  }
  const matched = [];
  for (const profile of profiles) {
    if (await constantTimeEqual(suppliedKey, profile.key)) matched.push(profile);
  }
  if (matched.length === 0) {
    throw new JoyCoreError("JOY_ACTIONS_AUTH_INVALID", 403);
  }
  if (matched.length > 1) {
    throw new JoyCoreError("JOY_ACTIONS_AUTH_AMBIGUOUS", 503, {
      reason: "Each GPT profile must use a unique bearer key.",
    });
  }
  const profile = matched[0];
  return {
    userEmail,
    role: "assistant",
    scopes: profileScopes(env, profile),
    actorType: "assistant",
    actorId: profile.actorId,
    profileId: profile.id,
    allowedProjectIds: profile.allowedProjectIds ? [...profile.allowedProjectIds] : null,
    repositoryWriteProfile: profile.repositoryWriteProfile,
  };
}

function allowedProjectIds(context) {
  if (!Array.isArray(context?.allowedProjectIds) || context.allowedProjectIds.length === 0) {
    return null;
  }
  return new Set(context.allowedProjectIds.map((value) => String(value).trim().toLowerCase()));
}

function assertProjectAllowed(context, projectId) {
  const allowed = allowedProjectIds(context);
  if (!allowed) return;
  const normalized = String(projectId || "").trim().toLowerCase();
  if (!allowed.has(normalized)) {
    throw new JoyCoreError("JOY_PROJECT_SCOPE_FORBIDDEN", 403, {
      projectId: normalized,
      allowedProjectIds: [...allowed],
      profileId: context?.profileId || null,
    });
  }
}

function filterProjectRecords(context, records, field = "projectId") {
  const allowed = allowedProjectIds(context);
  if (!allowed) return records || [];
  return (records || []).filter((record) => allowed.has(String(record?.[field] || "").toLowerCase()));
}

function filterOverview(context, overview) {
  if (!allowedProjectIds(context)) return overview;
  return {
    ...overview,
    projects: filterProjectRecords(context, overview?.projects, "id"),
    openTasks: filterProjectRecords(context, overview?.openTasks),
    inboxTasks: [],
    recentLogs: filterProjectRecords(context, overview?.recentLogs),
  };
}

async function assertEntityAllowed(service, env, context, entityType, entityId) {
  const allowed = allowedProjectIds(context);
  if (!allowed) return;
  const collection = entityType === "task" ? "tasks" : "milestones";
  for (const projectId of allowed) {
    const detail = await service.getProject(env, context, projectId);
    if ((detail?.[collection] || []).some((item) => item.id === entityId)) return;
  }
  throw new JoyCoreError("JOY_PROJECT_SCOPE_FORBIDDEN", 403, {
    entityType,
    entityId,
    allowedProjectIds: [...allowed],
  });
}

async function assertProjectMemoryAccess(pathname, env, context) {
  if (!allowedProjectIds(context)) return;
  let match = pathname.match(/^\/api\/joy\/v1\/workspaces\/([^/]+)$/);
  if (match) {
    assertProjectAllowed(context, decodePathPart(match[1]));
    return;
  }
  match = pathname.match(/^\/api\/joy\/v1\/work-sessions\/([^/]+)\/events$/)
    || pathname.match(/^\/api\/joy\/v1\/work-sessions\/([^/]+)\/finish$/);
  if (!match) return;
  if (!env?.DB) throw new JoyCoreError("JOY_CORE_DATABASE_UNAVAILABLE", 503);
  const sessionId = decodePathPart(match[1]);
  const session = await getWorkSession(env.DB, context.userEmail, sessionId);
  if (session) assertProjectAllowed(context, session.projectId);
}

export function isJoyActionsRoute(pathname) {
  return pathname === OPENAPI_PATH
    || pathname === IELTS_OPENAPI_PATH
    || pathname === TURTLEBOT4_OPENAPI_PATH
    || pathname === PRIVACY_PATH
    || pathname === HEALTH_PATH
    || pathname.startsWith(`${API_PREFIX}/`);
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
    throw new JoyCoreError("JOY_ACTION_BODY_TOO_LARGE", 413);
  }
  return readJson(request);
}

function errorResponse(error) {
  const status = Number(error?.status || 500);
  const code = String(error?.code || (error instanceof TypeError
    ? "JOY_INVALID_INPUT"
    : "JOY_ACTION_FAILED"));
  if (status >= 500) console.error("Joy Actions failed", error);
  const headers = status === 401
    ? { "WWW-Authenticate": "Bearer realm=\"Joy Actions\"" }
    : {};
  return apiJson({
    error: code,
    details: error?.details || null,
  }, status, headers);
}

function methodNotAllowed(allowed) {
  return apiJson({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: allowed.join(", ") });
}

export async function handleJoyActionsRequest(request, env, dependencies = {}) {
  const service = dependencies.service || defaultService;
  const url = new URL(request.url);
  const { pathname } = url;

  try {
    if (pathname === OPENAPI_PATH) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson(JOY_ACTIONS_OPENAPI, 200, { "Cache-Control": "public, max-age=300" });
    }
    if (pathname === IELTS_OPENAPI_PATH) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson(JOY_IELTS_ACTIONS_OPENAPI, 200, { "Cache-Control": "public, max-age=300" });
    }
    if (pathname === TURTLEBOT4_OPENAPI_PATH) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson(JOY_TURTLEBOT4_ACTIONS_OPENAPI, 200, { "Cache-Control": "public, max-age=300" });
    }
    if (pathname === PRIVACY_PATH) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return privacyResponse();
    }
    if (pathname === HEALTH_PATH) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson({
        ok: true,
        configured: Boolean(env?.JOY_OWNER_EMAIL && configuredProfiles(env).length),
        version: 1,
      });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: "GET, POST, PUT, PATCH, OPTIONS",
          "Cache-Control": "no-store",
        },
      });
    }

    const context = await (dependencies.authenticate || authenticateJoyActions)(request, env);

    if (isJoyIeltsActionRoute(pathname)) {
      assertProjectAllowed(context, "ielts");
      const result = await handleJoyIeltsActionRequest(request, env, context, {
        service: dependencies.ieltsService,
      });
      return apiJson(result.value, result.status);
    }

    if (isProjectMemoryRoute(pathname, API_PREFIX)) {
      await assertProjectMemoryAccess(pathname, env, context);
      const result = await handleProjectMemoryRequest(request, env, context, {
        prefix: API_PREFIX,
        service: dependencies.projectMemoryService,
      });
      return apiJson(result.value, result.status);
    }

    if (isJoyDevRoute(pathname, API_PREFIX)) {
      const result = await handleJoyDevRequest(request, env, context, {
        prefix: API_PREFIX,
        service: dependencies.joyDevService,
      });
      return apiJson(result.value, result.status);
    }

    if (pathname === `${API_PREFIX}/overview`) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson(filterOverview(context, await service.getOverview(env, context)));
    }

    if (pathname === `${API_PREFIX}/projects`) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson({ projects: filterProjectRecords(context, await service.listProjects(env, context), "id") });
    }

    let match = pathname.match(/^\/api\/joy\/v1\/projects\/([^/]+)$/);
    if (match) {
      const projectId = decodePathPart(match[1]);
      assertProjectAllowed(context, projectId);
      if (request.method === "GET") {
        return apiJson(await service.getProject(env, context, projectId));
      }
      if (request.method === "PATCH") {
        return apiJson(await service.updateProject(
          env,
          context,
          projectId,
          await requestBody(request),
        ));
      }
      return methodNotAllowed(["GET", "PATCH"]);
    }

    match = pathname.match(/^\/api\/joy\/v1\/projects\/([^/]+)\/tasks$/);
    if (match) {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      const projectId = decodePathPart(match[1]);
      assertProjectAllowed(context, projectId);
      const result = await service.createTask(
        env,
        context,
        projectId,
        await requestBody(request),
      );
      return apiJson(result, result.deduplicated ? 200 : 201);
    }

    match = pathname.match(/^\/api\/joy\/v1\/tasks\/([^/]+)$/);
    if (match) {
      if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
      const taskId = decodePathPart(match[1]);
      await assertEntityAllowed(service, env, context, "task", taskId);
      return apiJson(await service.updateTask(
        env,
        context,
        taskId,
        await requestBody(request),
      ));
    }

    match = pathname.match(/^\/api\/joy\/v1\/projects\/([^/]+)\/milestones$/);
    if (match) {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      const projectId = decodePathPart(match[1]);
      assertProjectAllowed(context, projectId);
      const result = await service.createMilestone(
        env,
        context,
        projectId,
        await requestBody(request),
      );
      return apiJson(result, result.deduplicated ? 200 : 201);
    }

    match = pathname.match(/^\/api\/joy\/v1\/milestones\/([^/]+)$/);
    if (match) {
      if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
      const milestoneId = decodePathPart(match[1]);
      await assertEntityAllowed(service, env, context, "milestone", milestoneId);
      return apiJson(await service.updateMilestone(
        env,
        context,
        milestoneId,
        await requestBody(request),
      ));
    }

    match = pathname.match(/^\/api\/joy\/v1\/projects\/([^/]+)\/logs$/);
    if (match) {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      const projectId = decodePathPart(match[1]);
      assertProjectAllowed(context, projectId);
      const result = await service.appendProgressLog(
        env,
        context,
        projectId,
        await requestBody(request),
      );
      return apiJson(result, result.deduplicated ? 200 : 201);
    }

    match = pathname.match(/^\/api\/joy\/v1\/projects\/([^/]+)\/evidence$/);
    if (match) {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      const projectId = decodePathPart(match[1]);
      assertProjectAllowed(context, projectId);
      const result = await service.attachEvidence(
        env,
        context,
        projectId,
        await requestBody(request),
      );
      return apiJson(result, result.deduplicated ? 200 : 201);
    }

    return apiJson({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
