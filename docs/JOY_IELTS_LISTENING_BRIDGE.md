# Joy IELTS Listening Submission Bridge

## Goal

Allow the owner to stay inside Custom GPT Joy, attach one IELTS Listening audio file plus screenshots of the questions/entered answers, and ask Joy to grade the attempt.

```text
GPT Joy conversation files
  -> prepareIeltsListeningSubmission
  -> temporary OpenAI file URL (valid for five minutes)
  -> Joy Worker downloads only the audio
  -> OpenAI Audio transcription
  -> private IELTS Core draft submission
  -> GPT Joy grades from screenshots + transcript
  -> saveIeltsListeningReview
  -> owner confirmation
  -> existing assessment/error/task actions
```

## File handling

GPT Actions sends conversation files only when the request property is named `openaiFileIdRefs`. The OpenAPI schema declares it as an array of strings; at runtime ChatGPT expands each entry into an object containing `name`, `id`, `mime_type`, and `download_link`.

Joy applies the following controls:

- maximum 10 conversation files;
- exactly one supported audio file;
- maximum audio size 25 MB;
- HTTPS download links restricted to `*.oaiusercontent.com`;
- redirects rejected to reduce SSRF risk;
- temporary download links are never stored;
- screenshots and documents are recorded only as file metadata because GPT Joy reads them directly in the conversation;
- the audio is sent to the OpenAI Audio transcription endpoint and the returned transcript is stored privately in IELTS Core.

Supported audio extensions are `flac`, `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `ogg`, `wav`, and `webm`. The default model is `gpt-transcribe`; it can be overridden with `OPENAI_TRANSCRIPTION_MODEL`.

## State compatibility

No D1 migration is required. Listening submissions are stored inside the existing normalized IELTS state under the internal key:

```text
rhythmReviews.__joyListeningSubmissions
```

The service exposes this through a non-enumerable `listeningSubmissions` adapter. This keeps the current schema-v2 web client from deleting GPT-created Listening drafts during its normal GET/PUT cycle.

## Actions

### `prepareIeltsListeningSubmission`

Input:

- exact IELTS `taskId`;
- all relevant conversation attachments through `openaiFileIdRefs`;
- learner answers copied exactly from the screenshots;
- stable `clientRequestId`.

Output:

- private submission id;
- transcript;
- sanitized file metadata;
- exact learner answers;
- state version.

The action is idempotent by `clientRequestId`. Retrying the same request returns the existing transcript instead of paying for another transcription.

### `getIeltsListeningSubmission`

Reads a prior submission by id, including its transcript and draft review.

### `saveIeltsListeningReview`

Stores per-question grading, explanations, transcript evidence, a summary, and draft recurring errors.

Two grading modes are supported:

- `official-key`: an official answer key is available; a band score may be stored.
- `provisional-transcript`: no official answer key is available; a band score is rejected and uncertainty must be stated.

Saving a review does not create an IELTS assessment, recurring-error record, or task completion. GPT Joy must ask the owner to confirm first, then use the existing actions.

## Required Cloudflare secret

```bash
cd ~/joy-personal-dashboard
npx wrangler secret put OPENAI_API_KEY
```

Paste the OpenAI Platform API key only into the Wrangler prompt. Do not put it in Git, GPT instructions, the Action API-key field, screenshots, or chat messages.

Optional model override:

```toml
[vars]
OPENAI_TRANSCRIPTION_MODEL = "gpt-transcribe"
```

The default already uses `gpt-transcribe`, so the variable is normally unnecessary.

## Custom GPT instructions

Add this workflow to GPT Joy's Instructions:

```text
When the owner attaches IELTS Listening audio and answer screenshots:
1. Read the screenshots yourself. Copy every entered answer exactly, preserve spelling, use an empty string for a blank, and mark uncertain=true only when the image is unclear.
2. Read the current IELTS task before processing the attempt.
3. Call prepareIeltsListeningSubmission with all relevant attachments in openaiFileIdRefs, exactly one audio file, the copied answers, and a stable clientRequestId.
4. Compare the questions/screenshots, learner answers, and returned transcript. Treat the transcript as explanatory evidence, not an official answer key.
5. Use official-key only when an official answer key is visibly supplied. Otherwise use provisional-transcript, do not report a band score, and state uncertainty.
6. Call saveIeltsListeningReview with a result and explanation for every visible question.
7. Show the grading to the owner and ask for confirmation.
8. Only after confirmation may you call addIeltsAssessment, addIeltsRecurringError, or completeIeltsTask. Never invent a score, answer key, evidence, or completion.
```

## Deployment

No database migration is needed.

```bash
cd ~/joy-personal-dashboard
git pull --ff-only origin main
npx wrangler secret put OPENAI_API_KEY
npm run deploy
```

After deployment, re-import:

```text
https://app.hey-joy.workers.dev/api/joy/v1/openapi.json?v=1.2.0
```

Expected new operation ids:

- `prepareIeltsListeningSubmission`
- `getIeltsListeningSubmission`
- `saveIeltsListeningReview`

## Preview test

Attach one supported audio file and the answer screenshots, then send:

```text
Chấm bài Listening này. Hãy đọc nguyên văn đáp án tôi đã điền, không tự điền câu trống. Nếu không có answer key chính thức thì chỉ chấm provisional, không quy đổi band. Chưa cập nhật assessment hoặc hoàn thành task cho đến khi tôi xác nhận.
```
