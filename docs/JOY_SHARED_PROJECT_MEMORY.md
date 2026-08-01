# Joy Shared Project Memory

## Purpose

Shared Project Memory gives specialized GPTs a reliable continuation layer for long-running projects. It solves two recurring problems:

1. A new GPT conversation does not automatically know the current state of the Joy app.
2. Work completed during a conversation is difficult to summarize accurately into the app afterward.

The memory layer is shared by IELTS and TurtleBot4. Domain-specific teaching, robotics, repository editing, and CI tools are added in later stages.

## Lifecycle

```text
bootstrapJoyWorkspace
  -> startJoyWorkSession
  -> appendJoyWorkSessionEvent while meaningful work happens
  -> finishJoyWorkSession
  -> next conversation calls bootstrapJoyWorkspace again
```

### Bootstrap

`bootstrapJoyWorkspace(projectId)` returns:

- the current canonical Joy project and related tasks, milestones, logs, and evidence;
- the latest project snapshot;
- an open session and its events, when one exists;
- recent completed sessions and events;
- active decisions;
- open blockers;
- memory evidence;
- repository references;
- continuation guidance containing the current goal, next actions, blockers, and latest summary.

A specialized GPT should call this before giving a project-status answer or beginning substantial project work.

### Start or resume

`startJoyWorkSession(projectId)` creates one open session for the project. When an open session already exists, it is resumed by default. D1 also enforces one open session per account and project to protect against concurrent requests.

A session records:

- title and goal;
- actor identity;
- start and end times;
- outcomes and next actions;
- structured metadata;
- an idempotency key.

### Append meaningful events

`appendJoyWorkSessionEvent(sessionId)` records work as it happens. Event kinds include:

- command;
- code change;
- test;
- result;
- decision;
- blocker;
- evidence;
- repository reference;
- task or plan update;
- note or other event.

Decision, blocker, evidence, and repository-reference events also create dedicated structured records. This allows the next conversation to retrieve important facts without inferring them from a long transcript.

Do not record every conversational message. Record a session event when it changes project understanding, progress, implementation, evidence, or the next action.

### Finish

`finishJoyWorkSession(sessionId)`:

- closes the session;
- stores the session summary, outcomes, and next actions;
- updates the project snapshot;
- updates Joy Core focus, next action, progress, and blockers when supplied;
- preserves unresolved structured blockers;
- appends a canonical immutable Joy progress log;
- prepares continuation data for the next GPT conversation.

Finishing a session is idempotent. Retrying a completed session does not create a second completion log.

## Data model

The D1 memory layer contains:

```text
joy_project_snapshots
joy_work_sessions
joy_work_session_events
joy_project_decisions
joy_project_blockers
joy_project_memory_evidence
joy_project_repo_refs
```

Joy Core remains the canonical project/task/milestone/progress-log/evidence system. Shared Project Memory adds working context around it rather than replacing it.

## Permissions

New Joy Core scopes:

```text
workspace:read
workspace:update
session:create
session:update
memory:create
```

Role behavior:

- viewer: read workspace context only;
- assistant: read and create non-destructive session memory, update project continuation, and create progress logs;
- owner: all memory permissions.

There are no memory delete actions in the GPT schema.

## HTTP routes

GPT Actions:

```text
GET  /api/joy/v1/workspaces/{projectId}
POST /api/joy/v1/workspaces/{projectId}/sessions
POST /api/joy/v1/work-sessions/{sessionId}/events
POST /api/joy/v1/work-sessions/{sessionId}/finish
```

Signed-in Joy web API:

```text
GET  /api/joy-core/v1/workspaces/{projectId}
POST /api/joy-core/v1/workspaces/{projectId}/sessions
POST /api/joy-core/v1/work-sessions/{sessionId}/events
POST /api/joy-core/v1/work-sessions/{sessionId}/finish
```

The web API keeps the existing session and same-origin write protections.

## Specialized GPT instruction contract

The future IELTS and TurtleBot4 GPTs should include the following behavioral contract:

```text
1. Call bootstrapJoyWorkspace for the assigned project at the start of project work and before claiming the current project status.
2. Resume an open session or call startJoyWorkSession before substantive teaching, coding, testing, or lab work.
3. Record only meaningful verified events with appendJoyWorkSessionEvent.
4. Never invent commands, code changes, test results, commits, pull requests, evidence, scores, or completed outcomes.
5. Record a blocker when work cannot continue and resolve the same blocker record when evidence shows it is cleared.
6. Record repository branches, commits, pull requests, workflow runs, and important files as repo_ref events when they materially affect continuation.
7. Call finishJoyWorkSession before ending the work period. Save a factual summary, verified outcomes, unresolved blockers, and concrete next actions.
8. Do not mark project tasks completed merely because they were discussed. Require owner confirmation or verifiable completion evidence.
```

## Deployment

Stage 1 adds two ordered D1 migrations:

```text
20260801_shared_project_memory.sql
20260801_shared_project_memory_constraints.sql
```

Use the normal deployment pipeline. It verifies a clean `main`, runs the full repository checks, applies pending remote D1 migrations, and then deploys the Worker.

```bash
cd ~/joy-personal-dashboard
git pull --ff-only origin main
npm run deploy
```

After deployment, re-import the GPT Actions schema using a cache-busting URL:

```text
https://app.hey-joy.workers.dev/api/joy/v1/openapi.json?v=1.3.0
```

Expected new operation IDs:

```text
bootstrapJoyWorkspace
startJoyWorkSession
appendJoyWorkSessionEvent
finishJoyWorkSession
```

## Stage boundary

Stage 1 does not yet give a GPT permission to read or edit GitHub code, run repository tests, or create pull requests. It provides the shared, durable project context required for those Stage 2 developer operations and for the later IELTS and TurtleBot4 specialized GPTs.
