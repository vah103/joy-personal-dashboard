# Repository structure

```text
joy-personal-dashboard/
├── src/
│   ├── pages/
│   │   ├── dashboard/          # Main dashboard HTML, CSS, and JavaScript
│   │   ├── login/              # Google sign-in page
│   │   └── sale/               # Sale workspace page
│   ├── features/
│   │   ├── auth/               # Account and integration controls
│   │   ├── finance/            # Finance dashboard behavior and styling
│   │   ├── notifications/      # Web Push client, mobile styling, weather status
│   │   ├── project-details/    # Project detail modal
│   │   ├── project-hub/        # TurtleBot4 Project Hub and card artwork
│   │   ├── tasks/              # To-do visibility and deletion behavior
│   │   └── weather/            # Dashboard weather forecast helper
│   ├── assets/
│   │   ├── icons/              # App icons, favicon, and wolf mark
│   │   └── fonts/nunito/       # Bundled Sale workspace fonts
│   └── pwa/                    # Manifest and service worker
├── project-data/               # IELTS and TurtleBot4 data
├── worker/                     # Cloudflare API and scheduled jobs
├── migrations/                 # D1 schema migrations
├── scripts/                    # Build and test runner
├── test/                       # Regression tests
├── docs/                       # Setup and architecture documentation
├── package.json
├── package-lock.json
└── wrangler.jsonc
```

## Build behavior

`scripts/build.mjs` reads source files from `src/` and writes stable public filenames into `dist/`. This keeps existing browser URLs, service-worker paths, app icons, and Cloudflare asset routes unchanged after the repository reorganization.

## Test compatibility

Some older regression tests intentionally inspect the previous root filenames. `scripts/run-tests.mjs` creates temporary local symlinks while tests run and removes them afterward. These compatibility files are never committed and do not clutter the repository.

## Removed fallback

The root GitHub Pages entry files and `.nojekyll` were removed. Production and development now use the Cloudflare build exclusively.
