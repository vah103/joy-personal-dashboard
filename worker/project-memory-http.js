import { readJson } from "./shared/http.js";
import { JoyCoreError } from "./joy-core/service.js";
import { PROJECT_MEMORY_SERVICE } from "./project-memory/service.js";

const MAX_BODY_BYTES = 128_000;

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
    throw new JoyCoreError("JOY_MEMORY_BODY_TOO_LARGE", 413);
  }
  return readJson(request);
}

function methodNotAllowed(allowed) {
  throw new JoyCoreError("METHOD_NOT_ALLOWED", 405, { allowed });
}

export function isProjectMemoryRoute(pathname, prefix) {
  return pathname.startsWith(`${prefix}/workspaces/`)
    || pathname.startsWith(`${prefix}/work-sessions/`);
}

export async function handleProjectMemoryRequest(
  request,
  env,
  context,
  options = {},
) {
  const prefix = options.prefix || "/api/joy/v1";
  const service = options.service || PROJECT_MEMORY_SERVICE;
  const url = new URL(request.url);
  const { pathname } = url;

  let match = pathname.match(new RegExp(`^${prefix.replaceAll("/", "\\/")}\\/workspaces\\/([^/]+)$`));
  if (match) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return {
      value: await service.bootstrapWorkspace(
        env,
        context,
        decodePathPart(match[1]),
        { limit: url.searchParams.get("limit") || undefined },
      ),
      status: 200,
    };
  }

  match = pathname.match(new RegExp(`^${prefix.replaceAll("/", "\\/")}\\/workspaces\\/([^/]+)\\/sessions$`));
  if (match) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    const value = await service.startWorkSession(
      env,
      context,
      decodePathPart(match[1]),
      await requestBody(request),
    );
    return { value, status: value.deduplicated || value.resumed ? 200 : 201 };
  }

  match = pathname.match(new RegExp(`^${prefix.replaceAll("/", "\\/")}\\/work-sessions\\/([^/]+)\\/events$`));
  if (match) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    const value = await service.appendSessionEvent(
      env,
      context,
      decodePathPart(match[1]),
      await requestBody(request),
    );
    return { value, status: value.deduplicated ? 200 : 201 };
  }

  match = pathname.match(new RegExp(`^${prefix.replaceAll("/", "\\/")}\\/work-sessions\\/([^/]+)\\/finish$`));
  if (match) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return {
      value: await service.finishWorkSession(
        env,
        context,
        decodePathPart(match[1]),
        await requestBody(request),
      ),
      status: 200,
    };
  }

  throw new JoyCoreError("NOT_FOUND", 404);
}
