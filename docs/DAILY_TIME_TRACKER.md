# Daily Time Tracker

Daily Time Tracker is a separate, authenticated stopwatch feature in the Joy
dashboard. It does not alter Daily Day schedules, checklists, workout records,
or streaks.

## Daily allocation

| Activity | Hours per day |
| --- | ---: |
| Sleep | 8 |
| Housework | 3 |
| Earning money | 2 |
| Gym | 2 |
| Relaxing | 1 |
| Thesis | 4 |
| English | 1 |
| Learning AI | 2 |
| Career research | 1 |

The first five activities plus the four study activities total 24 hours.
Study (8 hours) is a derived total, **not** a tenth running clock. English,
AI and career have independent cumulative totals and budgets, but all nine
activities share one exclusive active timer. Clicking the running activity
pauses it; clicking another activity closes the previous session and starts
the selected one. Passing a budget displays an overrun without stopping time.

## Persistence and calendar rules

- Source: `worker/time-tracker.js`, `worker/time-tracker-core.js`.
- UI: `src/features/time-tracker/`, integrated in the dashboard source.
- D1 schema: `migrations/20261111_daily_time_tracker.sql`.
- `GET /api/time-tracker`: server snapshot with today's totals and recent
  completed sessions.
- `POST /api/time-tracker/switch`: `{ "activity": "thesis" | null,
  "expectedVersion": number }`. A null activity pauses the timer.
- Each request requires a valid owner session. Writes require same origin.
- D1 tracks the single active timer and records closed sessions. Switching is
  version-checked to prevent overlapping timers across devices; stale writes
  return HTTP 409 with a fresh snapshot.
- The day resets at 00:00 Asia/Ho_Chi_Minh (UTC+7). A session crossing midnight
  is allocated to the correct day by time intersection, without truncating the
  underlying session or silently stopping it.
- Closing a page does not pause the timer. The Worker calculates elapsed time
  from server timestamps. The UI only animates the server-authoritative total.
- A local preview without authentication shows the unavailable/sign-in state;
  it never silently persists private timer data in public project assets.

## Verification

`node --test test/time-tracker.test.mjs` covers budgets, midnight intersection,
authenticated switching, stale-device conflicts, authorization, and dashboard
wiring. Run `npm run i18n:check`, `npm test`, `npm run db:migrate:smoke`, and
`npm run build` before preparing a deploy. Apply the additive migration in the
normal reviewed remote deployment procedure. Do not deploy automatically.
