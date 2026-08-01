# OpenAI language tools

Joy uses OpenAI only for the language work where GPT quality matters most.

## Runtime policy

| Feature | OpenAI model | Output cap | Cache | Fallback |
| --- | --- | ---: | --- | --- |
| Vocabulary | `gpt-5-mini` | 220 tokens | 365 days | Cloudflare Workers AI |
| Say it | `gpt-4o-mini` | 60 tokens | 90 days | Cloudflare Workers AI |

Both routes:

- run only after an authenticated, same-origin user action;
- make at most one OpenAI request per cache miss;
- send no previous conversation history;
- set `store: false` on the Responses API request;
- keep the OpenAI key on the Worker only;
- return cached results without another AI call;
- fall back to the existing Workers AI binding when OpenAI is not configured or temporarily fails.

Vocabulary first checks the user's saved D1 words, then the private Cloudflare cache, and only then calls an AI model. Without context it returns at most two common Vietnamese meanings. With context it returns one meaning that fits the sentence.

Say it returns exactly one English sentence. The optional tone is one of `natural`, `casual`, `polite`, or `work`. The Hear button uses browser `speechSynthesis`; it does not call OpenAI audio APIs.

## Production secret

Use the existing Worker secret name shared with IELTS transcription:

```bash
cd ~/joy-personal-dashboard
npx wrangler secret put OPENAI_API_KEY
```

Never place the key in `wrangler.jsonc`, GitHub, browser JavaScript, screenshots, or chat messages.

Optional project-scoping headers are supported through `OPENAI_PROJECT_ID` and `OPENAI_ORGANIZATION_ID`, but neither is required for the language tools.

## Model overrides

The non-secret defaults live in `wrangler.jsonc`:

```json
{
  "OPENAI_VOCABULARY_MODEL": "gpt-5-mini",
  "OPENAI_SPEAKING_MODEL": "gpt-4o-mini"
}
```

Changing a model does not require frontend changes. Run the full verification suite and a Worker dry-run before deployment.
