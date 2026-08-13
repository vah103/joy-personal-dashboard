# Joy Personal Dashboard agent instructions

These instructions apply to the entire repository. Treat the repository as a
Cloudflare-first personal dashboard whose source of truth is the committed
source, not generated output.

## Before changing anything

1. Inspect the current branch and upstream.
2. Inspect `git status`, the staged diff, the unstaged diff, and all untracked
   files.
3. Read the relevant implementation, tests, and authoritative documentation
   before editing.
4. Identify existing user changes and work around them. Never delete, reset,
   restore, overwrite with checkout, or otherwise discard them.

Do not commit, push, merge, rebase, force-push, rewrite history, or deploy
unless the user explicitly requests that exact action.

## Source and architecture boundaries

- Edit frontend source under `src/`. Never edit generated files in `dist/`
  directly.
- Keep public URLs, asset paths, service-worker paths, and API contracts
  stable unless the task explicitly requires a coordinated migration.
- Put stable public runtime data and assets under `project-data/`; never put
  private or personal data there or in publicly reachable fixtures.
- Respect authentication, authorization, the Joy Core shared
  repository/service boundary, and write auditing in Worker and API code.
- Make migrations additive and safe for existing data. Do not modify a
  migration that may already have been applied unless the user explicitly
  approves a reviewed migration-repair plan.
- Prefer small, clearly scoped changes. Avoid unrelated cleanup and protect
  other features from regressions.

Use these files as authoritative project guidance:

- `README.md`
- `docs/REPOSITORY_STRUCTURE.md`
- `docs/CLOUDFLARE_SETUP.md`
- `docs/JOY_CORE.md`
- `docs/i18n.md`
- `docs/privacy-history-rewrite.md`
- `package.json`
- `scripts/run-tests.mjs`
- `scripts/deploy-clean-main.mjs`

## UI language and i18n — mandatory for every feature

Joy has one shared bilingual interface system under `src/i18n`. Interface
language is a repository-wide contract, not a feature-specific concern.

Before adding or changing any user-visible UI copy, read `docs/i18n.md` and
inspect the existing keys in:

- `src/i18n/locales/en.js`
- `src/i18n/locales/vi.js`

For every new or changed UI string:

- use `window.JoyI18n.t("semantic.key")` or `data-i18n="semantic.key"` instead
  of hard-coding a new English/Vietnamese pair inside the feature;
- add or update the same semantic key in both `en.js` and `vi.js` in the same
  change;
- keep user data unchanged: names, addresses, notes, tasks, project content,
  email content, room-listing source text, and other user-entered facts are
  not interface translations;
- keep parser/input language independent from UI language; Vietnamese natural
  language input must continue to work when the interface is English where
  the feature already supports it;
- use shared locale-aware date, number, and currency formatting for new UI;
- never add a new feature-owned translation dictionary, DOM translation shim,
  `*-english-ui.js`, `*-vietnamese-ui.js`, or similar language layer. Extend
  shared `JoyI18n` instead.

`src/features/tasks/task-english.js` is a content transformation feature, not
UI localization. Existing legacy language adapters may remain only while they
delegate to `JoyI18n`; do not copy their old architecture into new work.

Any UI/i18n change must run `npm run i18n:check` in addition to the relevant
focused tests. Do not bypass an i18n CI failure; fix the shared locale keys or
language system.

## Security and privacy

- Never read, display, log, or commit secrets, tokens, `.dev.vars`, private
  keys, credentials, or personal information.
- Do not inspect secret-bearing local files merely to determine whether they
  exist. Use tracked examples and documented variable names instead.
- Keep secrets in Cloudflare or another approved encrypted secret store.
- Do not introduce private identifiers, personal seed data, private document
  links, or production user data into `project-data/`, tests, fixtures,
  snapshots, logs, or build artifacts.
- Do not rewrite Git history as part of normal development. Follow
  `docs/privacy-history-rewrite.md` only when the user explicitly authorizes a
  coordinated privacy-maintenance operation.

## Implementation and verification

- For a bug fix, add or update a regression test when practical.
- For UI work, check desktop and mobile behavior, accessibility, the shared
  i18n contract above, and the repository's Nunito typography requirements.
- After editing, run the tests appropriate to the affected subsystem.
- Run `npm run verify` for cross-cutting changes.
- Do not run `npm run deploy` automatically.
- Treat compatibility paths created by `scripts/run-tests.mjs` as temporary
  test-runner artifacts; do not replace them with real root files.
- After every change, inspect `git diff` and `git status`. Confirm generated
  files, secrets, personal data, and unrelated changes were not introduced.

## Completion report

Report:

- files changed and why;
- tests and checks run, with results;
- relevant tests not run and why;
- remaining risks, compatibility concerns, and follow-up work.

## Joy-specific skill

For implementation, debugging, review, migration, Worker/API, frontend,
project-data, build, test, or deployment-readiness work in this repository,
use `.agents/skills/joy-dashboard/SKILL.md`.
