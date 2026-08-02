# Joy IELTS Google Docs review tabs

Joy IELTS writes reviews only to this fixed document:

- Title: `New Ielts new me | Vanh`
- Document ID: `1y_WC_yO7xFyFoniGUt3yISgLxq6mP3hBQFWahSzSueQ`
- URL: `https://docs.google.com/document/d/1y_WC_yO7xFyFoniGUt3yISgLxq6mP3hBQFWahSzSueQ/edit`

Every successful `saveIeltsReviewDocument` call creates a new root tab and returns a direct URL to that tab. Existing tabs are never overwritten. Retrying the same `clientRequestId` returns the previous tab instead of creating a duplicate.

## One-time Google Apps Script setup

1. Open the fixed Google Doc.
2. Choose **Extensions → Apps Script**.
3. Replace `Code.gs` with `integrations/google-apps-script/ielts-review-docs/Code.gs` from this repository.
4. Enable the manifest in **Project Settings → Show appsscript.json**, then replace it with `integrations/google-apps-script/ielts-review-docs/appsscript.json`.
5. In **Project Settings → Script properties**, add:
   - Property: `JOY_IELTS_DOCS_WEBHOOK_SECRET`
   - Value: a new random secret, for example from `openssl rand -hex 32`
6. Deploy as a Web app:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy the `/exec` deployment URL. Do not use the `/dev` URL.

The Web app is public only at the network layer. Requests still require the long webhook secret, the document ID is pinned in both Worker and Apps Script, and the script cannot be instructed to write to another document.

## Cloudflare secrets

Use the exact same webhook secret configured in Apps Script:

```bash
cd ~/joy-personal-dashboard

npx wrangler secret put JOY_IELTS_DOCS_WEB_APP_URL
# Paste the Apps Script /exec URL.

npx wrangler secret put JOY_IELTS_DOCS_WEBHOOK_SECRET
# Paste the same random secret stored in Apps Script properties.
```

Then deploy the Worker:

```bash
npm run deploy
```

No D1 migration is required.

## GPT Builder

Re-import the Joy IELTS Action schema because this release adds one operation. The extra query value bypasses the previous Builder cache while keeping the current compatible schema version:

```text
https://app.hey-joy.workers.dev/api/joy/v1/openapi/ielts.json?v=1.5.0&profile=joy-ielts-v1&feature=ielts-docs-v1
```

Keep Authentication as **API Key → Bearer** using `JOY_IELTS_GPT_ACTION_KEY`.

Add this rule to the Joy IELTS Instructions:

```text
DOCUMENT REVIEW EXPORT

When the owner asks to save a verified IELTS lesson, result, or daily review, call saveIeltsReviewDocument. Write only verified information, include source/test links and distinguish official scores from practice or estimates. The Action always creates or reuses one tab in the fixed document. Return the documentUrl from the Action and never claim that the document was saved without a successful Action result.
```

## Expected request

```json
{
  "date": "2026-08-02",
  "tabTitle": "02-08-2026 · IELTS Review",
  "content": "Listening ...\n\nReading ...\n\nErrors to review ...",
  "clientRequestId": "ielts-review-2026-08-02-v1"
}
```

## Acceptance test

Ask Joy IELTS:

```text
Lưu tổng hợp IELTS hôm nay vào file Docs cố định. Hãy tạo tab mới, ghi kết quả và nhận định đã xác minh, rồi gửi tôi link mở thẳng tab. Không chỉ đưa nội dung để tôi tự dán.
```

A valid response must include a `documentUrl` containing the fixed document ID and a `tab=` query parameter.
