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
│   │   ├── greeting/           # Daily Brief layout and polish
│   │   ├── ielts/              # IELTS Coach source, baseline, AI review, and rewrite
│   │   ├── notifications/      # Web Push client, mobile styling, weather status
│   │   ├── project-details/    # Project detail modal
│   │   ├── project-hub/        # TurtleBot4 Project Hub and card artwork
│   │   ├── sales/              # Sales assistant and appointment behavior
│   │   ├── tasks/              # To-do visibility, English rewrite, and reminders
│   │   └── weather/            # Dashboard weather forecast helper
│   ├── assets/
│   │   ├── icons/              # App icons, favicon, and wolf mark
│   │   └── fonts/nunito/       # Bundled Nunito font files
│   └── pwa/                    # Manifest and service worker
├── project-data/
│   ├── ielts/                  # Public curriculum JSON, styles, and card artwork
│   └── turtlebot4/             # TurtleBot4 project data and public assets
├── worker/                     # Cloudflare API and scheduled jobs
├── migrations/                 # D1 schema migrations
├── scripts/                    # Build, source validation, and test runner
├── test/                       # Regression tests
├── docs/                       # Setup and architecture documentation
├── package.json
├── package-lock.json
└── wrangler.jsonc
```

## Build behavior

`scripts/build.mjs` reads source files from `src/` and writes stable public filenames into `dist/`. This keeps existing browser URLs, service-worker paths, app icons, and Cloudflare asset routes unchanged after repository reorganization.

The IELTS source is maintained in `src/features/ielts/`. Its core files are combined into one isolated browser bundle during the build, while curriculum JSON and public styles remain in `project-data/ielts/`.

## Test compatibility

Some older regression tests intentionally inspect the previous root filenames. `scripts/run-tests.mjs` creates temporary local symlinks while tests run and removes them afterward. These compatibility files are never committed and do not clutter the repository.

## Removed fallback

The root GitHub Pages entry files and `.nojekyll` were removed. Production and development now use the Cloudflare build exclusively.
