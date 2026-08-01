import { json, readJson } from "./shared/http.js";
import { JOY_ACTIONS_OPENAPI } from "./joy-actions-openapi-extended.js";
import {
  handleJoyIeltsActionRequest,
  isJoyIeltsActionRoute,
} from "./joy-actions-ielts.js";
import {
  handleProjectMemoryRequest,
  isProjectMemoryRoute,
} from "./project-memory-http.js";
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
const PRIVACY_PATH = `${API_PREFIX}/privacy`;
const HEALTH_PATH = `${API_PREFIX}/health`;
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

function configuredScopes(env) {
  const scopes = String(env.JOY_GPT_ACTION_SCOPES || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes.length ? scopes : null;
}

export async function authenticateJoyActions(request, env) {
  const expectedKey = String(env?.JOY_GPT_ACTION_KEY || "").trim();
  const userEmail = String(env?.JOY_OWNER_EMAIL || "").trim().toLowerCase();
  if (!expectedKey || !userEmail) {
    throw new JoyCoreError("JOY_ACTIONS_NOT_CONFIGURED", 503);
  }
  const suppliedKey = bearerToken(request);
  if (!suppliedKey) {
    throw new JoyCoreError("JOY_ACTIONS_AUTH_REQUIRED", 401);
  }
  if (!await constantTimeEqual(suppliedKey, expectedKey)) {
    throw new JoyCoreError("JOY_ACTIONS_AUTH_INVALID", 403);
  }
  return {
    userEmail,
    role: "assistant",
    scopes: configuredScopes(env),
    actorType: "assistant",
    actorId: "chatgpt-custom-gpt",
  };
}

export function isJoyActionsRoute(pathname) {
  return pathname === OPENAPI_PATH
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
    if (pathname === PRIVACY_PATH) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return privacyResponse();
    }
    if (pathname === HEALTH_PATH) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson({
        ok: true,
        configured: Boolean(env?.JOY_GPT_ACTION_KEY && env?.JOY_OWNER_EMAIL),
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
      const result = await handleJoyIeltsActionRequest(request, env, context, {
        service: dependencies.ieltsService,
      });
      return apiJson(result.value, result.status);
    }

    if (isProjectMemoryRoute(pathname, API_PREFIX)) {
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
      return apiJson(await service.getOverview(env, context));
    }

    if (pathname === `${API_PREFIX}/projects`) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return apiJson({ projects: await service.listProjects(env, context) });
    }

    let match = pathname.match(/^\/api\/joy\/v1\/projects\/([^/]+)$/);
    if (match) {
      const projectId = decodePathPart(match[1]);
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
      const result = await service.createTask(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      );
      return apiJson(result, result.deduplicated ? 200 : 201);
    }

    match = pathname.match(/^\/api\/joy\/v1\/tasks\/([^/]+)$/);
    if (match) {
      if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
      return apiJson(await service.updateTask(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      ));
    }

    match = pathname.match(/^\/api\/joy\/v1\/projects\/([^/]+)\/milestones$/);
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

    match = pathname.match(/^\/api\/joy\/v1\/milestones\/([^/]+)$/);
    if (match) {
      if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
      return apiJson(await service.updateMilestone(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      ));
    }

    match = pathname.match(/^\/api\/joy\/v1\/projects\/([^/]+)\/logs$/);
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

    match = pathname.match(/^\/api\/joy\/v1\/projects\/([^/]+)\/evidence$/);
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
