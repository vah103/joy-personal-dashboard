# Joy Personal Dashboard

A Cloudflare-powered personal dashboard for Vanh, covering Gmail, Google Sheets sales and finance, active projects, tasks, weather, and Web Push notifications.

## Repository layout

- `src/` — frontend source code, pages, features, icons, fonts, and PWA files.
- `project-data/` — public runtime data and project assets for Finance, IELTS, Speaking, TurtleBot4, and Vocabulary.
- `worker/` — Cloudflare Worker routes, API services, scheduled synchronization, and weather notifications.
- `migrations/` — Cloudflare D1 database migrations.
- `scripts/` — production build, source validation, deployment, cache-busting, and test compatibility utilities.
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

This GitHub repository is public. Never commit OAuth secrets, refresh tokens, private API keys, `.dev.vars`, `.env`, `dist/`, `.wrangler/`, or `node_modules/`. Store deployment secrets in Cloudflare or GitHub encrypted secrets rather than source files.

See [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md) for the detailed map and [`docs/CLOUDFLARE_SETUP.md`](docs/CLOUDFLARE_SETUP.md) for deployment setup.
