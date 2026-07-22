# Joy Personal Dashboard

A responsive personal dashboard for Vanh, covering Gmail, sales viewings, active projects, and daily tasks.

## Features

- Connect a Google account and show up to five unread inbox messages.
- Pin important messages to the top or mark them as read to hide them from Joy.
- Add and complete daily tasks.
- Add or archive projects.
- Confirm or return a sample viewing to pending.
- Keep changes in the current browser using `localStorage`.

## Gmail privacy

The Gmail connection requests only `gmail.readonly`. Its short-lived access token is kept in memory and is never written to GitHub or `localStorage`. Closing or refreshing the tab requires connecting again. Joy cannot send, modify, or delete email. Pin and hidden-message preferences store message IDs only; they do not store message content or change the message inside Gmail.

Sales data is still sample data. Projects and to-do items are local to the current browser.
