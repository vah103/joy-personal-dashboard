# IELTS feature

This directory is the single source of truth for the IELTS Coach frontend JavaScript.

## Core source files

- `card.js` — enhances the dashboard card and opens the coach.
- `core-model.js` — curriculum loading, state normalization, persistence, dates, and progress.
- `core-ui.js` — Today, Roadmap, Practice Log, and Joy Coach rendering.
- `core-actions.js` — task completion, reviews, modal actions, and public `window.JoyIELTS` methods.
- `core-diagnostic.js` — learner profile and four-skill baseline workflows.
- `core-writing-review.js` — Writing AI review, evidence, score freshness, and Error Log import.
- `core-writing-rewrite.js` — the required adaptive rewrite mission.

## Vietnamese localization

The user-facing IELTS Coach is displayed in Vietnamese while official IELTS prompts, quoted learner writing, corrected English sentences, and exam terminology remain in English where required.

- `i18n-vi-base.js` — Vietnamese labels, week summaries, learner preferences, and localization data container.
- `i18n-vi-days-01-09.js` — localized curriculum for 1–9 August.
- `i18n-vi-days-10-16.js` — localized curriculum for 10–16 August.
- `i18n-vi-days-17-23.js` — localized curriculum for 17–23 August.
- `i18n-vi-days-24-31.js` — localized curriculum for 24–31 August.
- `i18n-vi-plan-runtime.js` — applies Vietnamese curriculum data without changing the stored JSON.
- `i18n-vi-ui-text.js` — interface labels and guidance translations.
- `i18n-vi-hooks.js` — translates rendered UI, dates, status messages, and toasts.

The Writing reviewer instructs Workers AI to explain findings in Vietnamese while preserving exact English evidence and corrected English sentences.

## Build behavior

`scripts/build.mjs` bundles the core and localization files into:

```text
/project-data/ielts/ielts-core-bundle.js
```

It also copies `card.js` to the stable public URL:

```text
/project-data/ielts/ielts-card.js
```

The generated files exist only in `dist/` and are not committed. Stable public URLs prevent browser, service-worker, and deployment regressions while source code remains organized under `src/features/`.

## Validation

- `scripts/validate-ielts-sources.mjs` compiles the combined bundle before every build.
- `scripts/run-tests.mjs` checks every IELTS source file and runs the regression suite.
- `test/ielts-vietnamese-ui.test.mjs` verifies all 31 days are localized and English exam prompts remain unchanged.
- `npm run deploy` cannot reach Wrangler unless tests and build-time validation pass.

Curriculum JSON, public styles, and card artwork remain in `project-data/ielts/` because they are copied directly as public project data/assets.
