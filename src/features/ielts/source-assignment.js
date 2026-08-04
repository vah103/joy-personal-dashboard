const IELTS_SOURCE_LIBRARY_URL = "/project-data/ielts/sources.json?v=ielts-source-catalog-v2";
const IELTS_WRITING_SOURCE_LIBRARY_URL = "/project-data/ielts/writing-sources.json?v=ielts-writing-source-catalog-v1";
let ieltsSourceLibraryPromise = null;

function writingTaskPart(task) {
  const text = `${task?.id || ""} ${task?.title || ""} ${task?.objective || ""} ${(task?.steps || []).join(" ")}`;
  const hasTask1 = /\btask\s*1\b/i.test(text);
  const hasTask2 = /\btask\s*2\b/i.test(text);
  if ((hasTask1 && hasTask2) || /\bfull\s+writing\b/i.test(text)) return "both";
  if (hasTask1) return "task1";
  if (hasTask2) return "task2";
  return "";
}

function writingTaskFamily(task) {
  const text = `${task?.title || ""} ${task?.objective || ""} ${(task?.steps || []).join(" ")}`;
  const patterns = [
    ["maps", /\bmaps?\b/i],
    ["process", /\bprocess\b|diagram/i],
    ["mixed-chart", /mixed\s+chart/i],
    ["time-changing", /time\s+changing|line\s+graph|trend|over\s+time/i],
    ["time-fixed", /time\s+fixed|bar\s+chart|pie\s+chart|\btable\b/i],
    ["discussion", /discussion|discuss\s+both\s+views|both\s+views/i],
    ["advantages-disadvantages", /advantage|disadvantage|outweigh/i],
    ["positive-negative", /positive|negative\s+development/i],
    ["problems-solutions", /problem|solution|cause/i],
    ["two-part", /two[- ]part|multi[- ]part|direct\s+question/i],
    ["opinion", /opinion|agree|disagree|to\s+what\s+extent/i],
  ];
  return patterns.find(([, pattern]) => pattern.test(text))?.[0] || "";
}

function isWritingSourceTask(task) {
  if (task?.skill !== "writing") return false;
  if (task?.kind === "course" || task?.kind === "review") return false;
  if (String(task?.id || "").startsWith("baseline-")) return false;
  if (writingTaskPart(task)) return true;
  const text = `${task?.title || ""} ${task?.objective || ""} ${(task?.steps || []).join(" ")}`;
  return /\b(write|essay|paragraph|response|overview|introduction|body)\b/i.test(text);
}

function isAssignedSourceTask(task) {
  return task?.skill === "listening" || task?.skill === "reading" || isWritingSourceTask(task);
}

function sourceAssignmentFor(task) {
  const assignment = taskState(task).sourceAssignment;
  return assignment && typeof assignment === "object" ? assignment : null;
}

function sourceRequiresFullTest(task) {
  if (task?.skill === "writing") return writingTaskPart(task) === "both";
  return task?.kind === "test"
    || String(task?.id || "").startsWith("baseline-")
    || /\bfull\b/i.test(String(task?.title || ""));
}

function mergeSourceLibraries(base, writing) {
  const providers = new Map((base.providers || []).map((provider) => [provider.id, { ...provider }]));
  for (const provider of writing.providers || []) {
    const current = providers.get(provider.id) || {};
    providers.set(provider.id, {
      ...current,
      ...provider,
      availableSkills: [...new Set([...(current.availableSkills || []), ...(provider.availableSkills || [])])],
      checkedSkills: [...new Set(current.checkedSkills || [])],
    });
  }
  return {
    ...base,
    writingCatalogVersion: Number(writing.schemaVersion || 0),
    writingSelectionPolicy: writing.selectionPolicy || {},
    providers: [...providers.values()],
    tests: [...(base.tests || []), ...(writing.tests || [])],
  };
}

async function loadIeltsSourceLibrary() {
  if (!ieltsSourceLibraryPromise) {
    ieltsSourceLibraryPromise = Promise.all([
      requestJson(IELTS_SOURCE_LIBRARY_URL),
      requestJson(IELTS_WRITING_SOURCE_LIBRARY_URL),
    ]).then(([base, writing]) => mergeSourceLibraries(base, writing)).catch((error) => {
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
  const tests = (library.tests || []).filter((test) => test.skill === task.skill);
  if (task.skill !== "writing") {
    const fullOnly = sourceRequiresFullTest(task);
    return tests.filter((test) => (
      !fullOnly || (test.scope === "full" && Number(test.questionCount) === 40)
    ));
  }

  const taskPart = writingTaskPart(task);
  let eligible = tests.filter((test) => {
    if (taskPart === "both") return test.scope === "full" && test.taskPart === "both";
    if (taskPart === "task1" || taskPart === "task2") {
      return test.scope === "prompt" && test.taskPart === taskPart;
    }
    return test.scope === "prompt";
  });

  const family = writingTaskFamily(task);
  if (family) {
    const matched = eligible.filter((test) => test.writingType === family);
    if (matched.length) eligible = matched;
  }
  return eligible;
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
    promptCount: Number(test.promptCount || 0),
    taskPart: test.taskPart || "",
    writingType: test.writingType || "",
    sectionLabel: test.sectionLabel || "",
    assignedAt: Date.now(),
  };
}

async function ensureSourceAssignment(task, { force = false } = {}) {
  if (!isAssignedSourceTask(task)) return null;
  const state = taskState(task);
  const existing = sourceAssignmentFor(task);
  if (existing && !force) return existing;
  if (force && state.status && state.status !== "pending") {
    throw new Error(`An in-progress or completed task keeps its assigned ${task.skill === "writing" ? "prompt" : "test"}.`);
  }

  const library = await loadIeltsSourceLibrary();
  const selected = chooseBalancedSourceTest(task, library, force ? existing?.testId : "");
  if (!selected) throw new Error(`No approved ${task.skill} source is available for this task.`);

  const assignment = makeSourceAssignment(selected, library);
  app.data.taskStates[task.id] = {
    ...state,
    sourceAssignment: assignment,
    updatedAt: Date.now(),
  };
  save();
  return assignment;
}

function sourceAdjustedWritingTask(task, assignment) {
  const full = assignment.taskPart === "both" || sourceRequiresFullTest(task);
  const section = assignment.sectionLabel ? ` Select the section labelled “${assignment.sectionLabel}”.` : "";
  const sourceStep = `Open the assigned ${assignment.providerName} Writing ${full ? "test" : "prompt"}.${section}`;
  const steps = full
    ? [
        sourceStep,
        "Before writing, view only the Task 1 and Task 2 prompts; do not read provider guidance or model answers.",
        "Write Task 1 in 20 minutes and Task 2 in 40 minutes without ChatGPT, a dictionary or grammar tools.",
        "After both original responses are complete, ask ChatGPT for evidence-based feedback on all four Writing criteria.",
        "Keep the original responses unchanged and rewrite only the weakest sections identified by the feedback.",
      ]
    : [
        sourceStep,
        "Before the original response is complete, use only the prompt or chart and do not read the provider discussion, hints or model answer.",
        ...task.steps,
        "After the original work is complete, receive feedback on Task Achievement/Response, Coherence and Cohesion, Lexical Resource, and Grammar, then make the required targeted rewrite.",
      ];
  const partLabel = assignment.taskPart === "task1" ? "Task 1" : assignment.taskPart === "task2" ? "Task 2" : "Task 1 + Task 2";
  const typeLabel = assignment.writingType ? ` · ${assignment.writingType.replaceAll("-", " ")}` : "";
  return {
    ...task,
    material: `${assignment.providerName} · ${assignment.testTitle} · ${partLabel}${typeLabel}`,
    materialUrl: assignment.testUrl,
    materialFallbackUrl: "",
    sourceProvider: assignment.providerName,
    sourceAssignment: assignment,
    steps,
    output: full
      ? "Two original timed responses, assigned source URL, four-criterion feedback and targeted rewrites."
      : task.output,
    doneWhen: [
      ...task.doneWhen,
      "The original response or planned section is preserved before correction.",
      "The assigned prompt URL, actual time, feedback and rewrite are recorded as evidence.",
    ],
  };
}

function sourceAdjustedTask(task, assignment = sourceAssignmentFor(task)) {
  if (!isAssignedSourceTask(task) || !assignment) return task;
  if (task.skill === "writing") return sourceAdjustedWritingTask(task, assignment);

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
    assignment
      ? `Open assigned ${task.skill === "writing" ? "prompt" : "test"} on ${assignment.providerName}`
      : "Open material",
  );
  const fallback = task.materialFallbackUrl && task.materialFallbackUrl !== task.materialUrl
    ? externalMaterialLink(task.materialFallbackUrl, "Open source page")
    : "";
  if (!direct && !fallback) return "";
  return `<div class="ielts-material-links">${direct}${fallback}</div>`;
}

function sourceAssignmentPanel(task, assignment, sourceError = "") {
  if (!isAssignedSourceTask(task)) return "";
  const noun = task.skill === "writing" ? "prompt" : "test";
  if (sourceError) {
    return `
      <div class="ielts-course-note">
        <strong>Joy could not assign a ${noun}.</strong>
        <p>${escapeHtml(sourceError)}</p>
        <button type="button" data-ielts-action="retry-source" data-task-id="${escapeHtml(task.id)}">Try again</button>
      </div>`;
  }
  if (!assignment) return "";
  const state = taskState(task);
  const canChange = !state.status || state.status === "pending";
  const detail = task.skill === "writing"
    ? `${assignment.taskPart === "task1" ? "Task 1" : assignment.taskPart === "task2" ? "Task 2" : "Full Writing"}${assignment.writingType ? ` · ${assignment.writingType.replaceAll("-", " ")}` : ""}`
    : assignment.scope === "full" ? "40 questions" : `${assignment.questionCount} questions`;
  return `
    <div class="ielts-course-note">
      <strong>Random ${noun} locked to this task</strong>
      <p>${escapeHtml(assignment.providerName)} · ${escapeHtml(assignment.testTitle)} · ${escapeHtml(detail)}</p>
      ${assignment.sectionLabel ? `<p>Open section: ${escapeHtml(assignment.sectionLabel)}</p>` : ""}
      ${canChange ? `<button type="button" data-ielts-action="change-source" data-task-id="${escapeHtml(task.id)}">Choose another ${noun}</button>` : ""}
    </div>`;
}

async function taskDrawer(task) {
  let assignment = sourceAssignmentFor(task);
  let sourceError = "";
  if (isAssignedSourceTask(task) && !assignment) {
    const noun = task.skill === "writing" ? "prompt" : "test";
    openDrawer(`
      <header class="ielts-drawer-header">
        <span><small>${escapeHtml(SKILL_LABELS[task.skill])}</small><h3>Choosing a ${noun}…</h3></span>
        <button type="button" aria-label="Close task" data-ielts-action="close-drawer">×</button>
      </header>
      <p class="ielts-drawer-intro">Joy is selecting an unused ${noun} from STUDY4 or YouPass.</p>`);
    try {
      assignment = await ensureSourceAssignment(task);
    } catch (error) {
      sourceError = error.message || "The approved source catalog could not be loaded.";
    }
  }

  const effectiveTask = sourceAdjustedTask(task, assignment);
  const state = taskState(task);
  const sourceReady = !isAssignedSourceTask(task) || Boolean(assignment);
  const sourceNoun = task.skill === "writing" ? "prompt" : "test";
  const evidencePlaceholder = task.skill === "writing"
    ? "Provider, prompt title and URL; original response; actual time; four-criterion feedback; rewrite…"
    : "Provider, test title, URL, raw score and wrong items…";
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
        <small>${sourceReady ? `Copy the task and assigned ${sourceNoun} into ChatGPT` : `Assign a ${sourceNoun} before starting with ChatGPT`}</small>
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
        <textarea name="evidence" required placeholder="${escapeHtml(evidencePlaceholder)}">${escapeHtml(state.evidence || "")}</textarea>
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
    const noun = task.skill === "writing" ? "prompt" : "test";
    toast(type === "change-source" ? `A different ${noun} has been assigned.` : `${noun[0].toUpperCase()}${noun.slice(1)} assigned successfully.`);
  } catch (error) {
    toast(error.message || "Joy could not assign a source.");
    await taskDrawer(task);
  }
});
