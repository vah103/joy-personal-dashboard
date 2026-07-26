# Joy Cloudflare Setup

This setup keeps GitHub as the source repository and deploys Joy as a secure Cloudflare Worker with static assets, D1 storage, automatic Gmail sync, and persistent Google authorization.

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

In Google Auth Platform > Data Access, keep the scope:

```text
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/spreadsheets.readonly
```

Enable both **Gmail API** and **Google Sheets API** in the same Google Cloud project. The Gmail account in `ALLOWED_EMAIL` must have access to the `Sale phòng | GPTs` spreadsheet.

In Google Auth Platform > Audience, publish the app to **In production**. Testing-mode authorizations that include Gmail access expire after seven days. Joy is still limited to the email stored in `ALLOWED_EMAIL`.

## 3. Store Worker secrets

Run each command and paste the value only into the private terminal prompt:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put ALLOWED_EMAIL
npx wrangler secret put TOKEN_ENCRYPTION_SECRET
npx wrangler secret put SALE_SPREADSHEET_ID
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

## 4. Connect once

Open the Worker URL, choose **Connect once**, select the email in `ALLOWED_EMAIL`, and approve read-only Gmail access. Joy then:

- keeps the refresh token encrypted in D1;
- keeps a secure, HTTP-only browser session;
- synchronizes Gmail every minute with a Cron Trigger;
- refreshes the visible dashboard automatically every minute;
- stores Pin and Read preferences in D1;
- reads upcoming appointments from the `Appointments` tab without modifying the Sheet;
- leaves the original GitHub Pages version untouched as a fallback.

If Google displays an unverified-app warning, continue only after confirming the project name, Worker URL, and requested `gmail.readonly` permission belong to this Joy project.
