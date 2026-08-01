# Joy security and privacy boundaries

This reference consolidates the repository's existing security rules.

## Secrets

Never read, display, log, copy into chat, or commit:

- `.dev.vars`, `.env` files, private keys, or credential files;
- Google client secrets, access tokens, or refresh tokens;
- token-encryption secrets;
- VAPID private keys;
- Cloudflare or other service credentials.

Use tracked example files and documented environment-variable names when
reasoning about configuration. Store production secrets through Cloudflare
encrypted secrets or another explicitly approved secret store.

The repository is public. Treat source, tests, fixtures, snapshots,
`project-data/`, and build assets as publicly visible.

## Personal and public data

Do not add personal seed data, private Google Docs or Sheets links, private
document identifiers, user content, production database values, email
addresses, or other identifying information to public source or fixtures.

`project-data/` is browser-reachable and must contain only intentionally
public runtime data and assets. Sanitization during build is an additional
control, not permission to keep private source data in the repository.

## Authentication and authorization

Preserve:

- server-side Google OAuth handling;
- the configured single-account allowlist model;
- secure HTTP-only sessions;
- separation of account, Gmail, and Google Sheets permissions;
- least-privilege access for every Worker route and assistant integration.

Do not weaken an auth check for convenience or expose a previously private
route through static assets.

## Joy Core writes

Joy Core roles constrain actions:

- owner: full authorized access;
- assistant: non-destructive project/task/milestone/log/evidence work;
- viewer: read-only access.

Explicit scopes may restrict a role but never expand it. API and MCP adapters
must call the shared repository/service layer. Record write operations as
audit events. Do not grant destructive assistant operations implicitly.

## Database and migration safety

Use additive, forward-only migrations that preserve current data. Do not
silently copy, delete, or reinterpret legacy project state. Do not edit an
already-applied migration casually. Remote migration is an explicit
production action requiring user authorization.

## Git history and deployment

Never force-push or rewrite history during ordinary feature work. Historical
privacy cleanup requires the coordinated procedure in
`docs/privacy-history-rewrite.md`, including a maintenance window, backup,
credential rotation, full validation, and explicit authorization.

Do not deploy automatically. `scripts/deploy-clean-main.mjs` fetches and
deploys committed `origin/main` from a clean worktree, so running it has
network, Git, installation, database-check, and production effects.

## Review checklist

Before finishing:

- inspect the complete diff and all untracked files;
- confirm no secrets, personal data, private identifiers, or private links
  were introduced;
- confirm auth and permission checks remain intact;
- confirm writes pass through the proper service and audit boundary;
- confirm generated output and local secret files remain untracked;
- report any unresolved privacy or production risk.
