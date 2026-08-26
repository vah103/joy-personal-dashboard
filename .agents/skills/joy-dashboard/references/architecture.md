# Joy architecture reference

This reference summarizes existing repository documentation; it does not
define a new architecture.

## Runtime shape

Joy is a Cloudflare-first personal dashboard:

- `src/` is canonical frontend source.
- `scripts/build.mjs` and related build scripts produce the ignored `dist/`
  deployment assets.
- `worker/router.js` is the Cloudflare Worker entry point.
- Worker routes run before static assets for `/api/*` and `/auth/*`.
- Cloudflare D1 provides persistent storage.
- `project-data/` contains stable public runtime data and project assets.
- `test/` contains regression coverage; `.github/workflows/ci.yml` runs the
  verification pipeline and a Wrangler dry run.

Do not restore the removed GitHub Pages fallback. Do not edit `dist/`
directly.

## Frontend ownership

Place browser source in:

- `src/pages/dashboard/` for the main dashboard;
- `src/pages/login/` for Google sign-in;
- `src/pages/sale/` for the sale workspace;
- `src/features/` for feature-specific JavaScript and styles;
- `src/assets/` for icons and bundled fonts;
- `src/pwa/` for the manifest and service worker.

Keep existing browser URLs, asset names, installed-app paths, cache paths, and
Cloudflare asset routes stable. Joy UI work must account for desktop, mobile,
accessibility, and the repository's Nunito typography.

## Public project data

`project-data/` contains browser-reachable Finance, IELTS, Speaking,
TurtleBot4, and Vocabulary assets. Treat everything placed there as public.
Keep implementation source in `src/features/` and stable public runtime data
in `project-data/`.

## Worker and Joy Core

`worker/` owns authentication, API routing, scheduled synchronization,
notifications, and domain services.

Joy Core is the canonical shared data and permission layer for the web
dashboard and assistant integrations. Its normalized entities include
projects, tasks, milestones, progress logs, evidence, access grants, and
immutable audit events.

Adapters must use the shared repository/service layer rather than query Joy
Core tables directly. Writes must respect role/action scopes and produce audit
events. Existing legacy sources remain compatibility boundaries until an
explicit adapter and migration are implemented; do not silently migrate or
replace them.

## Database migrations

Migrations under `migrations/` target Cloudflare D1. Add forward-only,
data-safe migrations. Preserve existing tables and runtime compatibility.
Avoid changing a migration that may already have been applied; create a new
corrective migration unless an explicitly reviewed repair requires otherwise.

## Test compatibility

`scripts/run-tests.mjs` creates temporary root-level symlinks so older tests
can inspect legacy filenames. It removes managed links after the run. A real
file or directory at a compatibility path is an error. Do not commit those
temporary paths or create permanent substitutes.

## Deployment model

The normal build writes to `dist/`. The clean deployment script fetches
committed `origin/main`, creates a detached temporary worktree, installs from
the lockfile, and runs the complete verification and deployment pipeline from
that committed state.

Deployment therefore has remote and production effects and is never an
implicit part of local verification.

## Authoritative sources

Read these originals when working in the corresponding area:

- project overview and safety: `README.md`;
- ownership, build behavior, compatibility and CI:
  `docs/REPOSITORY_STRUCTURE.md`;
- Cloudflare, OAuth and secrets: `docs/CLOUDFLARE_SETUP.md`;
- canonical entities, roles, service boundary and audit:
  `docs/JOY_CORE.md`;
- history-rewrite controls: `docs/privacy-history-rewrite.md`;
- supported commands and Node version: `package.json`;
- compatibility test mechanics: `scripts/run-tests.mjs`;
- clean-main deployment behavior: `scripts/deploy-clean-main.mjs`.
