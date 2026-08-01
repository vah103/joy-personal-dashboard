# Joy verification matrix

Choose the smallest reliable check first, then expand when the change crosses
boundaries or carries higher risk. Use Node.js 24 or newer, as declared in
`package.json`.

| Change area | Minimum relevant verification | Expand verification when |
| --- | --- | --- |
| Documentation or instructions | Inspect rendered Markdown, links, final diff, and status | Instructions change executable workflow or contradict source |
| Single frontend feature | Run its matching test file or `npm run test:<feature>` when available; run `npm run build` | Public assets, shared dashboard modules, PWA, or multiple features change |
| Finance | `npm run test:finance`; build when browser output changes | Worker, schema, shared dashboard, or public data also changes |
| IELTS | `npm run test:ielts`; build when browser output changes | Worker services, migrations, shared data, or multiple IELTS surfaces change |
| Worker route or service | Run matching Worker/API tests and syntax checks through the standard test runner | Auth, shared services, scheduled jobs, or public contracts change |
| Authentication/authorization | Run targeted auth/permission tests, then full `npm test` | Shared session logic, OAuth flow, Joy Core permissions, or several routes change |
| Joy Core/project memory | Run matching model, service, permission, API/MCP, and audit tests | Schema, adapters, or legacy compatibility changes |
| D1 migration | `npm run db:migrate:smoke` plus affected service tests | Migration affects existing runtime data or multiple services |
| PWA/service worker/public path | Run targeted tests and `npm run build`; inspect generated path consistency without editing `dist/` | Cache behavior or multiple entry pages change |
| Build/test/CI tooling | Run the changed tool's focused validation and `npm run verify` | Always treat as cross-cutting unless demonstrably isolated |
| Cross-cutting change | `npm run verify` | Add targeted checks for any behavior not covered by the aggregate pipeline |

## Standard commands

- `npm test`: syntax checks and complete Node regression suite through
  `scripts/run-tests.mjs`.
- `npm run build`: validate sources and produce sanitized deployable assets.
- `npm run db:migrate:smoke`: validate migrations locally.
- `npm run verify`: production and full dependency audits, migration smoke
  validation, complete tests, and production build.
- `npm run test:finance` and `npm run test:ielts`: focused feature suites.

## Constraints

- Do not use `npm run deploy` or `npm run deploy:current` as a test.
- Do not run remote D1 migration checks or remote migrations unless explicitly
  requested and authorized.
- Expect `npm test` to create temporary compatibility symlinks. Verify they
  are cleaned up and not present in the final Git status.
- Build output under ignored `dist/` may change locally. Never patch it as
  canonical source or add it to Git.
- If a check cannot run, record the exact reason and compensate with safe
  focused checks where possible.
- After verification, inspect `git diff`, `git diff --cached`, untracked files,
  and `git status`.
