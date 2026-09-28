import { buildCompanyLiveBoard } from "./company-live-board-model.js";
import { json } from "./shared/http.js";
import { getSession } from "./shared/session.js";

const COMPANY_LIVE_BOARD_PATH = "/api/company/live-board";
const COMPANY_HUB_REPOSITORY = "vah103/chat-gpt";
const COMPANY_HUB_REF = "main";
const REQUIRED_SOURCE_PATHS = Object.freeze({
  tasks: "company/operations/TASKS.md",
  handoffs: "company/operations/HANDOFFS.md",
  staff: "company/operations/STAFF.md",
});
const OPTIONAL_HEARTBEAT_PATH = "company/operations/runtime/dell.json";

class CompanyHubFetchError extends Error {
  constructor(path, status) {
    super(`Company Hub source unavailable: ${path} (${status})`);
    this.name = "CompanyHubFetchError";
    this.path = path;
    this.status = status;
  }
}

export function isCompanyLiveBoardRoute(pathname) {
  return pathname === COMPANY_LIVE_BOARD_PATH;
}

function githubContentsUrl(path) {
  const encodedPath = String(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://api.github.com/repos/${COMPANY_HUB_REPOSITORY}/contents/${encodedPath}?ref=${encodeURIComponent(COMPANY_HUB_REF)}`;
}

async function fetchCompanyHubText(path, env) {
  const token = String(env.COMPANY_HUB_GITHUB_TOKEN || "").trim();
  if (!token) throw new CompanyHubFetchError(path, "TOKEN_NOT_CONFIGURED");

  const response = await fetch(githubContentsUrl(path), {
    method: "GET",
    headers: {
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "joy-company-live-board-v1",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new CompanyHubFetchError(path, response.status);
  return response.text();
}

async function optionalHeartbeat(env) {
  try {
    const raw = await fetchCompanyHubText(OPTIONAL_HEARTBEAT_PATH, env);
    return { heartbeat: JSON.parse(raw), available: true };
  } catch {
    return { heartbeat: null, available: false };
  }
}

export async function handleCompanyLiveBoardRequest(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
  if (request.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const [tasksMarkdown, handoffsMarkdown, staffMarkdown, heartbeatResult] = await Promise.all([
      fetchCompanyHubText(REQUIRED_SOURCE_PATHS.tasks, env),
      fetchCompanyHubText(REQUIRED_SOURCE_PATHS.handoffs, env),
      fetchCompanyHubText(REQUIRED_SOURCE_PATHS.staff, env),
      optionalHeartbeat(env),
    ]);

    const board = buildCompanyLiveBoard({
      tasksMarkdown,
      handoffsMarkdown,
      staffMarkdown,
      heartbeat: heartbeatResult.heartbeat,
      heartbeatSourceAvailable: heartbeatResult.available,
      fetchedAt: new Date().toISOString(),
      nowMs: Date.now(),
    });
    return json(board, 200, { Vary: "Cookie" });
  } catch (error) {
    if (error instanceof CompanyHubFetchError) {
      const code = error.status === "TOKEN_NOT_CONFIGURED"
        ? "COMPANY_HUB_NOT_CONFIGURED"
        : "COMPANY_HUB_UNAVAILABLE";
      return json({
        error: code,
        source: error.path,
      }, 503, { Vary: "Cookie" });
    }
    console.error("Joy Company Live Board failed", error);
    return json({ error: "COMPANY_LIVE_BOARD_FAILED" }, 500, { Vary: "Cookie" });
  }
}
