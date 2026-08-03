# Joy Web Manager Developer — Setup

## Import URL

Sau khi branch này được merge vào `main`, import schema:

```text
https://raw.githubusercontent.com/vah103/joy-personal-dashboard/main/docs/gpt-builder/joy-web-manager-developer-openapi-v1.json
```

## Authentication

- Type: API Key
- Auth type: Bearer
- Header: Authorization
- Value: private `JOY_GPT_ACTION_KEY`

Không dùng `JOY_GITHUB_TOKEN`, `OPENAI_API_KEY` hoặc Cloudflare token trong GPT Builder.

## Required scopes

Chạy trên máy local:

```bash
cd ~/joy-personal-dashboard
npx wrangler secret put JOY_GPT_ACTION_SCOPES
```

Nhập giá trị:

```text
project:read,task:read,milestone:read,log:read,evidence:read,workspace:read,repository:read,repository:branch:create,repository:write,repository:checks:run,repository:pr:create
```

Sau đó deploy Worker từ committed `origin/main`.

## GPT Builder

1. Thay schema read-only hiện tại bằng developer schema.
2. Thay Instructions bằng nội dung `joy-web-manager-developer-instructions.md`.
3. Giữ Privacy Policy:

```text
https://app.hey-joy.workers.dev/api/joy/v1/privacy
```

4. Giữ visibility `Only me`.

## Test

Gửi yêu cầu:

```text
Đọc repository Joy hiện tại, tạo protected branch, thêm một thay đổi documentation nhỏ, chạy full checks và mở draft PR. Không merge hoặc deploy.
```

Kết quả mong đợi:

```text
repository read → branch → atomic commit → successful checks → draft PR
```
