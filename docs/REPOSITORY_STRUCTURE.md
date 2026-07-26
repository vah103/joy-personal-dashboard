# Repository structure

```text
joy-personal-dashboard/
├── index.html, login.html, sale-manager.html  # Browser entry pages
├── *.css / *.js                               # Base GitHub Pages-compatible frontend
├── modules/                                   # Cloudflare-only frontend modules
│   ├── auth/
│   ├── notifications/
│   └── project-hub/
├── project-data/                              # IELTS and TurtleBot4 project data
├── worker/                                    # Cloudflare Worker API and services
├── migrations/                                # D1 database migrations
├── scripts/                                   # Build and maintenance scripts
├── test/                                      # Automated regression tests
├── docs/                                      # Setup and architecture documentation
├── site.webmanifest, sw.js                    # PWA and Web Push entry files
├── package.json                               # Commands and dependencies
└── wrangler.jsonc                             # Cloudflare deployment configuration
```

## Why some frontend files remain at the root

The base dashboard files remain at the repository root so the GitHub Pages fallback continues to work. Production-only features are grouped under `modules/` and copied into `dist/` during `npm run build`.

## Removed legacy files

The cleanup removed obsolete favicon/icon experiments, the unused TurtleBot illustration, and the superseded `worker/rain-push.js` implementation. The active app icons, service worker, database migrations, tests, project data, and Nunito font assets were retained.
