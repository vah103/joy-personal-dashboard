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
│   │   ├── project-hub/        # TurtleBot4 Project Hub and card artwork only
│   │   ├── sales/              # Sales assistant and appointment behavior
│   │   ├── tasks/              # To-do visibility, English rewrite, and reminders
│   │   └── weather/            # Dashboard weather forecast helper
│   ├── assets/
│   │   ├── icons/              # App icons, favicon, and wolf mark
│   │   └── fonts/nunito/       # Bundled Nunito font files
│   └── pwa/                    # Manifest and service worker
├── project-data/
│   ├── ielts/                  # Public curriculum JSON, styles, and card artwork
│   ├── turtlebot4/             # TurtleBot4 project data and public assets
│   ├── vocabulary/             # Stable Vocabulary browser bundle
│   └── speaking/               # Stable Say it browser bundle
├── worker/                     # Cloudflare APIs and scheduled jobs
├── migrations/                 # Append-only D1 schema migrations
├── scripts/                    # Build, injection, validation, cache, and test runner
├── test/                       # Regression tests
├── docs/                       # Setup and architecture documentation
├── package.json
├── package-lock.json
└── wrangler.jsonc
```

## Build behavior

`scripts/build.mjs` reads source files from `src/` and writes stable public filenames into `dist/`. The IELTS core files are combined into one isolated browser bundle during that build.

`scripts/inject-language-tools.mjs` then attaches Vocabulary and Say it directly to the dashboard. Their order is deliberate: Vocabulary creates the widget headings first, then Say it adds its action. Neither tool is owned or loaded by Project Hub.

`scripts/cache-bust-turtlebot-plan.mjs` performs the final TurtleBot-specific cache update. Build stages remain separate so a feature cannot silently become responsible for an unrelated feature.

## Stable public assets

`project-data/` is copied recursively into `dist/project-data/`. Files in this directory are either public project data or browser assets with stable deployed URLs. New reusable source should normally be created under `src/features/`; do not add a new cross-feature loader merely to preserve an old URL.

## Test compatibility

Some older regression tests intentionally inspect previous root filenames. `scripts/run-tests.mjs` creates temporary local symlinks while tests run and removes them afterward. These compatibility files are never committed and do not clutter the repository.

## Removed fallback

The root GitHub Pages entry files and `.nojekyll` were removed. Production and development now use the Cloudflare build exclusively.
