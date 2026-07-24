const SESSION_COOKIE = "__Host-joy_session";
const PROJECT_ID = "turtlebot4";
const GITHUB_REPOSITORY = "vah103/turtlebot4_project";
const GITHUB_REF = "main";
const MAX_OVERRIDE_BYTES = 200_000;

export function isProjectHubRoute(pathname) {
  return pathname === "/api/turtlebot-source" || pathname === "/api/project-hub";
}

export async function handleProjectHubRequest(request, env) {
  const url = new URL(request.url);
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return json({ error: "INVALID_ORIGIN" }, 403);
  }

  if (url.pathname === "/api/turtlebot-source" && request.method === "GET") {
    return getTurtleBotSource(env);
  }

  if (url.pathname === "/api/project-hub" && request.method === "GET") {
    return getProjectHub(session.user_email, env);
  }

  if (url.pathname === "/api/project-hub" && request.method === "PUT") {
    return putProjectHub(request, session.user_email, env);
  }

  return json({ error: "NOT_FOUND" }, 404);
}

async function getTurtleBotSource(env) {
  try {
    const [projectFile, roadmapFile, commandsFile, reportListing, commits] = await Promise.all([
      githubFile(env, ".joy/project.json"),
      githubFile(env, ".joy/roadmap.json"),
      githubFile(env, ".joy/commands.json"),
      githubDirectory(env, "report"),
      githubApi(env, `/repos/${GITHUB_REPOSITORY}/commits?sha=${GITHUB_REF}&per_page=10`),
    ]);

    const reportEntries = reportListing
      .filter((item) => item.type === "file" && /^\d{4}-\d{2}-\d{2}(?:-session-\d+)?\.md$/.test(item.name))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 20);

    const reports = await Promise.all(reportEntries.map(async (entry) => {
      const file = await githubFile(env, entry.path);
      return {
        path: entry.path,
        name: entry.name,
        date: entry.name.slice(0, 10),
        content: file.content,
        htmlUrl: entry.html_url,
        sha: file.sha,
      };
    }));

    return json({
      ok: true,
      source: "github",
      repository: GITHUB_REPOSITORY,
      ref: GITHUB_REF,
      project: parseJsonFile(projectFile, ".joy/project.json"),
      roadmap: parseJsonFile(roadmapFile, ".joy/roadmap.json"),
      commands: parseJsonFile(commandsFile, ".joy/commands.json"),
      reports,
      commits: Array.isArray(commits) ? commits.map((commit) => ({
        sha: String(commit.sha || ""),
        message: String(commit.commit?.message || "").split("\n")[0],
        date: commit.commit?.committer?.date || commit.commit?.author?.date || "",
        htmlUrl: commit.html_url || "",
      })) : [],
      syncedAt: Date.now(),
    });
  } catch (error) {
    console.error("TurtleBot GitHub sync failed", error.status, error.message);
    if (!env.GITHUB_TOKEN) {
      return json({
        error: "GITHUB_TOKEN_REQUIRED",
        message: "Add a GitHub token as the Cloudflare Worker secret GITHUB_TOKEN to read the private TurtleBot repository.",
      }, 503);
    }
    if (error.status === 401 || error.status === 403) {
      return json({ error: "GITHUB_ACCESS_DENIED" }, 403);
    }
    if (error.status === 404) {
      return json({ error: "TURTLEBOT_SOURCE_NOT_FOUND" }, 404);
    }
    return json({ error: "GITHUB_SYNC_FAILED" }, 502);
  }
}

async function getProjectHub(email, env) {
  await ensureProjectHubTable(env);
  const row = await env.DB.prepare(`
    SELECT data_json, version, updated_at
    FROM project_hubs
    WHERE user_email = ? AND project_id = ?
  `).bind(email, PROJECT_ID).first();

  return json({
    projectId: PROJECT_ID,
    data: safeJsonParse(row?.data_json, {}),
    version: Number(row?.version || 0),
    updatedAt: Number(row?.updated_at || 0),
  });
}

async function putProjectHub(request, email, env) {
  const body = await readJson(request);
  const data = body && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : null;
  const baseVersion = Number(body.baseVersion || 0);
  if (!data) return json({ error: "INVALID_PROJECT_HUB_DATA" }, 400);

  const serialized = JSON.stringify(data);
  if (new TextEncoder().encode(serialized).byteLength > MAX_OVERRIDE_BYTES) {
    return json({ error: "PROJECT_HUB_DATA_TOO_LARGE" }, 413);
  }

  await ensureProjectHubTable(env);
  const current = await env.DB.prepare(`
    SELECT version, data_json, updated_at
    FROM project_hubs
    WHERE user_email = ? AND project_id = ?
  `).bind(email, PROJECT_ID).first();

  const currentVersion = Number(current?.version || 0);
  if (baseVersion !== currentVersion) {
    return json({
      error: "PROJECT_HUB_VERSION_CONFLICT",
      data: safeJsonParse(current?.data_json, {}),
      version: currentVersion,
      updatedAt: Number(current?.updated_at || 0),
    }, 409);
  }

  const nextVersion = currentVersion + 1;
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO project_hubs (user_email, project_id, data_json, version, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_email, project_id) DO UPDATE SET
      data_json = excluded.data_json,
      version = excluded.version,
      updated_at = excluded.updated_at
  `).bind(email, PROJECT_ID, serialized, nextVersion, now).run();

  return json({
    ok: true,
    projectId: PROJECT_ID,
    data,
    version: nextVersion,
    updatedAt: now,
  });
}

async function ensureProjectHubTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS project_hubs (
      user_email TEXT NOT NULL,
      project_id TEXT NOT NULL,
      data_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_email, project_id)
    )
  `).run();
}

async function githubFile(env, path) {
  const payload = await githubApi(
    env,
    `/repos/${GITHUB_REPOSITORY}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(GITHUB_REF)}`,
  );
  if (!payload || Array.isArray(payload) || payload.type !== "file") {
    const error = new Error(`GitHub file is unavailable: ${path}`);
    error.status = 404;
    throw error;
  }
  return {
    path,
    sha: payload.sha || "",
    htmlUrl: payload.html_url || "",
    content: decodeBase64(payload.content || ""),
  };
}

async function githubDirectory(env, path) {
  const payload = await githubApi(
    env,
    `/repos/${GITHUB_REPOSITORY}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(GITHUB_REF)}`,
  );
  if (!Array.isArray(payload)) {
    const error = new Error(`GitHub directory is unavailable: ${path}`);
    error.status = 404;
    throw error;
  }
  return payload;
}

async function githubApi(env, path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Joy-Personal-Dashboard",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const response = await fetch(`https://api.github.com${path}`, { headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `GitHub API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function parseJsonFile(file, label) {
  try {
    return JSON.parse(file.content);
  } catch {
    const error = new Error(`${label} contains invalid JSON`);
    error.status = 502;
    throw error;
  }
}

function encodeGitHubPath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function decodeBase64(value) {
  const binary = atob(String(value).replace(/\s+/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getSession(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return env.DB.prepare(
    "SELECT user_email, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?",
  ).bind(tokenHash, Date.now()).first();
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [name, rest.join("=")];
  }).filter(([name]) => name));
}

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
