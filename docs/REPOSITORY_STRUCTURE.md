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
│   │   ├── ielts/              # IELTS Journey source and learning state UI
│   │   ├── motion/             # Dashboard entry animation
│   │   ├── notifications/      # Web Push client, mobile styling, weather status
│   │   ├── project-details/    # Project detail modal
│   │   ├── project-hub/        # TurtleBot4 Project Hub and card artwork
│   │   ├── sales/              # Sales assistant and appointment behavior
│   │   ├── tasks/              # To-do visibility, English rewrite, and reminders
│   │   ├── theme/              # Shared dashboard typography overrides
│   │   └── weather/            # Dashboard weather forecast helper
│   ├── assets/
│   │   ├── icons/              # App icons, favicon, and wolf mark
│   │   └── fonts/nunito/       # Bundled Nunito font files
│   └── pwa/                    # Manifest and service worker
├── project-data/
│   ├── finance/                # Finance layouts and P1008 assets
│   ├── ielts/                  # IELTS program JSON, styles, and card artwork
│   ├── speaking/               # Speaking practice runtime assets
│   ├── turtlebot4/             # TurtleBot4 project data and public assets
│   └── vocabulary/             # Vocabulary practice runtime assets
├── worker/                     # Cloudflare APIs, authentication, and scheduled jobs
├── migrations/                 # D1 schema migrations
├── scripts/                    # Build, validation, deployment, cache, and test utilities
├── test/                       # Regression tests
├── docs/                       # Setup and architecture documentation
├── .github/workflows/          # Automated test and build checks
├── package.json
├── package-lock.json
└── wrangler.jsonc
```

## Build behavior

`scripts/build.mjs` reads source files from `src/`, copies stable public project data from `project-data/`, and writes deployable assets into `dist/`. Existing browser URLs, service-worker paths, app icons, and Cloudflare asset routes remain stable after source reorganization.

The IELTS source is maintained in `src/features/ielts/`. Its core files are combined into one isolated browser bundle during the build, while program JSON and public styles remain in `project-data/ielts/`.

## Test compatibility

Some older regression tests intentionally inspect previous root filenames. `scripts/run-tests.mjs` creates temporary symlinks while tests run and removes them afterward. Before creating them, it removes managed symlinks left by an interrupted earlier run. A real file or directory occupying a compatibility path causes a clear failure instead of silently testing stale code.

## Continuous integration

`.github/workflows/ci.yml` runs the regression suite, production build, and a Wrangler dry run for pull requests and pushes to `main`.

## Removed fallback

The root GitHub Pages entry files and `.nojekyll` were removed. Production and development now use the Cloudflare build exclusively.
