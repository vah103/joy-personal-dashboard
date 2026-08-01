const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const errorResponse = {
  description: "The request could not be completed.",
  content: { "application/json": { schema: ref("Error") } },
};

const success = (schema, description = "Success") => ({
  description,
  content: { "application/json": { schema } },
});

const repositoryParameter = {
  name: "repository",
  in: "query",
  required: false,
  schema: { type: "string", maxLength: 240 },
  description: "Allowed repository in owner/name form. Defaults to the Joy dashboard repository.",
};

const writeResponses = (schema, accepted = false) => ({
  [accepted ? 202 : 200]: success(schema),
  201: success(schema),
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  413: errorResponse,
  503: errorResponse,
});

export const JOY_DEV_ACTION_PATHS = {
  "/api/joy/v1/dev/repository": {
    get: {
      operationId: "getJoyRepositoryContext",
      summary: "Read the current repository and development policy",
      description: "Call before code work. Returns the main head, open pull requests, allowed repository policy, protected paths, branch rules, size limits, and prohibited high-risk operations.",
      parameters: [repositoryParameter],
      responses: {
        200: success(ref("JoyRepositoryContext")),
        401: errorResponse,
        403: errorResponse,
        503: errorResponse,
      },
    },
  },
  "/api/joy/v1/dev/search": {
    get: {
      operationId: "searchJoyRepository",
      summary: "Search source files in the Joy repository",
      description: "Search for file names, symbols, UI text, routes, tests, or error messages. Use the returned paths with readJoyRepositoryFile before proposing or applying changes.",
      parameters: [
        repositoryParameter,
        { name: "query", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 500 } },
        { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 30 } },
      ],
      responses: {
        200: success(ref("JoyRepositorySearchResult")),
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        503: errorResponse,
      },
    },
  },
  "/api/joy/v1/dev/files": {
    get: {
      operationId: "readJoyRepositoryFile",
      summary: "Read one UTF-8 repository file",
      description: "Read the complete current file and blob SHA from main or a work branch. Always use the latest content before editing so replacements preserve unrelated code.",
      parameters: [
        repositoryParameter,
        { name: "path", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 1000 } },
        { name: "ref", in: "query", required: false, schema: { type: "string", maxLength: 200 } },
      ],
      responses: {
        200: success(ref("JoyRepositoryFile")),
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        413: errorResponse,
        503: errorResponse,
      },
    },
  },
  "/api/joy/v1/dev/branches": {
    post: {
      operationId: "createJoyWorkBranch",
      summary: "Create or reuse a protected Joy work branch",
      description: "Creates a deterministic joy/<project>/<slug>-<request> branch from current main. Direct main writes are impossible. Pass the active work-session ID to log the branch automatically.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("JoyCreateBranchInput") } },
      },
      responses: writeResponses(ref("JoyCreateBranchResult")),
    },
  },
  "/api/joy/v1/dev/changes": {
    post: {
      operationId: "applyJoyRepositoryChanges",
      summary: "Commit an atomic set of source changes to a work branch",
      description: "Replaces, creates, or deletes up to 12 safe source files in one commit. Requires the exact current branch head SHA and refuses stale writes, main, secrets, migrations, workflows, dependencies, and bridge security files.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("JoyApplyChangesInput") } },
      },
      responses: writeResponses(ref("JoyApplyChangesResult")),
    },
  },
  "/api/joy/v1/dev/checks": {
    post: {
      operationId: "runJoyRepositoryChecks",
      summary: "Run repository verification on a Joy work branch",
      description: "Dispatches the protected Joy Dev GitHub Actions workflow for the branch. It runs audits, migration smoke checks, tests, build, and a Worker dry-run without deploying production.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("JoyRunChecksInput") } },
      },
      responses: writeResponses(ref("JoyRunChecksResult"), true),
    },
    get: {
      operationId: "getJoyRepositoryCheck",
      summary: "Read a Joy Dev GitHub Actions run and job steps",
      description: "Poll a dispatched check by runId, or locate it by branch and requestId. Returns status, conclusion, jobs, and step results. Never claim tests passed before conclusion is success.",
      parameters: [
        repositoryParameter,
        { name: "runId", in: "query", required: false, schema: { type: "string", maxLength: 40 } },
        { name: "branch", in: "query", required: false, schema: { type: "string", maxLength: 200 } },
        { name: "requestId", in: "query", required: false, schema: { type: "string", maxLength: 80 } },
      ],
      responses: {
        200: success(ref("JoyCheckLookupResult")),
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        503: errorResponse,
      },
    },
  },
  "/api/joy/v1/dev/pull-requests": {
    post: {
      operationId: "openJoyPullRequest",
      summary: "Open or reuse a draft pull request to main",
      description: "Opens a draft pull request from a valid Joy work branch to main and logs it to the active session. This action cannot merge, approve, deploy, change secrets, or bypass branch protection.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: ref("JoyOpenPullRequestInput") } },
      },
      responses: writeResponses(ref("JoyOpenPullRequestResult")),
    },
  },
};

const repositoryProperty = {
  repository: { type: "string", maxLength: 240 },
};

const sessionProperty = {
  sessionId: { type: "string", maxLength: 80 },
};

const requestProperty = {
  clientRequestId: { type: "string", minLength: 1, maxLength: 80 },
};

export const JOY_DEV_ACTION_SCHEMAS = {
  JoyRepositoryContext: { type: "object", additionalProperties: true },
  JoyRepositorySearchResult: { type: "object", additionalProperties: true },
  JoyRepositoryFile: {
    type: "object",
    properties: {
      repository: { type: "string" },
      path: { type: "string" },
      ref: { type: "string" },
      blobSha: { type: "string" },
      size: { type: "integer" },
      content: { type: "string" },
      htmlUrl: { type: "string" },
    },
    required: ["repository", "path", "ref", "blobSha", "content"],
    additionalProperties: false,
  },
  JoyCreateBranchInput: {
    type: "object",
    properties: {
      ...repositoryProperty,
      projectId: { type: "string", minLength: 1, maxLength: 40 },
      slug: { type: "string", minLength: 1, maxLength: 48 },
      ...sessionProperty,
      ...requestProperty,
    },
    required: ["projectId", "slug", "clientRequestId"],
    additionalProperties: false,
  },
  JoyCreateBranchResult: { type: "object", additionalProperties: true },
  JoyRepositoryChange: {
    type: "object",
    properties: {
      path: { type: "string", minLength: 1, maxLength: 1000 },
      operation: { type: "string", enum: ["upsert", "delete"] },
      content: { type: "string", maxLength: 220000 },
    },
    required: ["path", "operation"],
    additionalProperties: false,
  },
  JoyApplyChangesInput: {
    type: "object",
    properties: {
      ...repositoryProperty,
      projectId: { type: "string", minLength: 1, maxLength: 40 },
      branch: { type: "string", minLength: 1, maxLength: 200 },
      expectedHeadSha: { type: "string", minLength: 7, maxLength: 80 },
      commitMessage: { type: "string", minLength: 1, maxLength: 240 },
      changes: { type: "array", minItems: 1, maxItems: 12, items: ref("JoyRepositoryChange") },
      ...sessionProperty,
      ...requestProperty,
    },
    required: ["projectId", "branch", "expectedHeadSha", "commitMessage", "changes", "clientRequestId"],
    additionalProperties: false,
  },
  JoyApplyChangesResult: { type: "object", additionalProperties: true },
  JoyRunChecksInput: {
    type: "object",
    properties: {
      ...repositoryProperty,
      projectId: { type: "string", minLength: 1, maxLength: 40 },
      branch: { type: "string", minLength: 1, maxLength: 200 },
      suite: { type: "string", enum: ["full", "ielts", "turtlebot4"] },
      ...sessionProperty,
      ...requestProperty,
    },
    required: ["projectId", "branch", "clientRequestId"],
    additionalProperties: false,
  },
  JoyRunChecksResult: { type: "object", additionalProperties: true },
  JoyCheckLookupResult: { type: "object", additionalProperties: true },
  JoyOpenPullRequestInput: {
    type: "object",
    properties: {
      ...repositoryProperty,
      projectId: { type: "string", minLength: 1, maxLength: 40 },
      branch: { type: "string", minLength: 1, maxLength: 200 },
      title: { type: "string", minLength: 1, maxLength: 240 },
      body: { type: "string", maxLength: 30000 },
      draft: { type: "boolean", default: true },
      ...sessionProperty,
      ...requestProperty,
    },
    required: ["projectId", "branch", "title", "clientRequestId"],
    additionalProperties: false,
  },
  JoyOpenPullRequestResult: { type: "object", additionalProperties: true },
};
