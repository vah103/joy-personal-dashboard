# Joy Custom GPT Actions

This stage connects a private Custom GPT named **Joy** to the Joy Personal Dashboard without embedding an AI chat UI in the web app.

The Custom GPT uses a bearer API key and the OpenAPI schema served by the Cloudflare Worker. All endpoints call the shared Joy Core service. The API intentionally exposes no delete operations.

## Architecture

```text
Custom GPT Joy
    │ Bearer API key + OpenAPI Actions
    ▼
/api/joy/v1/*
    │
Joy Actions router
    │
Joy Core service + permissions + audit
    │
Cloudflare D1 and compatibility adapters
```

Existing dashboard project and task data remains readable through compatibility adapters. A compatibility project is promoted into normalized `joy_core_*` storage only when the GPT first writes to it.

## Cloudflare secrets

After the Stage A migration and this code are merged, configure the production Worker:

```bash
openssl rand -hex 32
npx wrangler secret put JOY_GPT_ACTION_KEY
npx wrangler secret put JOY_OWNER_EMAIL
```

- `JOY_GPT_ACTION_KEY` must be a long random value. Use the same value in the Custom GPT Action authentication settings.
- `JOY_OWNER_EMAIL` must exactly match the Google account email used to sign in to Joy.
- Do not add either value to `wrangler.jsonc`, `.dev.vars`, documentation examples, GitHub Actions logs, or the public repository.

Optional least-privilege restriction:

```bash
npx wrangler secret put JOY_GPT_ACTION_SCOPES
```

When set, use a comma-separated subset such as:

```text
project:read,project:update,task:read,task:create,task:update,milestone:read,milestone:create,milestone:update,log:read,log:create,evidence:read,evidence:create
```

Omitting `JOY_GPT_ACTION_SCOPES` uses the built-in `assistant` role. That role still cannot archive or delete data.

## Public setup URLs

After deployment:

- OpenAPI schema: `https://app.hey-joy.workers.dev/api/joy/v1/openapi.json`
- Privacy policy: `https://app.hey-joy.workers.dev/api/joy/v1/privacy`
- Configuration health: `https://app.hey-joy.workers.dev/api/joy/v1/health`

The health endpoint reports only whether required secrets exist. It never returns their values.

## Custom GPT configuration

1. Open the GPT editor and create a private GPT named **Joy**.
2. In **Actions**, create a new action and import the OpenAPI schema URL above.
3. Choose **API key** authentication.
4. Choose **Bearer** authentication and paste the value stored as `JOY_GPT_ACTION_KEY`.
5. Add the privacy policy URL above.
6. Keep the GPT private while testing.
7. Test `getJoyOverview`, then test one explicitly approved task creation with a stable `clientRequestId`.

A GPT can use Actions or Apps in one GPT configuration, not both simultaneously. The future ChatGPT App/MCP version should therefore be a separate integration or replace Actions only after the App version is ready.

## Recommended GPT instructions

```text
You are Joy, the owner's personal project and planning assistant.

Use Joy Actions as the source of truth for current projects, project tasks, milestones, progress logs, and evidence references.

Before answering a question about current priorities or progress, call getJoyOverview or getJoyProject when the live Joy data would affect the answer.

Write-safety rules:
1. Never claim a write succeeded unless the relevant action returned success.
2. Never create a task or milestone unless the owner asks for it or clearly approves the proposed item.
3. Mark a task completed only when the owner confirms completion or provides clear completion evidence.
4. Before changing project progress, blockers, status, or next action, read the project first.
5. Use baseVersion from the latest read when updating projects, tasks, or milestones.
6. For create operations, send a stable clientRequestId so retries do not create duplicates.
7. Do not attempt to archive or delete data. No delete operations are available.
8. When a version conflict occurs, read the latest record, explain what changed, and ask before overwriting a meaningful user change.
9. Keep TurtleBot4, IELTS, Finance, and personal tasks separate unless the owner explicitly connects them.
10. Summarize every successful write in one sentence, including the project and affected record.
```

## Available operations

| Operation | Purpose |
| --- | --- |
| `getJoyOverview` | Read projects, open project tasks, inbox tasks, and recent logs |
| `listJoyProjects` | List current Joy projects |
| `getJoyProject` | Read one project and all related Joy Core records |
| `updateJoyProject` | Update safe project fields with optional version checking |
| `createJoyTask` | Create an idempotent project task |
| `updateJoyTask` | Update an existing project task |
| `createJoyMilestone` | Create an idempotent milestone |
| `updateJoyMilestone` | Update an existing milestone |
| `appendJoyProgressLog` | Append an immutable project update, decision, blocker, or result |
| `attachJoyEvidence` | Store a file, URL, image, log, or commit reference |

## Compatibility behavior

- Normalized records in `joy_core_*` are authoritative.
- Existing `joy_projects` records are exposed read-only when no normalized record exists.
- `project-data/turtlebot4/current-state.json` is exposed as the TurtleBot4 compatibility project.
- The existing general `tasks` table is returned separately as `inboxTasks` in the overview.
- The first write to a compatibility project promotes a canonical copy into `joy_core_projects`; legacy data is not deleted or modified.

## Deployment order

1. Merge and deploy Stage A so the `joy_core_*` migration exists remotely.
2. Merge this Stage B PR.
3. Apply remote migrations through the normal deployment gate.
4. Configure `JOY_GPT_ACTION_KEY` and `JOY_OWNER_EMAIL`.
5. Deploy the Worker.
6. Confirm the health endpoint returns `configured: true`.
7. Import the schema in the Custom GPT editor and test read operations before writes.
