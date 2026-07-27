# IELTS feature

This directory is the single source of truth for the IELTS Coach frontend JavaScript.

## Source files

- `card.js` — enhances the dashboard card and opens the coach.
- `core-model.js` — curriculum loading, state normalization, persistence, dates, and progress.
- `core-ui.js` — Today, Roadmap, Practice Log, and Joy Coach rendering.
- `core-actions.js` — task completion, reviews, modal actions, and public `window.JoyIELTS` methods.
- `core-diagnostic.js` — learner profile and four-skill baseline workflows.
- `core-writing-review.js` — Writing AI review, evidence, score freshness, and Error Log import.
- `core-writing-rewrite.js` — the required adaptive rewrite mission.

## Build behavior

`scripts/build.mjs` bundles the six `core-*` files into:

```text
/project-data/ielts/ielts-core-bundle.js
```

It also copies `card.js` to the stable public URL:

```text
/project-data/ielts/ielts-card.js
```

The generated files exist only in `dist/` and are not committed. Keeping the public URLs stable prevents browser, service-worker, and deployment regressions while allowing source code to remain organized under `src/features/`.

## Validation

- `scripts/validate-ielts-sources.mjs` compiles the combined bundle before every build.
- `scripts/run-tests.mjs` checks every IELTS source file and runs the regression suite.
- `npm run deploy` cannot reach Wrangler unless tests and the build-time validation pass.

Curriculum JSON, public styles, and card artwork remain in `project-data/ielts/` because they are copied directly as public project data/assets.
