# Joy Core foundation

Joy Core is the canonical data and permission layer shared by the Joy web dashboard, a future Custom GPT Action integration, and a future ChatGPT App/MCP integration.

Stage A intentionally adds the foundation without changing current dashboard routes or migrating existing TurtleBot4 and IELTS runtime state. Existing `project_hubs` JSON remains the compatibility source until an explicit adapter and migration are introduced.

## Canonical entities

- **Project** — stable project identity, status, progress, focus, next action, blockers, source, and metadata.
- **Task** — project work item with milestone linkage, status, priority, schedule, completion state, and source.
- **Milestone** — project checkpoint with target and completion dates.
- **Progress log** — append-oriented note, progress update, decision, blocker, or result.
- **Evidence** — file, URL, image, log, or commit attached to a project, task, or progress log.
- **Access grant** — role and optional action scopes for a user or machine client.
- **Audit event** — immutable record of a write or destructive action.

The JavaScript contract lives in `worker/joy-core/model.js`. All IDs are lowercase stable identifiers containing letters, numbers, dots, underscores, or hyphens. Timestamps are Unix milliseconds.

## Roles

| Role | Intended use | Default permissions |
| --- | --- | --- |
| `owner` | The signed-in Joy owner | Full read, write, archive, delete, access management, and audit access |
| `assistant` | Custom GPT or ChatGPT App client | Read data; update projects; create/update tasks and milestones; append logs and evidence; no destructive actions |
| `viewer` | Read-only client | Read projects, tasks, milestones, logs, and evidence |

An access grant can restrict a role further with explicit action scopes. Scopes never expand the permissions of the assigned role.

## Storage

`migrations/20260731_joy_core_foundation.sql` creates normalized D1 tables prefixed with `joy_`. It does not delete or rewrite legacy tables.

The normalized schema is designed so REST Actions and MCP tools can call the same future service functions. API and MCP adapters must not query the tables directly; they should use a shared repository/service layer and record audit events for writes.

## Compatibility boundary

During Stage A:

1. Current web routes and UI continue to use their existing sources.
2. No existing project state is copied automatically.
3. No external API endpoint is exposed yet.
4. Destructive assistant permissions remain disabled.

The next implementation stage should add a Joy Core repository/service plus a read-only adapter for current project data before enabling write APIs.
