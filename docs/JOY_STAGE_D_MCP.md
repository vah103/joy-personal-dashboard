# Joy Stage D — Remote MCP

Stage D exposes Joy Core as a private remote Model Context Protocol server so MCP-compatible clients can use the same structured project memory as the Joy dashboard and Custom GPT.

## Endpoint

- MCP Streamable HTTP: `https://app.hey-joy.workers.dev/mcp`
- Public configuration check: `https://app.hey-joy.workers.dev/mcp/health`

The server is stateless and does not issue an `Mcp-Session-Id`. It supports MCP protocol versions `2025-11-25`, `2025-06-18`, and `2025-03-26`, negotiating the latest supported version when needed.

## Authentication

The MCP endpoint uses the existing private Joy assistant bearer credential:

```http
Authorization: Bearer <JOY_GPT_ACTION_KEY>
```

The Worker also requires `JOY_OWNER_EMAIL` to map the assistant to the owner's Joy Core account. No new Cloudflare secret or database migration is required.

Never commit the bearer key to the repository, documentation, screenshots, shell history, or client configuration files that may be shared.

## Tools

Read tools:

- `get_overview`
- `list_projects`
- `get_project`

Safe write tools:

- `update_project`
- `create_task`
- `update_task`
- `create_milestone`
- `update_milestone`
- `append_progress_log`
- `attach_evidence`

The MCP surface intentionally contains no delete, remove, archive, or destructive tool. Tool annotations mark reads as read-only and all tools as non-destructive.

## Shared data path

```text
MCP client / ChatGPT App
          ↓
        /mcp
          ↓
   Joy Core service
          ↓
 Cloudflare D1 joy_core_*
          ↕
Custom GPT Actions + Joy web
```

Writes use the same role permissions, optimistic versions, idempotency keys, normalization, and audit records as the existing Joy Actions API.

## Testing with MCP Inspector

Start the official inspector locally:

```bash
npx @modelcontextprotocol/inspector@latest
```

Connect to:

```text
https://app.hey-joy.workers.dev/mcp
```

Configure the request header without sharing the value:

```text
Authorization: Bearer <saved JOY_GPT_ACTION_KEY>
```

Expected flow:

1. Initialize.
2. Send the initialized notification.
3. List tools and confirm 10 tools.
4. Call `get_overview`.
5. Call `get_project` for `turtlebot4`.
6. Create one harmless test task with a unique `clientRequestId`.
7. Read the project again and verify the task appears in the Joy dashboard.

## Manual curl smoke tests

Health does not require the private key:

```bash
curl -s https://app.hey-joy.workers.dev/mcp/health
```

Initialize with the key supplied locally through an environment variable:

```bash
export JOY_MCP_KEY='your-saved-key'

curl -s https://app.hey-joy.workers.dev/mcp \
  -H "Authorization: Bearer $JOY_MCP_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2025-11-25",
      "capabilities":{},
      "clientInfo":{"name":"joy-smoke-test","version":"1.0.0"}
    }
  }'
```

List tools:

```bash
curl -s https://app.hey-joy.workers.dev/mcp \
  -H "Authorization: Bearer $JOY_MCP_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Remove the shell variable after testing:

```bash
unset JOY_MCP_KEY
```

## ChatGPT availability note

The remote server is client-independent and can be tested through MCP Inspector or an application using OpenAI's remote MCP tool. Whether it can be added directly as a custom ChatGPT app depends on the user's ChatGPT plan, workspace permissions, developer-mode availability, and the authentication mechanisms accepted by that client.

As of the Stage D implementation date, full custom MCP write actions in ChatGPT are primarily available through supported workspace plans. The existing Custom GPT Actions integration remains the working personal ChatGPT interface until the account has direct custom-app access.

## Future OAuth upgrade

The current bearer credential is appropriate for the existing private single-owner deployment and command-line/API testing. A workspace-published ChatGPT App should use an OAuth 2.1/OIDC authorization server with refresh tokens, per-user consent, and scoped access. That upgrade can be added without replacing Joy Core or the MCP tools.
