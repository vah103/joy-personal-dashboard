# Joy Stage C — Dashboard on Joy Core

Stage C connects the signed-in Joy dashboard to the same normalized Joy Core records used by the private Custom GPT Actions integration.

## Architecture

- Custom GPT: bearer-authenticated `/api/joy/v1/*`
- Signed-in dashboard: session-authenticated `/api/joy-core/v1/*`
- Shared application layer: `worker/joy-core/service.js`
- Shared persistence: D1 tables prefixed `joy_core_`

Both API surfaces use the same validation, permissions, optimistic versions, idempotency keys, audit events, and repository functions.

## TurtleBot4 migration

TurtleBot4 is the first project moved to the shared model.

The existing GitHub roadmap, 10-week schedule, checklist overrides, commands, and detailed Project State v2 presentation remain in the Project Hub. Joy Core becomes the canonical owner of:

- project progress
- current stage
- current focus
- next action
- project tasks
- milestones
- progress logs
- evidence references

When the dashboard first opens a compatibility-only TurtleBot4 project, it promotes the current project state into Joy Core through a normal versioned project update. No separate backfill migration is required.

## Dashboard behavior

The TurtleBot4 card and Overview use the Joy Core project progress, focus, and next action when available. The Overview also shows a Joy Core panel containing shared tasks, recent progress logs, milestones, and evidence counts.

- Tasks created by the Custom GPT appear on the dashboard.
- Completing a Joy Core task on the dashboard is visible to the Custom GPT.
- Adding the current plan creates an idempotent Joy Core project task rather than a legacy inbox task.
- Schedule checkboxes create or update stable Joy Core project tasks.
- Roadmap, schedule, and plan edits synchronize project progress, stage, focus, and next action.

## Web API security

`worker/joy-core-web.js` requires a valid Joy session for all requests. Non-GET requests must be same-origin. The session is mapped to the Joy Core `owner` role and writes are audited as the signed-in user.

The Stage C web API intentionally exposes no DELETE route.

## Current boundary

Project Hub-specific presentation state remains in `project_hubs`. General project truth lives in Joy Core. Later Stage C slices can move IELTS and other project surfaces onto the same web API without duplicating business logic.
