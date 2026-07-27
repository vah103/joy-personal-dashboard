# IELTS public data and assets

This directory contains files that are copied directly to the public Cloudflare asset tree:

- `august-2026.json` — monthly plan metadata, rules, allocation, and weekly outcomes.
- `august-days-*.json` — the 31-day task curriculum.
- `ielts-card-background.webp` — dashboard card artwork.
- `ielts-*.css` — public card, coach, baseline, review, and rewrite styles.

Frontend JavaScript source does **not** live here. It is maintained in:

```text
src/features/ielts/
```

During `npm run build`, the IELTS source is compiled and copied back to stable public URLs under `/project-data/ielts/` inside `dist/`. Generated JavaScript files are intentionally not committed here.
