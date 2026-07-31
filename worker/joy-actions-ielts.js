import { readJson } from "./shared/http.js";
import { JoyCoreError } from "./joy-core/service.js";
import { STABLE_IELTS_ASSISTANT_SERVICE } from "./ielts-assistant-service.js";

const IELTS_ACTION_PREFIX = "/api/joy/v1/ielts";
const MAX_BODY_BYTES = 128_000;

export function isJoyIeltsActionRoute(pathname) {
  return pathname === IELTS_ACTION_PREFIX || pathname.startsWith(`${IELTS_ACTION_PREFIX}/`);
}

function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new JoyCoreError("IELTS_INVALID_PATH", 400);
  }
}

async function body(request) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new JoyCoreError("IELTS_ACTION_BODY_TOO_LARGE", 413);
  }
  return readJson(request);
}

function methodNotAllowed(allowed) {
  throw new JoyCoreError("METHOD_NOT_ALLOWED", 405, { allowed });
}

export async function handleJoyIeltsActionRequest(
  request,
  env,
  context,
  dependencies = {},
) {
  const service = dependencies.service || STABLE_IELTS_ASSISTANT_SERVICE;
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === `${IELTS_ACTION_PREFIX}/today`) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return {
      value: await service.getTeachingContext(env, context, {
        date: url.searchParams.get("date") || undefined,
      }),
      status: 200,
    };
  }

  let match = pathname.match(/^\/api\/joy\/v1\/ielts\/tasks\/([^/]+)$/);
  if (match) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return {
      value: await service.getTeachingTask(
        env,
        context,
        decodePathPart(match[1]),
        { date: url.searchParams.get("date") || undefined },
      ),
      status: 200,
    };
  }

  match = pathname.match(/^\/api\/joy\/v1\/ielts\/tasks\/([^/]+)\/start$/);
  if (match) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return {
      value: await service.startTask(
        env,
        context,
        decodePathPart(match[1]),
        {},
      ),
      status: 200,
    };
  }

  match = pathname.match(/^\/api\/joy\/v1\/ielts\/tasks\/([^/]+)\/complete$/);
  if (match) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return {
      value: await service.completeTask(
        env,
        context,
        decodePathPart(match[1]),
        await body(request),
      ),
      status: 200,
    };
  }

  if (pathname === `${IELTS_ACTION_PREFIX}/assessments`) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return {
      value: await service.addAssessment(env, context, await body(request)),
      status: 201,
    };
  }

  if (pathname === `${IELTS_ACTION_PREFIX}/errors`) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return {
      value: await service.addRecurringError(env, context, await body(request)),
      status: 201,
    };
  }

  if (pathname === `${IELTS_ACTION_PREFIX}/course-sessions`) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return {
      value: await service.addCourseSession(env, context, await body(request)),
      status: 201,
    };
  }

  match = pathname.match(/^\/api\/joy\/v1\/ielts\/rhythms\/([^/]+)\/tasks$/);
  if (match) {
    if (request.method !== "PUT") return methodNotAllowed(["PUT"]);
    return {
      value: await service.replaceRhythmTasks(
        env,
        context,
        decodePathPart(match[1]),
        await body(request),
      ),
      status: 200,
    };
  }

  throw new JoyCoreError("NOT_FOUND", 404);
}
