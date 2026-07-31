# Joy IELTS Bridge

## Purpose

The IELTS Bridge lets GPT Joy teach from and write back to the same IELTS Journey state used by the Joy web app.

```text
GPT Joy Actions
  ↕
/api/joy/v1/ielts/*
  ↕
IELTS Bridge
  ↕
ielts_core_states
  ↕
IELTS Journey web UI
```

It does not create a second IELTS database and it does not replace Joy Core project summaries.

## Teaching workflow

1. GPT calls `getIeltsToday` before planning or teaching.
2. GPT reads the exact baseline or rhythm, learner evidence, recurring errors, and course knowledge.
3. GPT calls `getIeltsTeachingTask` before teaching the selected task.
4. GPT teaches one step at a time and waits for the learner's response.
5. GPT marks the task started only when the learner begins.
6. GPT marks the task complete only after the learner confirms completion and supplies factual evidence and reflection.
7. GPT may save an assessment, recurring error, or reviewed course session.
8. After baseline or assessment evidence, GPT may personalise only the current or next allowed rhythm. The personalised self-study total cannot exceed six hours, and external course tasks remain intact.

## Actions

- `GET /api/joy/v1/ielts/today`
- `GET /api/joy/v1/ielts/tasks/:taskId`
- `POST /api/joy/v1/ielts/tasks/:taskId/start`
- `POST /api/joy/v1/ielts/tasks/:taskId/complete`
- `POST /api/joy/v1/ielts/assessments`
- `POST /api/joy/v1/ielts/errors`
- `POST /api/joy/v1/ielts/course-sessions`
- `PUT /api/joy/v1/ielts/rhythms/:rhythmId/tasks`

All routes use the existing `JOY_GPT_ACTION_KEY` and `JOY_OWNER_EMAIL` mapping.

## Safety rules

- No IELTS delete endpoint exists.
- GPT must not invent completion, scores, evidence, or teacher feedback.
- Estimated band scores must be identified as estimates in assessment evidence.
- Task completion requires actual time, evidence, and reflection.
- Personalised rhythm tasks are restricted to the current or next permitted rhythm.
- Personalised self-study cannot exceed 360 minutes per rhythm.
- Course tasks from the published program are preserved.
- State updates use optimistic concurrency and retry against the current IELTS state.

## Custom GPT configuration

After production deployment, refresh the Custom GPT Action schema from:

```text
https://app.hey-joy.workers.dev/api/joy/v1/openapi.json
```

Recommended instruction block:

```text
For every IELTS request, call getIeltsToday before planning or teaching.
Use the exact task, objective, steps, materials, output, and doneWhen from Joy.
Teach interactively: explain briefly, give one step or exercise, wait for my answer, correct it, then continue.
Call getIeltsTeachingTask before teaching a selected task.
Mark a task started only when I actually begin.
Mark a task completed only after I confirm completion and provide factual evidence and reflection.
Never invent a score, result, completion, evidence, or course feedback.
Save recurring errors with their cause and one prevention action.
Save external course knowledge separately as summary, method, feedback, homework, and next practice.
Personalise rhythm tasks only after reviewing baseline or assessment evidence and keep self-study within six hours.
```

## Deployment

No new database migration, Cloudflare binding, dependency, or secret is required.

```bash
cd ~/joy-personal-dashboard
git pull --ff-only origin main
npm run deploy
```

## Smoke checks

Public schema:

```bash
curl -s https://app.hey-joy.workers.dev/api/joy/v1/openapi.json \
  | grep -o 'getIeltsToday' \
  | head
```

Authenticated teaching context, run locally without printing the key:

```bash
read -s JOY_KEY
curl -s \
  -H "Authorization: Bearer $JOY_KEY" \
  https://app.hey-joy.workers.dev/api/joy/v1/ielts/today
unset JOY_KEY
```
