# Joy Personal Dashboard

A responsive personal dashboard for Vanh, covering Gmail, sales viewings, active projects, and daily tasks.

## Features

- Connect a Google account and show up to five unread inbox messages.
- Pin important messages to the top or mark them as read to hide them from Joy.
- Show every not-yet-passed room viewing from `Sale phòng | GPTs` in Sheet row order.
- Open a private detail modal with the same six columns as the `Appointments` tab.
- Add and complete daily tasks.
- Add or archive projects.
- Confirm or return a sample viewing to pending.
- Keep changes in the current browser using `localStorage`.

## Gmail privacy

The Gmail connection requests only `gmail.readonly`. Its short-lived access token is kept in memory and is never written to GitHub or `localStorage`. Closing or refreshing the tab requires connecting again. Joy cannot send, modify, or delete email. Pin and hidden-message preferences store message IDs only; they do not store message content or change the message inside Gmail.

Live Sales data is available only through the authenticated Cloudflare build. Past appointments are filtered using Vietnam time and the list refreshes once per minute. Projects and to-do items are still local to the current browser.

## Cloudflare architecture

The repository now includes an optional production architecture under `worker/`:

- Cloudflare Workers serves the API and built frontend.
- D1 stores encrypted OAuth tokens, sessions, cached email metadata, and application data.
- Gmail is synchronized every minute by a Cron Trigger.
- The browser polls the same-origin API every minute without storing Google tokens.
- Google Sheets is read through the same server-side OAuth token using read-only access.
- The original GitHub Pages build continues to use the browser-only Gmail connection as a fallback.

See `CLOUDFLARE_SETUP.md` for the one-time deployment procedure. Do not place OAuth client secrets or refresh tokens in the repository.
