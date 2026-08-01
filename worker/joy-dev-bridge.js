import { JoyCoreError } from "./joy-core/service.js";
import {
  JOY_CORE_ACTIONS,
  assertJoyCorePermission,
} from "./joy-core/permissions.js";
import { appendProjectWorkSessionEvent } from "./project-memory/service.js";

const DEFAULT_REPOSITORY = "vah103/joy-personal-dashboard";
const DEFAULT_BRANCH = "main";
const WORKFLOW_FILE = "joy-dev-check.yml";
const MAX_FILE_CHARS = 220_000;
const MAX_TOTAL_CHARS = 650_000;
const MAX_CHANGES = 12;
const MAX_SEARCH_RESULTS = 30;
const SAFE_WRITE_ROOTS = Object.freeze([
  "src/",
  "worker/",
  "project-data/",
  "test/",
  "scripts/",
  "docs/",
  "public/",
  "assets/",
]);
const PROTECTED_PATHS = Object.freeze([
  ".github/",
  "migrations/",
  ".env",
  "package.json",
  "package-lock.json",
  "wrangler.toml",
  "worker/joy-actions.js",
  "worker/joy-actions-openapi-extended.js",
  "worker/joy-core/permissions.js",
  "worker/joy-dev-bridge.js",
  "worker/joy-dev-http.js",
  "worker/joy-dev-openapi.js",
]);

function text(value, maxLength = 4_000) {
  return String(value || "").trim().slice(0, maxLength);
}

function requiredText(value, field, maxLength = 4_000) {
  const normalized = text(value, maxLength);
  if (!normalized) throw new JoyCoreError("JOY_DEV_INVALID_INPUT", 400, { field });
  return normalized;
}

function stableToken(value, field, maxLength = 80) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  if (!normalized) throw new JoyCoreError("JOY_DEV_INVALID_INPUT", 400, { field });
  return normalized;
}

function projectIdValue(value) {
  return stableToken(value, "projectId", 40);
}

function permission(context, action) {
  assertJoyCorePermission(context?.role, action, context?.scopes);
}

function configuredRepositories(env) {
  const values = String(env?.JOY_DEV_REPOSITORIES || DEFAULT_REPOSITORY)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(values);
}

function repositoryValue(env, value) {
  const repository = requiredText(value || DEFAULT_REPOSITORY, "repository", 240).toLowerCase();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repository)) {
    throw new JoyCoreError("JOY_DEV_INVALID_REPOSITORY", 400);
  }
  if (!configuredRepositories(env).has(repository)) {
    throw new JoyCoreError("JOY_DEV_REPOSITORY_NOT_ALLOWED", 403, { repository });
  }
  return repository;
}

function githubToken(env) {
  const token = String(env?.JOY_GITHUB_TOKEN || "").trim();
  if (!token) throw new JoyCoreError("JOY_DEV_GITHUB_NOT_CONFIGURED", 503);
  return token;
}

function branchValue(value, projectId = null) {
  const branch = requiredText(value, "branch", 200);
  if (branch === DEFAULT_BRANCH || branch.startsWith("refs/") || branch.includes("..")) {
    throw new JoyCoreError("JOY_DEV_PROTECTED_BRANCH", 403, { branch });
  }
  if (!/^joy\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(branch)) {
    throw new JoyCoreError("JOY_DEV_INVALID_BRANCH", 400, { branch });
  }
  if (projectId && !branch.startsWith(`joy/${projectId}/`)) {
    throw new JoyCoreError("JOY_DEV_BRANCH_PROJECT_MISMATCH", 400, { branch, projectId });
  }
  return branch;
}

function repositoryPath(value, { write = false } = {}) {
  const path = requiredText(value, "path", 1_000).replace(/^\/+/, "");
  if (!path || path.includes("\0") || path.split("/").some((part) => part === "..")) {
    throw new JoyCoreError("JOY_DEV_INVALID_PATH", 400, { path });
  }
  if (!write) return path;
  if (!SAFE_WRITE_ROOTS.some((root) => path.startsWith(root))) {
    throw new JoyCoreError("JOY_DEV_PATH_NOT_WRITABLE", 403, { path });
  }
  if (PROTECTED_PATHS.some((protectedPath) => path === protectedPath || path.startsWith(protectedPath))) {
    throw new JoyCoreError("JOY_DEV_PROTECTED_PATH", 403, { path });
  }
  return path;
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function githubRequest(env, path, options = {}) {
  const request = options.fetch || fetch;
  const headers = new Headers(options.headers || {});
  headers.set("Accept", options.accept || "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${githubToken(env)}`);
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await request(`https://api.github.com${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) return null;
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw ? { message: raw.slice(0, 1_000) } : null;
  }
  if (!response.ok) {
    const status = response.status === 404 ? 404 : response.status === 409 || response.status === 422 ? 409 : 502;
    throw new JoyCoreError("JOY_DEV_GITHUB_REQUEST_FAILED", status, {
      githubStatus: response.status,
      message: text(payload?.message, 1_000),
      path,
    });
  }
  return payload;
}

function decodeBase64(value) {
  const binary = atob(String(value || "").replace(/\s+/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeRun(run, jobs = []) {
  if (!run) return null;
  return {
    id: run.id,
    name: run.name,
    displayTitle: run.display_title,
    status: run.status,
    conclusion: run.conclusion,
    event: run.event,
    branch: run.head_branch,
    headSha: run.head_sha,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    jobs: jobs.map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      htmlUrl: job.html_url,
      steps: Array.isArray(job.steps)
        ? job.steps.map((step) => ({
          name: step.name,
          status: step.status,
          conclusion: step.conclusion,
          number: step.number,
        }))
        : [],
    })),
  };
}

async function memoryEvent(env, context, input, options = {}) {
  if (!input.sessionId) return { logged: false };
  try {
    const result = await (options.appendSessionEvent || appendProjectWorkSessionEvent)(
      env,
      context,
      input.sessionId,
      {
        kind: input.kind,
        title: input.title,
        detail: input.detail,
        payload: input.payload,
        repoRef: input.repoRef,
        clientRequestId: input.clientRequestId,
      },
    );
    return { logged: true, eventId: result.event?.id || null };
  } catch (error) {
    return { logged: false, warning: String(error?.code || error?.message || "JOY_DEV_MEMORY_LOG_FAILED") };
  }
}

function branchName(projectId, slug, requestId) {
  const suffix = stableToken(requestId, "clientRequestId", 60).slice(0, 12);
  return `joy/${projectId}/${stableToken(slug, "slug", 48)}-${suffix}`.slice(0, 200);
}

export function describeJoyDevPolicy(env = {}) {
  return {
    repositories: [...configuredRepositories(env)],
    defaultRepository: DEFAULT_REPOSITORY,
    defaultBranch: DEFAULT_BRANCH,
    branchPattern: "joy/<projectId>/<slug>-<requestId>",
    maxChanges: MAX_CHANGES,
    maxFileChars: MAX_FILE_CHARS,
    maxTotalChars: MAX_TOTAL_CHARS,
    writableRoots: [...SAFE_WRITE_ROOTS],
    protectedPaths: [...PROTECTED_PATHS],
    prohibitedOperations: [
      "write main",
      "merge pull requests",
      "deploy production",
      "change secrets",
      "change migrations",
      "change workflows",
      "change dependency manifests",
      "change Dev Bridge security files",
    ],
  };
}

export async function getJoyRepositoryContext(env, context, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.REPOSITORY_READ);
  const repository = repositoryValue(env, input.repository);
  const [repo, mainRef, pulls] = await Promise.all([
    githubRequest(env, `/repos/${repository}`, options),
    githubRequest(env, `/repos/${repository}/git/ref/heads/${DEFAULT_BRANCH}`, options),
    githubRequest(env, `/repos/${repository}/pulls?state=open&base=${DEFAULT_BRANCH}&per_page=30`, options),
  ]);
  return {
    repository,
    defaultBranch: repo.default_branch || DEFAULT_BRANCH,
    mainHeadSha: mainRef.object?.sha || null,
    private: Boolean(repo.private),
    htmlUrl: repo.html_url,
    openPullRequests: (pulls || []).map((pull) => ({
      number: pull.number,
      title: pull.title,
      headBranch: pull.head?.ref,
      headSha: pull.head?.sha,
      draft: Boolean(pull.draft),
      htmlUrl: pull.html_url,
      updatedAt: pull.updated_at,
    })),
    policy: describeJoyDevPolicy(env),
  };
}

export async function searchJoyRepository(env, context, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.REPOSITORY_READ);
  const repository = repositoryValue(env, input.repository);
  const query = requiredText(input.query, "query", 500);
  const limit = Math.min(MAX_SEARCH_RESULTS, Math.max(1, Number(input.limit || 12)));
  const payload = await githubRequest(
    env,
    `/search/code?q=${encodeURIComponent(`${query} repo:${repository}`)}&per_page=${limit}`,
    options,
  );
  return {
    repository,
    query,
    totalCount: Number(payload.total_count || 0),
    results: (payload.items || []).slice(0, limit).map((item) => ({
      path: item.path,
      name: item.name,
      blobSha: item.sha,
      htmlUrl: item.html_url,
    })),
  };
}

export async function readJoyRepositoryFile(env, context, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.REPOSITORY_READ);
  const repository = repositoryValue(env, input.repository);
  const path = repositoryPath(input.path);
  const ref = text(input.ref || DEFAULT_BRANCH, 200);
  const payload = await githubRequest(
    env,
    `/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    options,
  );
  if (Array.isArray(payload) || payload.type !== "file") {
    throw new JoyCoreError("JOY_DEV_NOT_A_FILE", 400, { path });
  }
  if (Number(payload.size || 0) > MAX_FILE_CHARS * 4) {
    throw new JoyCoreError("JOY_DEV_FILE_TOO_LARGE", 413, { path, size: payload.size });
  }
  const content = payload.encoding === "base64" ? decodeBase64(payload.content) : String(payload.content || "");
  if (content.length > MAX_FILE_CHARS) {
    throw new JoyCoreError("JOY_DEV_FILE_TOO_LARGE", 413, { path, chars: content.length });
  }
  return {
    repository,
    path,
    ref,
    blobSha: payload.sha,
    size: payload.size,
    content,
    htmlUrl: payload.html_url,
  };
}

export async function createJoyWorkBranch(env, context, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.REPOSITORY_BRANCH_CREATE);
  const repository = repositoryValue(env, input.repository);
  const projectId = projectIdValue(input.projectId);
  const requestId = stableToken(input.clientRequestId, "clientRequestId", 60);
  const branch = branchName(projectId, input.slug, requestId);
  let existing = null;
  try {
    existing = await githubRequest(env, `/repos/${repository}/git/ref/heads/${encodePath(branch)}`, options);
  } catch (error) {
    if (error?.status !== 404) throw error;
  }
  if (existing) {
    return {
      repository,
      projectId,
      branch,
      headSha: existing.object?.sha || null,
      baseBranch: DEFAULT_BRANCH,
      deduplicated: true,
    };
  }
  const base = await githubRequest(env, `/repos/${repository}/git/ref/heads/${DEFAULT_BRANCH}`, options);
  const created = await githubRequest(env, `/repos/${repository}/git/refs`, {
    ...options,
    method: "POST",
    body: { ref: `refs/heads/${branch}`, sha: base.object?.sha },
  });
  const memory = await memoryEvent(env, context, {
    sessionId: input.sessionId,
    kind: "repo_ref",
    title: `Created work branch ${branch}`,
    detail: `Created from ${DEFAULT_BRANCH} at ${base.object?.sha}.`,
    repoRef: {
      repoFullName: repository,
      refType: "branch",
      ref: branch,
      uri: `https://github.com/${repository}/tree/${encodeURIComponent(branch)}`,
      status: "active",
      metadata: { baseSha: base.object?.sha },
    },
    clientRequestId: `dev-branch-${requestId}`,
  }, options);
  return {
    repository,
    projectId,
    branch,
    headSha: created.object?.sha || base.object?.sha || null,
    baseBranch: DEFAULT_BRANCH,
    deduplicated: false,
    memory,
  };
}

function normalizeChanges(input) {
  if (!Array.isArray(input.changes) || input.changes.length === 0 || input.changes.length > MAX_CHANGES) {
    throw new JoyCoreError("JOY_DEV_INVALID_CHANGES", 400, { maxChanges: MAX_CHANGES });
  }
  let totalChars = 0;
  const seen = new Set();
  const changes = input.changes.map((change, index) => {
    const path = repositoryPath(change?.path, { write: true });
    if (seen.has(path)) throw new JoyCoreError("JOY_DEV_DUPLICATE_PATH", 400, { path });
    seen.add(path);
    const operation = String(change?.operation || "upsert").trim().toLowerCase();
    if (!['upsert', 'delete'].includes(operation)) {
      throw new JoyCoreError("JOY_DEV_INVALID_CHANGE_OPERATION", 400, { index, operation });
    }
    const content = operation === "delete" ? null : String(change?.content ?? "");
    if (content !== null && content.length > MAX_FILE_CHARS) {
      throw new JoyCoreError("JOY_DEV_FILE_TOO_LARGE", 413, { path, chars: content.length });
    }
    totalChars += content?.length || 0;
    return { path, operation, content };
  });
  if (totalChars > MAX_TOTAL_CHARS) {
    throw new JoyCoreError("JOY_DEV_CHANGESET_TOO_LARGE", 413, { totalChars, maxTotalChars: MAX_TOTAL_CHARS });
  }
  return changes;
}

export async function applyJoyRepositoryChanges(env, context, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.REPOSITORY_WRITE);
  const repository = repositoryValue(env, input.repository);
  const projectId = projectIdValue(input.projectId);
  const branch = branchValue(input.branch, projectId);
  const expectedHeadSha = requiredText(input.expectedHeadSha, "expectedHeadSha", 80);
  const commitMessage = requiredText(input.commitMessage, "commitMessage", 240);
  const requestId = stableToken(input.clientRequestId, "clientRequestId", 60);
  const changes = normalizeChanges(input);
  const currentRef = await githubRequest(env, `/repos/${repository}/git/ref/heads/${encodePath(branch)}`, options);
  const currentHeadSha = currentRef.object?.sha;
  if (!currentHeadSha || currentHeadSha !== expectedHeadSha) {
    throw new JoyCoreError("JOY_DEV_BRANCH_HEAD_CONFLICT", 409, {
      expectedHeadSha,
      currentHeadSha: currentHeadSha || null,
    });
  }
  const currentCommit = await githubRequest(env, `/repos/${repository}/git/commits/${currentHeadSha}`, options);
  const tree = [];
  for (const change of changes) {
    if (change.operation === "delete") {
      tree.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blob = await githubRequest(env, `/repos/${repository}/git/blobs`, {
      ...options,
      method: "POST",
      body: { content: change.content, encoding: "utf-8" },
    });
    tree.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const newTree = await githubRequest(env, `/repos/${repository}/git/trees`, {
    ...options,
    method: "POST",
    body: { base_tree: currentCommit.tree?.sha, tree },
  });
  const commit = await githubRequest(env, `/repos/${repository}/git/commits`, {
    ...options,
    method: "POST",
    body: { message: commitMessage, tree: newTree.sha, parents: [currentHeadSha] },
  });
  await githubRequest(env, `/repos/${repository}/git/refs/heads/${encodePath(branch)}`, {
    ...options,
    method: "PATCH",
    body: { sha: commit.sha, force: false },
  });
  const htmlUrl = `https://github.com/${repository}/commit/${commit.sha}`;
  const memory = await memoryEvent(env, context, {
    sessionId: input.sessionId,
    kind: "code_change",
    title: commitMessage,
    detail: `Committed ${changes.length} file change(s) to ${branch}.`,
    payload: { branch, files: changes.map((item) => ({ path: item.path, operation: item.operation })) },
    repoRef: {
      repoFullName: repository,
      refType: "commit",
      ref: commit.sha,
      uri: htmlUrl,
      status: "active",
      metadata: { branch, files: changes.map((item) => item.path) },
    },
    clientRequestId: `dev-commit-${requestId}`,
  }, options);
  return {
    repository,
    projectId,
    branch,
    previousHeadSha: currentHeadSha,
    headSha: commit.sha,
    commitMessage,
    htmlUrl,
    changes: changes.map((item) => ({ path: item.path, operation: item.operation })),
    memory,
  };
}

async function locateWorkflowRun(env, repository, branch, requestId, options = {}) {
  const payload = await githubRequest(
    env,
    `/repos/${repository}/actions/workflows/${WORKFLOW_FILE}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=20`,
    options,
  );
  return (payload.workflow_runs || []).find((run) => String(run.display_title || "").includes(requestId)) || null;
}

export async function runJoyRepositoryChecks(env, context, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.REPOSITORY_CHECK_RUN);
  const repository = repositoryValue(env, input.repository);
  const projectId = projectIdValue(input.projectId);
  const branch = branchValue(input.branch, projectId);
  const requestId = stableToken(input.clientRequestId, "clientRequestId", 60);
  const suite = ["full", "ielts", "turtlebot4"].includes(String(input.suite || "full"))
    ? String(input.suite || "full")
    : "full";
  await githubRequest(env, `/repos/${repository}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    ...options,
    method: "POST",
    body: {
      ref: branch,
      inputs: { request_id: requestId, project_id: projectId, suite },
    },
  });
  let run = null;
  for (let attempt = 0; attempt < 3 && !run; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 350));
    run = await locateWorkflowRun(env, repository, branch, requestId, options);
  }
  const memory = await memoryEvent(env, context, {
    sessionId: input.sessionId,
    kind: "test",
    title: `Queued ${suite} repository checks`,
    detail: run ? `GitHub Actions run ${run.id} was queued for ${branch}.` : `Checks were dispatched for ${branch}; the run ID is not visible yet.`,
    payload: { branch, suite, runId: run?.id || null, requestId },
    repoRef: run ? {
      repoFullName: repository,
      refType: "workflow",
      ref: String(run.id),
      uri: run.html_url,
      status: "active",
      metadata: { branch, suite, requestId },
    } : undefined,
    clientRequestId: `dev-check-${requestId}`,
  }, options);
  return {
    repository,
    projectId,
    branch,
    suite,
    requestId,
    run: normalizeRun(run),
    status: run ? run.status : "queued",
    memory,
  };
}

export async function getJoyRepositoryCheck(env, context, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.REPOSITORY_READ);
  const repository = repositoryValue(env, input.repository);
  let run = null;
  if (input.runId) {
    const runId = requiredText(input.runId, "runId", 40);
    run = await githubRequest(env, `/repos/${repository}/actions/runs/${encodeURIComponent(runId)}`, options);
  } else {
    const branch = requiredText(input.branch, "branch", 200);
    const requestId = stableToken(input.requestId, "requestId", 60);
    run = await locateWorkflowRun(env, repository, branch, requestId, options);
    if (!run) return { repository, found: false, branch, requestId };
  }
  const jobsPayload = await githubRequest(env, `/repos/${repository}/actions/runs/${run.id}/jobs?per_page=50`, options);
  return { repository, found: true, run: normalizeRun(run, jobsPayload.jobs || []) };
}

export async function openJoyPullRequest(env, context, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.REPOSITORY_PR_CREATE);
  const repository = repositoryValue(env, input.repository);
  const projectId = projectIdValue(input.projectId);
  const branch = branchValue(input.branch, projectId);
  const title = requiredText(input.title, "title", 240);
  const body = text(input.body, 30_000);
  const requestId = stableToken(input.clientRequestId, "clientRequestId", 60);
  const existing = await githubRequest(
    env,
    `/repos/${repository}/pulls?state=open&head=${encodeURIComponent(`${repository.split("/")[0]}:${branch}`)}&base=${DEFAULT_BRANCH}&per_page=10`,
    options,
  );
  let pull = existing?.[0] || null;
  let deduplicated = Boolean(pull);
  if (!pull) {
    pull = await githubRequest(env, `/repos/${repository}/pulls`, {
      ...options,
      method: "POST",
      body: {
        title,
        body,
        head: branch,
        base: DEFAULT_BRANCH,
        draft: input.draft !== false,
        maintainer_can_modify: true,
      },
    });
    deduplicated = false;
  }
  const memory = await memoryEvent(env, context, {
    sessionId: input.sessionId,
    kind: "repo_ref",
    title: `${deduplicated ? "Found" : "Opened"} PR #${pull.number}: ${pull.title}`,
    detail: `Pull request from ${branch} to ${DEFAULT_BRANCH}.`,
    repoRef: {
      repoFullName: repository,
      refType: "pull_request",
      ref: String(pull.number),
      uri: pull.html_url,
      status: "active",
      metadata: { branch, base: DEFAULT_BRANCH, draft: Boolean(pull.draft) },
    },
    clientRequestId: `dev-pr-${requestId}`,
  }, options);
  return {
    repository,
    projectId,
    pullRequest: {
      number: pull.number,
      title: pull.title,
      body: pull.body || "",
      state: pull.state,
      draft: Boolean(pull.draft),
      headBranch: pull.head?.ref || branch,
      headSha: pull.head?.sha || null,
      baseBranch: pull.base?.ref || DEFAULT_BRANCH,
      htmlUrl: pull.html_url,
    },
    deduplicated,
    memory,
  };
}
