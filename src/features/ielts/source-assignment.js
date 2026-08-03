const IELTS_SOURCE_LIBRARY_URL = "/project-data/ielts/sources.json?v=ielts-source-catalog-v2";
let ieltsSourceLibraryPromise = null;

function isCheckedSourceTask(task) {
  return task?.skill === "listening" || task?.skill === "reading";
}

function sourceAssignmentFor(task) {
  const assignment = taskState(task).sourceAssignment;
  return assignment && typeof assignment === "object" ? assignment : null;
}

function sourceRequiresFullTest(task) {
  return task?.kind === "test"
    || String(task?.id || "").startsWith("baseline-")
    || /\bfull\b/i.test(String(task?.title || ""));
}

async function loadIeltsSourceLibrary() {
  if (!ieltsSourceLibraryPromise) {
    ieltsSourceLibraryPromise = requestJson(IELTS_SOURCE_LIBRARY_URL).catch((error) => {
      ieltsSourceLibraryPromise = null;
      throw error;
    });
  }
  return ieltsSourceLibraryPromise;
}

function randomIndex(length) {
  if (length <= 1) return 0;
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] % length;
  }
  return Math.floor(Math.random() * length);
}

function completedSourceIds() {
  return new Set(Object.values(app.data.taskStates || {})
    .filter((state) => state?.status === "completed" && state?.sourceAssignment?.testId)
    .map((state) => state.sourceAssignment.testId));
}

function eligibleSourceTests(task, library) {
  const fullOnly = sourceRequiresFullTest(task);
  return (library.tests || []).filter((test) => (
    test.skill === task.skill
    && (!fullOnly || (test.scope === "full" && Number(test.questionCount) === 40))
  ));
}

function chooseBalancedSourceTest(task, library, currentTestId = "") {
  const eligible = eligibleSourceTests(task, library);
  if (!eligible.length) return null;

  const used = completedSourceIds();
  let candidates = eligible.filter((test) => !used.has(test.id) && test.id !== currentTestId);
  if (!candidates.length) candidates = eligible.filter((test) => test.id !== currentTestId);
  if (!candidates.length) candidates = eligible;

  const providers = [...new Set(candidates.map((test) => test.providerId))];
  const providerId = providers[randomIndex(providers.length)];
  const providerCandidates = candidates.filter((test) => test.providerId === providerId);
  return providerCandidates[randomIndex(providerCandidates.length)] || null;
}

function sourceProvider(library, providerId) {
  return (library.providers || []).find((provider) => provider.id === providerId) || null;
}

function makeSourceAssignment(test, library) {
  const provider = sourceProvider(library, test.providerId);
  return {
    providerId: test.providerId,
    providerName: provider?.name || test.providerId,
    testId: test.id,
    testTitle: test.title,
    testUrl: test.url,
    scope: test.scope,
    questionCount: Number(test.questionCount || 0),
    assignedAt: Date.now(),
  };
}

async function ensureSourceAssignment(task, { force = false } = {}) {
  if (!isCheckedSourceTask(task)) return null;
  const state = taskState(task);
  const existing = sourceAssignmentFor(task);
  if (existing && !force) return existing;
  if (force && state.status && state.status !== "pending") {
    throw new Error("An in-progress or completed task keeps its assigned test.");
  }

  const library = await loadIeltsSourceLibrary();
  const selected = chooseBalancedSourceTest(task, library, force ? existing?.testId : "");
  if (!selected) throw new Error(`No approved ${task.skill} source is available.`);

  const assignment = makeSourceAssignment(selected, library);
  app.data.taskStates[task.id] = {
    ...state,
    sourceAssignment: assignment,
    updatedAt: Date.now(),
  };
  save();
  return assignment;
}

function sourceAdjustedTask(task, assignment = sourceAssignmentFor(task)) {
  if (!isCheckedSourceTask(task) || !assignment) return task;
  const baseline = sourceRequiresFullTest(task);
  const providerLabel = `${assignment.providerName} · ${assignment.testTitle}`;
  const sourceStep = baseline
    ? `Open the assigned ${assignment.providerName} full test only when you are ready and use FULL TEST mode.`
    : `Open the assigned ${assignment.providerName} practice set and complete it before checking any answer explanation.`;
  const checkedSteps = baseline
    ? task.skill === "listening"
      ? [
          sourceStep,
          "Complete all 40 questions under test conditions without pausing or replaying the audio.",
          "Use the platform answer check only after the full test is finished.",
          "Record the raw score, wrong question numbers and the reason for each error.",
        ]
      : [
          sourceStep,
          "Complete all three passages and 40 questions within a strict 60-minute limit without a dictionary.",
          "Use the platform answer check only after the full test is finished.",
          "Record the raw score, passage timing, wrong or guessed questions and their evidence.",
        ]
    : [
        sourceStep,
        ...task.steps,
        "Use the provider answer key or explanation after submitting, then record the raw result and wrong items in Joy.",
      ];

  return {
    ...task,
    material: `${providerLabel} · ${assignment.scope === "full" ? "full 40-question test" : `${assignment.questionCount}-question checked section`}`,
    materialUrl: assignment.testUrl,
    materialFallbackUrl: "",
    sourceProvider: assignment.providerName,
    sourceAssignment: assignment,
    steps: checkedSteps,
    output: baseline
      ? "Provider raw score, assigned test URL, timing and a reviewed list of wrong or guessed questions."
      : task.output,
    doneWhen: baseline
      ? [
          "The assigned test is completed under the required test conditions.",
          "The provider result and every wrong or guessed item are recorded and reviewed.",
        ]
      : task.doneWhen,
  };
}

function taskMaterialLinks(task) {
  const assignment = task.sourceAssignment || sourceAssignmentFor(task);
  const direct = externalMaterialLink(
    task.materialUrl,
    assignment ? `Open assigned test on ${assignment.providerName}` : "Open material",
  );
  const fallback = task.materialFallbackUrl && task.materialFallbackUrl !== task.materialUrl
    ? externalMaterialLink(task.materialFallbackUrl, "Open source page")
    : "";
  if (!direct && !fallback) return "";
  return `<div class="ielts-material-links">${direct}${fallback}</div>`;
}

function sourceAssignmentPanel(task, assignment, sourceError = "") {
  if (!isCheckedSourceTask(task)) return "";
  if (sourceError) {
    return `
      <div class="ielts-course-note">
        <strong>Joy could not assign a test.</strong>
        <p>${escapeHtml(sourceError)}</p>
        <button type="button" data-ielts-action="retry-source" data-task-id="${escapeHtml(task.id)}">Try again</button>
      </div>`;
  }
  if (!assignment) return "";
  const state = taskState(task);
  const canChange = !state.status || state.status === "pending";
  return `
    <div class="ielts-course-note">
      <strong>Random test locked to this task</strong>
      <p>${escapeHtml(assignment.providerName)} · ${escapeHtml(assignment.testTitle)} · ${assignment.scope === "full" ? "40 questions" : `${assignment.questionCount} questions`}</p>
      ${canChange ? `<button type="button" data-ielts-action="change-source" data-task-id="${escapeHtml(task.id)}">Choose another test</button>` : ""}
    </div>`;
}

async function taskDrawer(task) {
  let assignment = sourceAssignmentFor(task);
  let sourceError = "";
  if (isCheckedSourceTask(task) && !assignment) {
    openDrawer(`
      <header class="ielts-drawer-header">
        <span><small>${escapeHtml(SKILL_LABELS[task.skill])}</small><h3>Choosing a test…</h3></span>
        <button type="button" aria-label="Close task" data-ielts-action="close-drawer">×</button>
      </header>
      <p class="ielts-drawer-intro">Joy is selecting an unused test from STUDY4 or YouPass.</p>`);
    try {
      assignment = await ensureSourceAssignment(task);
    } catch (error) {
      sourceError = error.message || "The approved source catalog could not be loaded.";
    }
  }

  const effectiveTask = sourceAdjustedTask(task, assignment);
  const state = taskState(task);
  const sourceReady = !isCheckedSourceTask(task) || Boolean(assignment);
  openDrawer(`
    <header class="ielts-drawer-header">
      <span>
        <small>${escapeHtml(KIND_LABELS[effectiveTask.kind])} · ${escapeHtml(SKILL_LABELS[effectiveTask.skill])}</small>
        <h3>${escapeHtml(effectiveTask.title)}</h3>
      </span>
      <button type="button" aria-label="Close task" data-ielts-action="close-drawer">×</button>
    </header>
    ${sourceAssignmentPanel(task, assignment, sourceError)}
    <section class="ielts-task-detail">
      <div class="ielts-task-detail-meta">
        <span>${effectiveTask.minutes} min</span>
        <span>${escapeHtml(effectiveTask.groupLabel || effectiveTask.rhythmId)}</span>
      </div>
      <div>
        <small>Objective</small>
        <p>${escapeHtml(effectiveTask.objective)}</p>
      </div>
      <div>
        <small>Steps</small>
        <ol>${effectiveTask.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      </div>
      ${effectiveTask.material ? `<div><small>Materials</small><p>${escapeHtml(effectiveTask.material)}</p>${taskMaterialLinks(effectiveTask)}</div>` : ""}
      <div>
        <small>Output</small>
        <p>${escapeHtml(effectiveTask.output)}</p>
      </div>
      <div>
        <small>Done when</small>
        <ul>${effectiveTask.doneWhen.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </section>
    ${effectiveTask.kind !== "course" ? `
      <button class="ielts-chatgpt-button" data-ielts-action="start-chatgpt" data-task-id="${escapeHtml(effectiveTask.id)}" ${sourceReady ? "" : "disabled"}>
        <span>Start with ChatGPT</span>
        <small>${sourceReady ? "Copy the task and assigned test into ChatGPT" : "Assign a test before starting with ChatGPT"}</small>
      </button>` : `
      <div class="ielts-course-note">
        <strong>This is an external class.</strong>
        <p>Attend the lesson and save the recording. ChatGPT guidance begins in the separate lesson-review task.</p>
      </div>`}
    <form class="ielts-complete-form" data-ielts-form="complete-task">
      <input type="hidden" name="taskId" value="${escapeHtml(effectiveTask.id)}">
      <label>Actual time
        <input name="minutes" type="number" min="1" max="480" value="${escapeHtml(state.minutes || effectiveTask.minutes)}" required>
      </label>
      <label>Result or evidence
        <textarea name="evidence" required placeholder="Provider, test title, URL, raw score and wrong items…">${escapeHtml(state.evidence || "")}</textarea>
      </label>
      <label>What did you learn or struggle with?
        <textarea name="reflection" required placeholder="Keep this short and factual.">${escapeHtml(state.reflection || "")}</textarea>
      </label>
      <footer>
        <button type="button" data-ielts-action="close-drawer">Cancel</button>
        <button class="ielts-primary" type="submit">${isDone(effectiveTask) ? "Update result" : "Complete task"}</button>
      </footer>
    </form>`);
}

function teachingPrompt(task) {
  const assignment = sourceAssignmentFor(task);
  const effectiveTask = sourceAdjustedTask(task, assignment);
  const relevantErrors = app.data.errorLogs
    .filter((error) => error.active && (error.skill === effectiveTask.skill || error.skill === "review"))
    .slice(0, 5);
  const course = [...app.data.courseSessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  return `You are my IELTS teacher. Guide me through the Joy task below step by step.

Important teaching rules:
- Do not give me the entire lesson or all answers at once.
- Start with the first step, wait for my response, then correct me before continuing.
- Adapt the difficulty to my evidence and recurring errors.
- For Listening and Reading, use only the assigned STUDY4 or YouPass test below; do not replace it with another source.
- Never reveal or reproduce a third-party answer key before I finish the assigned work.
- Treat the platform result as diagnostic practice evidence, not an official IELTS score.
- At the end, produce a short structured result I can import or record in Joy.

Long-term goal:
- IELTS overall 7.0 by December 2026
- Minimum skill target: 6.5

Current task:
${JSON.stringify({
    id: effectiveTask.id,
    rhythmId: effectiveTask.rhythmId,
    skill: effectiveTask.skill,
    kind: effectiveTask.kind,
    title: effectiveTask.title,
    availableMinutes: effectiveTask.minutes,
    objective: effectiveTask.objective,
    steps: effectiveTask.steps,
    material: effectiveTask.material,
    materialUrl: effectiveTask.materialUrl,
    sourceAssignment: assignment,
    output: effectiveTask.output,
    doneWhen: effectiveTask.doneWhen,
  }, null, 2)}

Active recurring errors:
${JSON.stringify(relevantErrors, null, 2)}

Recent external-course knowledge:
${JSON.stringify(course, null, 2)}

Begin by explaining today’s objective in one short paragraph, then give me only Step 1.`;
}

document.addEventListener("click", async (event) => {
  const action = event.target.closest?.("[data-ielts-action]");
  const type = action?.dataset.ieltsAction;
  if (type !== "change-source" && type !== "retry-source") return;
  event.preventDefault();
  const task = findTask(action.dataset.taskId);
  if (!task) return;
  try {
    await ensureSourceAssignment(task, { force: type === "change-source" });
    await taskDrawer(task);
    toast(type === "change-source" ? "A different test has been assigned." : "Test assigned successfully.");
  } catch (error) {
    toast(error.message || "Joy could not assign a test.");
    await taskDrawer(task);
  }
});
