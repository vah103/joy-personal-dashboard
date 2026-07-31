# Joy GPT Actions release checklist

- [ ] Stage A PR is merged.
- [ ] Stage B CI is green.
- [ ] Remote D1 migrations are applied.
- [ ] `JOY_GPT_ACTION_KEY` is configured as a Cloudflare secret.
- [ ] `JOY_OWNER_EMAIL` is configured as a Cloudflare secret.
- [ ] Health endpoint reports `configured: true`.
- [ ] OpenAPI schema imports successfully in the Custom GPT editor.
- [ ] Read-only overview and project operations are tested first.
- [ ] One approved idempotent task creation is tested.
- [ ] One version-checked task update is tested.
- [ ] The GPT remains private until all checks pass.
