import IELTS_SOURCE_LIBRARY from "../project-data/ielts/sources.json" with { type: "json" };

const RANDOM_CHECKED_PRACTICE_SKILLS = new Set(
  IELTS_SOURCE_LIBRARY.selectionPolicy?.randomCheckedPracticeSkills || [],
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixedMaterial(task = {}) {
  const url = String(task.materialUrl || "").trim();
  if (!url) return null;
  return {
    label: String(task.material || task.title || "Task material").trim(),
    url,
    fallbackUrl: String(task.materialFallbackUrl || "").trim() || null,
  };
}

function sourceAssignment(task = {}) {
  const value = task.sourceAssignment || task.state?.sourceAssignment;
  return value && typeof value === "object" ? clone(value) : null;
}

function fullTestRequired(task = {}) {
  return task.kind === "test"
    || String(task.id || "").startsWith("baseline-")
    || /\bfull\b/i.test(String(task.title || ""));
}

function approvedProvidersForSkill(skill) {
  return (IELTS_SOURCE_LIBRARY.providers || [])
    .filter((provider) => (
      provider.teacherRecommended === true
      && provider.official === false
      && Array.isArray(provider.checkedSkills)
      && provider.checkedSkills.includes(skill)
    ))
    .map((provider) => clone(provider));
}

function approvedTestsForTask(task = {}) {
  const skill = String(task.skill || "").trim().toLowerCase();
  const fullOnly = fullTestRequired(task);
  return (IELTS_SOURCE_LIBRARY.tests || [])
    .filter((test) => (
      test.skill === skill
      && (!fullOnly || (test.scope === "full" && Number(test.questionCount) === 40))
    ))
    .map((test) => clone(test));
}

function randomIndex(length, random = Math.random) {
  if (length <= 1) return 0;
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.min(0.999999999, Math.max(0, value)) : 0;
  return Math.floor(normalized * length);
}

function completedSourceIds(data = {}) {
  return new Set(Object.values(data.taskStates || {})
    .filter((state) => state?.status === "completed" && state?.sourceAssignment?.testId)
    .map((state) => state.sourceAssignment.testId));
}

export function selectIeltsSourceAssignment(
  task = {},
  data = {},
  { random = Math.random, now = Date.now(), force = false } = {},
) {
  const skill = String(task.skill || "").trim().toLowerCase();
  if (!RANDOM_CHECKED_PRACTICE_SKILLS.has(skill)) return null;

  const current = data.taskStates?.[task.id]?.sourceAssignment;
  if (current && !force) return clone(current);

  const eligible = approvedTestsForTask(task);
  if (!eligible.length) return null;
  const used = completedSourceIds(data);
  const currentId = force ? current?.testId : "";
  let candidates = eligible.filter((test) => !used.has(test.id) && test.id !== currentId);
  if (!candidates.length) candidates = eligible.filter((test) => test.id !== currentId);
  if (!candidates.length) candidates = eligible;

  const providers = [...new Set(candidates.map((test) => test.providerId))];
  const providerId = providers[randomIndex(providers.length, random)];
  const providerCandidates = candidates.filter((test) => test.providerId === providerId);
  const selected = providerCandidates[randomIndex(providerCandidates.length, random)];
  const provider = (IELTS_SOURCE_LIBRARY.providers || [])
    .find((item) => item.id === selected.providerId);

  return {
    providerId: selected.providerId,
    providerName: provider?.name || selected.providerId,
    testId: selected.id,
    testTitle: selected.title,
    testUrl: selected.url,
    scope: selected.scope,
    questionCount: Number(selected.questionCount || 0),
    assignedAt: Number(now),
  };
}

export function getIeltsSourceLibrary() {
  return clone(IELTS_SOURCE_LIBRARY);
}

export function getIeltsSourceGuidance(task = {}) {
  const skill = String(task.skill || "").trim().toLowerCase();
  if (RANDOM_CHECKED_PRACTICE_SKILLS.has(skill)) {
    const assignment = sourceAssignment(task);
    const approvedProviders = approvedProvidersForSkill(skill);
    if (assignment) {
      return {
        mode: "assigned-checked-practice",
        fixedMaterial: {
          label: `${assignment.providerName} · ${assignment.testTitle}`,
          url: assignment.testUrl,
          fallbackUrl: null,
        },
        selectedTest: assignment,
        approvedProviders,
        approvedTests: [],
        rules: [
          "Use only the assigned STUDY4 or YouPass test for this task.",
          "Do not replace the assigned source unless the task is still pending and Joy explicitly reassigns it.",
          "The owner completes the test on the provider platform before checking answers or explanations.",
          "Use the provider result as diagnostic evidence, not as an official IELTS score.",
          "Do not scrape, reproduce or store the full test or full third-party answer key.",
        ],
        evidenceTemplate: [
          `Provider: ${assignment.providerName}`,
          `Test: ${assignment.testTitle}`,
          `URL: ${assignment.testUrl}`,
          "Result: <raw score, for example 31/40>",
          "Wrong items: <question numbers or types>",
          "Platform checked: yes",
          "Reflection: <cause and next prevention action>",
        ],
      };
    }

    return {
      mode: "random-checked-practice",
      fixedMaterial: null,
      selectedTest: null,
      approvedProviders,
      approvedTests: approvedTestsForTask(task),
      rules: [
        "Assign one random eligible test from STUDY4 or YouPass before starting the task.",
        "Full-test and baseline tasks require a verified 40-question test.",
        "Keep the assignment stable for the task and avoid tests already attached to completed tasks until the pool is exhausted.",
        "Do not use the old fixed Listening or Reading material when an approved random source is required.",
        "Treat the provider result as diagnostic evidence, not as an official IELTS score.",
      ],
      evidenceTemplate: [
        "Provider: <STUDY4 or YouPass>",
        "Test: <assigned test title>",
        "URL: <assigned concrete URL>",
        "Result: <raw score>",
        "Wrong items: <question numbers or types>",
        "Platform checked: yes",
        "Reflection: <cause and next prevention action>",
      ],
    };
  }

  const material = fixedMaterial(task);
  if (material) {
    return {
      mode: "fixed-task-material",
      fixedMaterial: material,
      selectedTest: null,
      approvedProviders: [],
      approvedTests: [],
      rules: [
        "Use the exact task material before considering any general practice provider.",
        "Record the output and feedback as evidence.",
      ],
      evidenceTemplate: [
        "Material: <task material>",
        "Output: <submitted work>",
        "Feedback: <criteria-based findings>",
        "Reflection: <next improvement action>",
      ],
    };
  }

  return {
    mode: "task-or-owner-material",
    fixedMaterial: null,
    selectedTest: null,
    approvedProviders: [],
    approvedTests: [],
    rules: [
      "Use material already attached to the task or supplied by the owner.",
      "For Writing or Speaking, any score is a teacher or AI estimate unless official evidence says otherwise.",
      "Do not invent an answer key or official band score.",
    ],
    evidenceTemplate: [
      "Material or prompt: <title or URL>",
      "Output: <submitted work>",
      "Feedback: <criteria-based findings>",
      "Reflection: <next improvement action>",
    ],
  };
}

function decorateTask(task) {
  if (!task || typeof task !== "object") return task;
  return {
    ...task,
    sourceGuidance: getIeltsSourceGuidance(task),
  };
}

export function decorateIeltsTeachingContext(result = {}) {
  return {
    ...result,
    sourceLibrary: getIeltsSourceLibrary(),
    current: result.current && typeof result.current === "object"
      ? {
          ...result.current,
          tasks: Array.isArray(result.current.tasks)
            ? result.current.tasks.map(decorateTask)
            : [],
        }
      : result.current,
    nextTask: decorateTask(result.nextTask),
  };
}

export function decorateIeltsTeachingTask(result = {}) {
  return {
    ...result,
    sourceLibrary: getIeltsSourceLibrary(),
    task: decorateTask(result.task),
  };
}
