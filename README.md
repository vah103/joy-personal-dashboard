# Joy Personal Dashboard

A responsive personal dashboard for Vanh, covering Gmail, sales viewings, active projects, finance, weather notifications, and daily tasks.

## Features

- Secure Google sign-in with Gmail and Google Sheets connected separately.
- Automatic Gmail, sales, finance, project, scratchpad, and task synchronization through Cloudflare.
- TurtleBot4 and IELTS project dashboards.
- Three-state weather updates: sunny, chill, or strong-rain warning.
- Web Push notifications for the installed iPhone app.
- Local browser fallback for temporary offline changes.

## Repository layout

- Root HTML, CSS, and JavaScript files keep the GitHub Pages fallback compatible.
- `modules/` contains production-only frontend modules grouped by feature.
- `project-data/` contains TurtleBot4 and IELTS project assets and source data.
- `worker/` contains the Cloudflare Worker API and scheduled jobs.
- `migrations/` contains D1 database migrations.
- `scripts/` contains the production build.
- `test/` contains automated regression tests.
- `docs/` contains setup and architecture notes.

See [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md) for the detailed map.

## Cloudflare architecture

Cloudflare Workers serves the authenticated API and the built frontend. D1 stores sessions, encrypted integration tokens, cached Gmail metadata, and application data. Scheduled jobs synchronize external data and evaluate weather notifications.

See [`docs/CLOUDFLARE_SETUP.md`](docs/CLOUDFLARE_SETUP.md) for the deployment procedure. Never commit OAuth secrets, refresh tokens, `.dev.vars`, `.env`, `dist/`, `.wrangler/`, or `node_modules/`.
