# Joy Cloudflare Setup

This setup keeps GitHub as the source repository and deploys Joy as a secure Cloudflare Worker with static assets, D1 storage, automatic Gmail synchronization, Google Sheets access, and persistent authorization.

## Security rules

- Never commit `.dev.vars`.
- Never paste the Google Client Secret, token encryption secret, access token, or refresh token into GitHub or chat.
- Store secrets only with `wrangler secret put` or in Cloudflare's encrypted Secrets interface.
- Keep `ALLOWED_EMAIL` set to the single Gmail account that may open Joy.

## 1. Prepare Cloudflare

From the repository directory:

```bash
npm install
npx wrangler login
npx wrangler d1 create joy-dashboard
```

Copy only the returned D1 `database_id` into `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`. The database ID is not a password.

Apply the database migration:

```bash
npm run db:migrate:remote
```

Deploy once to receive the permanent `workers.dev` URL:

```bash
npm run deploy
```

## 2. Configure Google OAuth

Use a **Web application** OAuth client. The server-side authorization flow requires both its Client ID and Client Secret. If the existing secret was not saved when the client was created, create a new Web application client and download its JSON immediately.

In Google Auth Platform > Clients, add this authorized redirect URI:

```text
https://YOUR-WORKER.workers.dev/auth/callback
```

In Google Auth Platform > Data Access, keep these scopes:

```text
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/spreadsheets.readonly
```

Enable both **Gmail API** and **Google Sheets API** in the same Google Cloud project. The Gmail account in `ALLOWED_EMAIL` must have access to the required spreadsheets.

In Google Auth Platform > Audience, publish the app to **In production**. Testing-mode authorizations that include Gmail access expire after seven days. Joy is still limited to the email stored in `ALLOWED_EMAIL`.

## 3. Store Worker secrets

Run each command and paste the value only into the private terminal prompt:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put ALLOWED_EMAIL
npx wrangler secret put TOKEN_ENCRYPTION_SECRET
npx wrangler secret put SALE_SPREADSHEET_ID
npx wrangler secret put VAPID_SUBJECT
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

For `SALE_SPREADSHEET_ID`, enter only the ID from the Sheet URL. It is not a password, but storing it as a Worker secret keeps the private file identifier out of the public repository.

Generate the token encryption secret locally:

```bash
openssl rand -base64 48
```

Deploy the final configuration:

```bash
npm run deploy
```

## 4. Connect services

Open the Worker URL and sign in with the Google account stored in `ALLOWED_EMAIL`. Gmail and Google Sheets permissions are connected separately from the account menu. Joy then:

- keeps refresh tokens encrypted in D1;
- keeps a secure, HTTP-only browser session;
- synchronizes Gmail and Sheets data with scheduled Worker jobs;
- stores project, scratchpad, task, Pin, and Read state in D1;
- evaluates the three-state weather notification logic throughout the day;
- serves the frontend generated from `src/` into `dist/` by `npm run build`.

The repository is Cloudflare-first; GitHub Pages is no longer used as a deployment fallback.

If Google displays an unverified-app warning, continue only after confirming the project name, Worker URL, and requested read-only permissions belong to this Joy project.
