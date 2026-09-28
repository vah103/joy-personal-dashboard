# Company Live Board V1

Company Live Board is a read-only operator view inside Joy. It renders governed
Company work state without turning Joy into a second source of truth.

## Private source adapter

The Joy repository is public while the Company Hub repository is private.
The browser therefore never receives a GitHub credential and no Company source
snapshot is committed to this repository.

The authenticated Cloudflare Worker route `GET /api/company/live-board` reads
the private Hub using the Cloudflare secret `COMPANY_HUB_GITHUB_TOKEN`.
Configure that secret with read-only Contents access to `vah103/chat-gpt`.
Do not put the real token in `.dev.vars.example`, `wrangler.jsonc`, source,
fixtures, logs, or `project-data/`.

V1 consumes exactly these Company paths from `main`:

- `company/operations/TASKS.md` — canonical durable task state;
- `company/operations/HANDOFFS.md` — durable handoff/routing state and
  timestamped handoff-published events;
- `company/operations/STAFF.md` — positions, seat state, and current
  assignee binding;
- `company/operations/runtime/dell.json` — optional host/runtime heartbeat
  evidence only.

If any required work-state source cannot be read, the API returns unavailable
instead of inventing state. A missing heartbeat does not fail the work-state
view; presence is shown as unknown/unavailable.

## Work state and presence

Work state and live presence are deliberately separate.

Task ownership, current-action ownership, task status, commits, and handoffs do
not prove that a worker/session is online. The current DELL heartbeat is a
host/runtime source and has no governed role binding, so V1 does not project it
onto any role card. Role presence therefore remains unknown/unavailable unless
a separately authorized role/session source is added through governance later.

The governed runtime freshness contract is:

- heartbeat age <= 45 minutes: `RECENTLY_CONFIRMED`;
- heartbeat age > 45 minutes: `STALE_NOT_RECENTLY_CONFIRMED`;
- missing/invalid source: `UNKNOWN_UNAVAILABLE`.

Stale is never rendered as offline.

## Presentation semantics

Task lanes are presentation-only:

- TODO: `IDEA`, `ROUTING_REQUIRED`, `TODO`;
- ACTIVE: `ACTIVE`;
- REVIEW: `COMPLETE_PENDING_REVIEW`, `PENDING_REVIEW`;
- BLOCKED / GATED: `BLOCKED`, `BLOCKED_BY_USAGE`,
  `RECOVERY_REQUIRED`, `PENDING_USER`, `PENDING_CANONICAL_SYNC`,
  `PENDING_STRATEGIC_REVIEW`, `PENDING_GOVERNANCE`;
- DONE: `DONE`;
- OTHER / ARCHIVED: any other value, including `CANCELLED`.

Every task card still shows the exact canonical status from TASKS.

Waiting relationships are emitted only for explicit durable evidence:
pending handoffs, review status/current action ownership, unresolved task
dependencies, and named blocking/gate states. Workflow history is not used to
infer a waiting edge.

The recent-activity timeline uses timestamped handoff publication events. TASKS
is a snapshot without transition timestamps, so V1 does not fabricate task
completion times or a "recently done" timestamp from it. Runtime heartbeat
`last_seen` remains in the separate presence/freshness area.

## Read-only boundary

V1 has no Company-state mutation endpoint or control. The only board actions
are opening/closing the view, changing local presentation filters, and
refreshing the GET request. It cannot:

- edit TASKS, HANDOFFS, STAFF, policy, gates, or role assignments;
- acknowledge/pick up/complete a Company task or handoff;
- write heartbeat/presence;
- infer presence from work state.

Any future write path requires a separate governance and authorization
decision.

## Verification

The focused regression suite is `test/company-live-board.test.mjs`. Because
this feature crosses frontend, Worker, authentication, private-source parsing,
i18n, and build boundaries, the pull-request CI must pass the repository
verification pipeline, including `npm test`, `npm run build`, and the
Wrangler dry run, before maker completion is proposed.
