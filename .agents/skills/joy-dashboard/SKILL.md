---
name: joy-dashboard
description: Work safely on the Joy Personal Dashboard repository, including frontend, Cloudflare Worker APIs, Joy Core, D1 migrations, public project data, tests, builds, and deployment readiness. Use for implementation, debugging, code review, architecture assessment, migration planning, regression testing, or repository maintenance in Joy.
---

# Joy Dashboard workflow

Follow the repository-wide rules in `AGENTS.md`. Keep this workflow scoped to
the user's request and do not perform Git publication, remote migration, or
deployment actions without explicit authorization.

## 1. Inspect the repository

Before editing, inspect:

- current branch and configured upstream;
- `git status`;
- staged and unstaged diffs;
- untracked files.

Preserve all existing user work.

## 2. Classify the affected subsystem

Classify the task as one or more of:

- frontend pages or features under `src/`;
- public runtime data/assets under `project-data/`;
- Worker routes, authentication, services, or scheduled jobs under `worker/`;
- Joy Core or shared project memory;
- D1 schema and migrations;
- build, test, CI, or deployment tooling;
- documentation only.

Read [references/architecture.md](references/architecture.md) whenever file
ownership, runtime boundaries, generated output, compatibility, or data flow
is relevant.

## 3. Read authoritative guidance

Read the relevant implementation and tests first. Then read the authoritative
documents routed by `references/architecture.md`.

For credentials, OAuth, personal data, Worker permissions, Git history, or
public artifacts, also read
[references/security-boundaries.md](references/security-boundaries.md).

## 4. Define the scope

State or internally establish:

- intended behavior and affected contracts;
- smallest set of source and test files needed;
- compatibility, authentication, privacy, and migration risks;
- verification required for the affected subsystem.

Do not include opportunistic refactors or generated `dist/` edits.

## 5. Make a small, safe change

Edit canonical source only. Preserve public paths and contracts unless the
task explicitly coordinates their change. Keep migrations additive and Worker
writes authorized and audited. Add or update regression coverage for bug
fixes when practical.

For UI changes, preserve responsive behavior, accessibility, and Nunito
typography.

## 6. Verify

Read and follow
[references/verification-matrix.md](references/verification-matrix.md).
Start with focused checks and expand based on risk. Run `npm run verify` for
cross-cutting changes. Never turn verification into an automatic deployment.

## 7. Review the result

Inspect the final diff and status. Check that:

- only intended source and instruction files changed;
- `dist/` or test compatibility links were not accidentally added;
- no secret, token, personal data, or private identifier appears;
- public URLs, asset and service-worker paths, and API contracts remain
  compatible;
- migration and authorization boundaries remain intact.

## 8. Report

Report files changed and reasons, checks run and results, checks not run,
remaining risks, compatibility implications, and follow-up work. Explicitly
state when no commit, push, remote migration, or deployment was performed.
