# Joy Personal Dashboard — Project Context

Last updated: 2026-07-23

## 1. Project purpose

Joy is a private personal dashboard deployed with Cloudflare Workers.

Main functions:

- Gmail dashboard that starts empty and only surfaces newly received email
- Upcoming room viewings from Google Sheets
- Personal Finance dashboard
- 2026 Sale workspace
- To-do synchronization through Cloudflare D1
- Active Projects and Scratchpad
- Responsive desktop and mobile interface
- Entry animations and animated “Hey Joy!” greeting

## 2. Repository and deployment

GitHub repository:

- Repository: vah103/joy-personal-dashboard
- Main branch: main

Cloudflare deployment:

- Worker: joy-personal-dashboard
- URL: https://joy-personal-dashboard.vanh-joy-dashboard-2026.workers.dev
- D1 database binding: DB / joy-dashboard
- Deployment recorded on 2026-07-23:
  d5ce0542-6ba1-4e00-b258-283d0584c86e

Deployment command:

```powershell
npm.cmd test
npm.cmd run build
npx.cmd wrangler deploy --keep-vars
```

## 3. Current architecture

### Frontend

Main files:

- index.html
- app.js
- styles.css
- finance-demo.css
- finance-demo.js
- sale-manager.html
- sale-manager.css
- sale-manager.js
- site.webmanifest
- app icons
- wolf-mark.svg

### Cloudflare Worker

Main files:

- worker/index.js
- worker/finance-sales.js
- worker/todos.js
- worker/account-sync.js
- worker/gmail-sync.js

The Worker connects the frontend to:

- Cloudflare D1
- Gmail API
- Google Sheets API
- Finance spreadsheet
- Sale spreadsheet

### Database

Migrations:

- migrations/0001_initial.sql
- migrations/0002_tasks_sync.sql
- migrations/0003_account_sync.sql
- migrations/0004_projects_account_sync.sql
- migrations/0005_gmail_new_mail_window.sql

Gmail stores a per-account tracking start. Existing mail is cleared once when the
migration takes effect, and only mail received afterward is surfaced.

To-do records are synchronized through D1 so they appear across desktop and mobile.

Completed tasks remain available in history but are removed from the active dashboard list.

## 4. Finance and Sale

Finance includes:

- Available
- Income
- Expenses
- Gold
- Monthly pulse
- Sale income

Sale workspace includes:

- 2026 data
- July starts at 0 VND when no data exists
- Add/Edit writes back to the Sale sheet
- Two-row Sale sheet structure
- Commission calculation and validation

## 5. UI work completed

- Mature, premium dashboard visual direction
- Larger typography
- Nunito for data tables
- Finance layout redesign
- Sale workspace redesign
- Application icons and web manifest
- Animated page entrance
- “Hey Joy!” greeting animated character by character
- Greeting animation slowed down for readability
- Mobile To-do synchronization fixed

## 6. Tests

Current automated tests cover:

- Finance summary parsing
- Sale two-row normalization
- Sale commission validation
- Vietnam viewing-time parsing
- Invalid date rejection
- Viewing order
- Local task validation
- Empty task rejection
- Vietnam task-history date
- D1 completed-task mapping
- Gmail new-mail tracking cutoff
- Gmail Done action and SVG pin interface
- Compact same-day rain-window notice in the existing weather card

Run:

```powershell
npm.cmd test
```

Expected when this document was created:

- 32 tests
- 32 passed
- 0 failed

## 7. Important security rules

Never commit:

- Google OAuth client secrets
- Refresh tokens
- Cloudflare API tokens
- `.dev.vars`
- `.env` files
- Private spreadsheet contents
- D1 database exports containing user data
- Gmail content
- Customer personal data

Secret values belong in Cloudflare and are intentionally excluded from GitHub.

`wrangler deploy --keep-vars` preserves variables already configured in Cloudflare.

## 8. Important external resources

GitHub does not contain:

- Live Cloudflare D1 records
- Cloudflare secret values
- Gmail authorization tokens
- Live Google Sheets data
- ChatGPT conversation history

To continue development on another machine, access is also needed to the same:

- GitHub repository
- Cloudflare account
- Google Cloud OAuth project
- Google Sheets files

## 9. Setup on another Windows computer

```powershell
git clone https://github.com/vah103/joy-personal-dashboard.git
cd joy-personal-dashboard
npm.cmd install
npm.cmd test
npm.cmd run build
npx.cmd wrangler login
```

Before deploying, confirm Wrangler is connected to the correct Cloudflare account.

## 10. Next known UI task

On mobile, reorder the dashboard so that the desktop right-hand column appears before the left-hand column.

This mobile ordering change was discussed but should be verified before considering it completed.

## Phase 1 — To-do list and safe project deletion

- Main panel title is now `To-do list`.
- A completed task remains in its original chronological position on the completion date and throughout the following Vietnam calendar day.
- Completed tasks are checked and struck through; a task completed on day 23 remains visible through day 24 and disappears from the main list on day 25, while remaining in Task history.
- Project removal requires a custom confirmation modal.
- Project removal remains a soft delete through the existing archive API.
- Project IDs are compared as strings so UUID-based projects can be removed correctly.

## Active Project details v1

- TurtleBot 4 and IELTS project cards now open a responsive detail modal.
- The TurtleBot modal contains a local SVG illustration, a nine-stage roadmap, selected ROS 2 commands with copy controls and the 23/07/2026 robot log.
- TurtleBot source links open the exact roadmap and daily-log tabs in Google Docs.
- The IELTS modal contains Writing, Reading, Listening and Flashcards sections.
- Reading and Listening have prepared empty notebook states even before their first study entry exists.
- Google Docs remain the source for long-form notes; this first version uses curated summaries instead of fetching full documents at runtime.
- No D1 migration is required for this version.
