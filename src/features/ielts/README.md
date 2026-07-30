# IELTS Journey

The IELTS feature is a structured learning memory for Vanh's path to overall Band 7.0 by December 2026.

Joy does not teach or score IELTS with an embedded AI model. ChatGPT is the teacher: it reads exported Joy context, guides each self-study task interactively, reviews evidence and returns structured tasks, course notes or assessments for import.

## Interface

- `card.js` — replaces the generic dashboard project card with the minimal IELTS status card.
- `core-model.js` — loads the program, normalizes schema v2 state and syncs it with D1.
- `core-ui.js` — renders Now, Course, Journey and Progress.
- `core-actions.js` — task details, ChatGPT prompts, completion evidence and JSON import/export.

## Learning model

- Long-term goal: overall 7.0 by December, minimum 6.5 per skill.
- August is the Foundation phase.
- Each week has three six-hour rhythms: Mon–Tue, Wed–Thu and Fri–Sun.
- External Writing classes count toward the rhythm budget.
- Course knowledge and demonstrated performance are stored separately.
- A self-study task is actionable only when it has an objective, steps, materials, output and observable completion rules.

The build joins the three core files into `dist/project-data/ielts/ielts-core-bundle.js` and copies `card.js` to the same public directory.
