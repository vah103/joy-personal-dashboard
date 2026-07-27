# Joy Personal Dashboard

A private Cloudflare-powered dashboard for Vanh, covering Gmail, Google Sheets sales and finance, active projects, tasks, weather, and Web Push notifications.

## Repository layout

- `src/` — all frontend source code, pages, features, icons, fonts, and PWA files.
- `project-data/` — public curriculum/data files and project-specific assets for TurtleBot4 and IELTS.
- `worker/` — Cloudflare Worker routes, API services, scheduled synchronization, and weather notifications.
- `migrations/` — Cloudflare D1 database migrations.
- `scripts/` — production build, source validation, and test compatibility runner.
- `test/` — automated regression tests.
- `docs/` — deployment, structure, and archived project notes.

The repository is Cloudflare-first. `npm run build` generates the deployable frontend in `dist/`, which is intentionally ignored by Git. GitHub Pages is no longer used as a fallback.

Feature source belongs under `src/features/`. Stable public data and project assets belong under `project-data/`. Generated browser bundles are written only to `dist/`.

## Commands

```bash
npm test
npm run build
npm run dev
npm run deploy
```

## Safety

Never commit OAuth secrets, refresh tokens, `.dev.vars`, `.env`, `dist/`, `.wrangler/`, or `node_modules/`.

See [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md) for the detailed map and [`docs/CLOUDFLARE_SETUP.md`](docs/CLOUDFLARE_SETUP.md) for deployment setup.
