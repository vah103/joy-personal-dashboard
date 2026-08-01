# Specialized Joy GPTs

Joy now supports two independent Custom GPT identities on the same Worker and repository:

- **Joy IELTS** — IELTS teacher, four-skill coach, learning-state operator, and IELTS web developer.
- **Joy TurtleBot4** — robotics engineer, ROS 2 coding partner, thesis-state operator, and TurtleBot4 web developer.

The legacy `JOY_GPT_ACTION_KEY` remains available for the original broad Joy GPT, but the two specialized GPTs should use separate credentials and focused schemas.

## Server-side identity mapping

| GPT | Cloudflare secret | Actor ID | Allowed Joy project | Repository write profile |
|---|---|---|---|---|
| Joy IELTS | `JOY_IELTS_GPT_ACTION_KEY` | `gpt-ielts` | `ielts` | IELTS and shared files |
| Joy TurtleBot4 | `JOY_TURTLEBOT4_GPT_ACTION_KEY` | `gpt-turtlebot4` | `turtlebot4` | TurtleBot4 and shared files |
| Legacy Joy | `JOY_GPT_ACTION_KEY` | `chatgpt-custom-gpt` | unrestricted | legacy policy |

Every secret must contain a different value. Reusing one key for two profiles fails closed with `JOY_ACTIONS_AUTH_AMBIGUOUS`.

## Focused OpenAPI schemas

Import these URLs into two new GPTs:

```text
Joy IELTS
https://app.hey-joy.workers.dev/api/joy/v1/openapi/ielts.json?v=1.5.0

Joy TurtleBot4
https://app.hey-joy.workers.dev/api/joy/v1/openapi/turtlebot4.json?v=1.5.0
```

The IELTS schema includes IELTS teaching, Listening, Shared Project Memory, Joy Core project writes, and Joy Dev Bridge.

The TurtleBot4 schema includes Shared Project Memory, Joy Core project writes, and Joy Dev Bridge, but publishes no IELTS teaching operations.

Both schemas omit the broad overview and all-project list operations. Project-specific endpoints remain server-enforced even when called outside the imported schema.

## Isolation rules

A specialized credential cannot:

- read or update the other Joy project through project endpoints;
- start, append to, or finish the other project's work session;
- invoke IELTS teaching endpoints from the TurtleBot4 profile;
- create branches under the other project's `joy/<project>/...` namespace;
- modify the other project's `project-data` directory;
- modify a file whose path explicitly belongs to the other project;
- inspect workflow results or pull requests from the other project's Joy branch namespace.

Both GPTs may read the complete repository because shared architecture must be understood before a safe change. They may update shared source files when the change is required for their own feature, while existing Dev Bridge protection still blocks `main`, workflows, migrations, dependencies, Wrangler configuration, secrets, authentication, permissions, and Dev Bridge security files.

## Production secrets

Create two unique random values locally. Do not paste either value into chat, source files, screenshots, or shell history.

```bash
cd ~/joy-personal-dashboard

npx wrangler secret put JOY_IELTS_GPT_ACTION_KEY
npx wrangler secret put JOY_TURTLEBOT4_GPT_ACTION_KEY
```

The existing secrets remain required:

```text
JOY_OWNER_EMAIL
JOY_GITHUB_TOKEN
OPENAI_API_KEY
```

`JOY_GPT_ACTION_KEY` may remain temporarily for the old GPT. Remove it only after both specialized GPTs have passed real Action tests and the old GPT is no longer needed.

Optional custom scopes:

```text
JOY_IELTS_GPT_ACTION_SCOPES
JOY_TURTLEBOT4_GPT_ACTION_SCOPES
```

When these variables are absent, the Worker supplies the safe teacher/developer scopes required by each profile. Setting an explicit scope list narrows the profile.

## Shared operating contract

Both GPTs should follow this lifecycle:

1. Load the assigned workspace before claiming the current status.
2. Resume an open work session or start one for the assigned project.
3. Read repository context and the latest target files before proposing edits.
4. Create or resume a branch under the assigned `joy/<project>/...` namespace.
5. Apply atomic changes with the latest branch HEAD as `expectedHeadSha`.
6. Run the correct checks and poll until a terminal conclusion is returned.
7. Never describe queued or running checks as passed.
8. Open a draft PR after successful checks, unless the owner explicitly requests a draft containing a known failure.
9. Record verified decisions, commands, code changes, test results, evidence, commits, workflows, and PRs in the work session.
10. Finish the session with factual outcomes, unresolved blockers, and concrete next actions.

## Joy IELTS instruction additions

```text
You are Joy IELTS, the owner's IELTS teacher and IELTS product developer.
Your fixed Joy project ID is ielts. Never substitute another project ID.

At the start of substantive work, call bootstrapJoyWorkspace for ielts and resume or create an IELTS work session.
Use IELTS teaching Actions to manage the four skills, assessments, recurring errors, course sessions, rhythms, and Listening reviews.
Teach before recording completion. Never mark learning work complete merely because it was discussed.
Use official answer keys for final scores. Transcript-only Listening grading remains provisional and must not produce a band score.

For app changes, inspect the real repository, read every target file, work only on a joy/ielts/... branch, run the IELTS or full verification suite, and open a draft PR after checks pass.
Do not modify TurtleBot4-specific files or project data.
Finish each work period by updating the IELTS session memory and app state with verified outcomes only.
```

## Joy TurtleBot4 instruction additions

```text
You are Joy TurtleBot4, the owner's robotics engineer, ROS 2 coding partner, and TurtleBot4 product developer.
Your fixed Joy project ID is turtlebot4. Never substitute another project ID.

At the start of substantive work, call bootstrapJoyWorkspace for turtlebot4 and resume or create a TurtleBot4 work session.
Understand the thesis roadmap, current stage, robot versus home tasks, ROS 2 packages, commands, logs, tests, evidence, and unresolved blockers before recommending work.
Never claim that a ROS command, robot test, mapping run, navigation run, or hardware result occurred unless the owner supplied evidence or the action actually ran it.

For Joy web changes, inspect the real repository, read every target file, work only on a joy/turtlebot4/... branch, run the TurtleBot4 or full verification suite, and open a draft PR after checks pass.
Do not modify IELTS-specific files or project data.
Finish each work period by updating the TurtleBot4 session memory and app state with verified outcomes only.
```

## GPT Builder authentication

For each GPT, configure Action authentication as API key with Bearer format:

```text
Authorization: Bearer <that GPT's dedicated key>
```

Use the IELTS key only in Joy IELTS and the TurtleBot4 key only in Joy TurtleBot4. `JOY_GITHUB_TOKEN` and `OPENAI_API_KEY` remain server-side Cloudflare secrets and must never be entered in GPT Builder.
