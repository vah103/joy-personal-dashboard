# Joy Dev Bridge

Joy Dev Bridge is the shared Stage 2 development layer for the future IELTS and TurtleBot4 GPTs. It lets an authenticated GPT inspect the real repository, make reviewed branch-based changes, run repository checks, and open a draft pull request while preserving the project work session created by Shared Project Memory.

## Development lifecycle

1. `bootstrapJoyWorkspace` loads the project state and active session.
2. `getJoyRepositoryContext` loads the real `main` head, open PRs, and the server-enforced development policy.
3. `searchJoyRepository` locates relevant files and symbols.
4. `readJoyRepositoryFile` reads the complete latest file before editing.
5. `createJoyWorkBranch` creates or resumes a deterministic `joy/<project>/<slug>-<request>` branch from current `main`.
6. `applyJoyRepositoryChanges` creates one atomic commit for up to 12 source-file changes.
7. `runJoyRepositoryChecks` dispatches the protected `Joy Dev Checks` workflow.
8. `getJoyRepositoryCheck` polls the run and job steps. A GPT must not claim success until the conclusion is `success`.
9. `openJoyPullRequest` opens or reuses a draft PR from the work branch to `main`.
10. `finishJoyWorkSession` stores the verified outcome and next action for the next conversation.

Passing the active `sessionId` to write operations automatically records branch, commit, workflow, and pull-request references in Shared Project Memory. GitHub success is not rolled back if memory logging later fails; the response reports the logging warning so the GPT can record the event explicitly.

## Server-enforced safety

Joy Dev Bridge cannot:

- write directly to `main`;
- merge or approve pull requests;
- deploy production;
- read or change Cloudflare or GitHub secrets;
- change `.github` workflows;
- change D1 migrations;
- change package/dependency manifests;
- change Wrangler configuration;
- change the Actions router, permission model, or Dev Bridge security files.

Writable source roots are limited to `src/`, `worker/`, `project-data/`, `test/`, `scripts/`, `docs/`, `public/`, and `assets/`, after protected-path checks.

Each changeset requires the exact current `expectedHeadSha`. If another actor advances the branch, the request fails with `JOY_DEV_BRANCH_HEAD_CONFLICT` before any commit is created. Multi-file writes use GitHub's blob, tree, commit, and ref APIs so the branch advances only after the full commit exists.

## GitHub credential

Production requires the Cloudflare secret:

```bash
npx wrangler secret put JOY_GITHUB_TOKEN
```

Use a fine-grained GitHub personal access token limited to `vah103/joy-personal-dashboard` with:

- Metadata: read
- Contents: read and write
- Pull requests: read and write
- Actions: read and write

Do not paste the token into ChatGPT, GPT Instructions, repository files, screenshots, or shell history. Enter it only into Wrangler's hidden secret prompt.

The repository allowlist defaults to `vah103/joy-personal-dashboard`. It can be narrowed or extended with the server-side `JOY_DEV_REPOSITORIES` comma-separated variable.

## Optional Actions scopes

When `JOY_GPT_ACTION_SCOPES` is configured, a development GPT needs the appropriate values:

```text
repository:read
repository:branch:create
repository:write
repository:checks:run
repository:pr:create
```

A read-only GPT should receive only `repository:read`. Existing project-memory and project-specific scopes remain separate.

## Custom GPT instruction contract

A specialized GPT should follow these rules:

- Load project memory and repository context before substantive work.
- Read every target file from the current branch immediately before replacing it.
- Never invent a file, symbol, command, commit, test result, run, or PR.
- Keep all writes on the branch returned by `createJoyWorkBranch`.
- Use the latest returned branch head as the next `expectedHeadSha`.
- Run checks after code changes and poll until completion.
- Open a draft PR only after checks pass, unless the owner explicitly asks for a draft containing known failures.
- Never describe a queued or in-progress check as passed.
- Finish the project session with only verified outcomes and unresolved blockers.

## Action schema

After deployment, import:

```text
https://app.hey-joy.workers.dev/api/joy/v1/openapi.json?v=1.4.0
```

The schema exposes repository read, branch, atomic changeset, checks, and draft PR operations. It intentionally exposes no merge, deploy, secret, workflow-edit, or migration-edit operation.
