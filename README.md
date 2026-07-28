# Joy Personal Dashboard

A private Cloudflare-powered dashboard for Vanh, covering Gmail, Google Sheets sales and finance, active projects, tasks, weather, language tools, and Web Push notifications.

## Repository layout

- `src/` — canonical frontend source code, pages, reusable features, icons, fonts, and PWA files.
- `project-data/` — stable public project data and browser assets whose deployed URLs must remain unchanged, including IELTS, TurtleBot4, Vocabulary, and Speaking.
- `worker/` — Cloudflare Worker routes, API services, scheduled synchronization, and weather notifications.
- `migrations/` — append-only Cloudflare D1 database migrations.
- `scripts/` — production build, feature injection, source validation, cache updates, repository audit, and test compatibility.
- `test/` — automated regression tests.
- `docs/` — deployment, structure, and repository-maintenance notes.

The repository is Cloudflare-first. `npm run build` generates the deployable frontend in `dist/`, which is intentionally ignored by Git. GitHub Pages is no longer used as a fallback.

New reusable frontend source belongs under `src/features/`. Stable public data or an intentionally preserved public browser URL belongs under `project-data/`. Generated browser output belongs only in `dist/`.

Language tools are attached by `scripts/inject-language-tools.mjs`; they must not be loaded from Project Hub, Finance, IELTS, or another unrelated feature.

## Commands

```bash
npm run audit
npm test
npm run build
npm run dev
npm run deploy
```

`npm test` runs the repository audit first. The audit examines every Git-tracked path and rejects committed build output, obsolete root compatibility files, likely secret files, and cross-feature language-tool loading.

## Safety

Never commit OAuth secrets, refresh tokens, `.dev.vars`, `.env`, `dist/`, `.wrangler/`, or `node_modules/`.

Do not delete old D1 migration files or persistent tables merely because a UI is temporarily hidden. Remove runtime code only after all routes, build references, tests, and data-preservation requirements have been checked.

See [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md) for the detailed map, [`docs/REPOSITORY_MAINTENANCE.md`](docs/REPOSITORY_MAINTENANCE.md) for cleanup rules, and [`docs/CLOUDFLARE_SETUP.md`](docs/CLOUDFLARE_SETUP.md) for deployment setup.
