import BASE_IELTS_SOURCE_LIBRARY from "../project-data/ielts/sources.json" with { type: "json" };
import IELTS_WRITING_SOURCE_LIBRARY from "../project-data/ielts/writing-sources.json" with { type: "json" };

function mergedSourceLibrary() {
  const providers = new Map(
    (BASE_IELTS_SOURCE_LIBRARY.providers || []).map((provider) => [provider.id, { ...provider }]),
  );
  for (const provider of IELTS_WRITING_SOURCE_LIBRARY.providers || []) {
    const current = providers.get(provider.id) || {};
    providers.set(provider.id, {
      ...current,
      ...provider,
      availableSkills: [...new Set([...(current.availableSkills || []), ...(provider.availableSkills || [])])],
      checkedSkills: [...new Set(current.checkedSkills || [])],
    });
  }
  return {
    ...BASE_IELTS_SOURCE_LIBRARY,
    writingCatalogVersion: Number(IELTS_WRITING_SOURCE_LIBRARY.schemaVersion || 0),
    writingSelectionPolicy: IELTS_WRITING_SOURCE_LIBRARY.selectionPolicy || {},
    providers: [...providers.values()],
    tests: [
      ...(BASE_IELTS_SOURCE_LIBRARY.tests || []),
      ...(IELTS_WRITING_SOURCE_LIBRARY.tests || []),
    ],
  };
}

const IELTS_SOURCE_LIBRARY = mergedSourceLibrary();
const RANDOM_CHECKED_PRACTICE_SKILLS = new Set(
  BASE_IELTS_SOURCE_LIBRARY.selectionPolicy?.randomCheckedPracticeSkills || [],
);
const RANDOM_WRITING_PRACTICE_SKILLS = new Set(
  IELTS_WRITING_SOURCE_LIBRARY.selectionPolicy?.randomPracticeSkills || [],
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

function taskText(task = {}) {
  return `${task.id || ""} ${task.title || ""} ${task.objective || ""} ${(task.steps || []).join(" ")}`;
}

function writingTaskPart(task = {}) {
  const text = taskText(task);
  const hasTask1 = /\btask\s*1\b/i.test(text);
  const hasTask2 = /\btask\s*2\b/i.test(text);
  if ((hasTask1 && hasTask2) || /\bfull\s+writing\b/i.test(text)) return "both";
  if (hasTask1) return "task1";
  if (hasTask2) return "task2";
  return "";
}

function writingTaskFamily(task = {}) {
  const text = taskText(task);
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

function writingPracticeRequired(task = {}) {
  if (String(task.skill || "").toLowerCase() !== "writing") return false;
  if (task.kind === "course" || task.kind === "review") return false;
  if (String(task.id || "").startsWith("baseline-")) return false;
  if (writingTaskPart(task)) return true;
  return /\b(write|essay|paragraph|response|overview|introduction|body)\b/i.test(taskText(task));
}

function randomSourceRequired(task = {}) {
  const skill = String(task.skill || "").trim().toLowerCase();
  return RANDOM_CHECKED_PRACTICE_SKILLS.has(skill)
    || (RANDOM_WRITING_PRACTICE_SKILLS.has(skill) && writingPracticeRequired(task));
}

function fullTestRequired(task = {}) {
  if (String(task.skill || "").toLowerCase() === "writing") {
    return writingTaskPart(task) === "both";
  }
  return task.kind === "test"
    || String(task.id || "").startsWith("baseline-")
    || /\bfull\b/i.test(String(task.title || ""));
}

function approvedProvidersForSkill(skill) {
  return (IELTS_SOURCE_LIBRARY.providers || [])
    .filter((provider) => (
      provider.teacherRecommended === true
      && provider.official === false
      && Array.isArray(provider.availableSkills)
      && provider.availableSkills.includes(skill)
    ))
    .map((provider) => clone(provider));
}

function approvedTestsForTask(task = {}) {
  const skill = String(task.skill || "").trim().toLowerCase();
  let tests = (IELTS_SOURCE_LIBRARY.tests || []).filter((test) => test.skill === skill);
  if (skill !== "writing") {
    const fullOnly = fullTestRequired(task);
    return tests
      .filter((test) => (
        !fullOnly || (test.scope === "full" && Number(test.questionCount) === 40)
      ))
      .map((test) => clone(test));
  }

  const part = writingTaskPart(task);
  tests = tests.filter((test) => {
    if (part === "both") return test.scope === "full" && test.taskPart === "both";
    if (part === "task1" || part === "task2") {
      return test.scope === "prompt" && test.taskPart === part;
    }
    return test.scope === "prompt";
  });
  const family = writingTaskFamily(task);
  if (family) {
    const matched = tests.filter((test) => test.writingType === family);
    if (matched.length) tests = matched;
  }
  return tests.map((test) => clone(test));
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
  if (!randomSourceRequired(task)) return null;

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
    promptCount: Number(selected.promptCount || 0),
    taskPart: selected.taskPart || "",
    writingType: selected.writingType || "",
    sectionLabel: selected.sectionLabel || "",
    assignedAt: Number(now),
  };
}

export function getIeltsSourceLibrary() {
  return clone(IELTS_SOURCE_LIBRARY);
}

function receptiveGuidance(task, skill, assignment, approvedProviders) {
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

function writingGuidance(task, assignment, approvedProviders) {
  if (assignment) {
    return {
      mode: "assigned-writing-prompt",
      fixedMaterial: {
        label: `${assignment.providerName} · ${assignment.testTitle}`,
        url: assignment.testUrl,
        fallbackUrl: null,
      },
      selectedTest: assignment,
      approvedProviders,
      approvedTests: [],
      rules: [
        "Use only the assigned STUDY4 or YouPass Writing prompt for this task.",
        "Open the named section when the provider page contains more than one prompt.",
        "Before the original response is complete, use only the prompt or chart and do not read provider guidance or a model answer.",
        "Follow the relevant synchronized external-course method without replacing it with a conflicting framework.",
        "Preserve the original response, then record four-criterion feedback and a targeted rewrite.",
        "Any band score from ChatGPT or a provider is an estimate unless supported by official test evidence.",
      ],
      evidenceTemplate: [
        `Provider: ${assignment.providerName}`,
        `Prompt: ${assignment.testTitle}`,
        `Section: ${assignment.sectionLabel || "direct prompt page"}`,
        `URL: ${assignment.testUrl}`,
        "Actual time: <minutes>",
        "Original response: <saved unchanged>",
        "Criterion feedback: <TA/TR, CC, LR, GRA>",
        "Targeted rewrite: <revised section or response>",
        "Reflection: <one next improvement action>",
      ],
    };
  }

  return {
    mode: "random-writing-prompt",
    fixedMaterial: null,
    selectedTest: null,
    approvedProviders,
    approvedTests: approvedTestsForTask(task),
    rules: [
      "Assign one concrete Writing prompt from STUDY4 or YouPass before starting the task.",
      "Keep Task 1, Task 2 and full Writing pools separate and prefer the chart or essay family named by the task.",
      "Keep the assignment stable and avoid prompts attached to completed tasks until the eligible pool is exhausted.",
      "Keep the official fixed Writing source for the baseline instead of replacing it with this practice pool.",
      "Do not read or reproduce provider guidance or a model answer before the original response is complete.",
    ],
    evidenceTemplate: [
      "Provider: <STUDY4 or YouPass>",
      "Prompt: <assigned prompt title>",
      "Section: <named section if applicable>",
      "URL: <assigned concrete URL>",
      "Actual time: <minutes>",
      "Original response: <saved unchanged>",
      "Criterion feedback: <TA/TR, CC, LR, GRA>",
      "Targeted rewrite: <revised section or response>",
    ],
  };
}

export function getIeltsSourceGuidance(task = {}) {
  const skill = String(task.skill || "").trim().toLowerCase();
  if (randomSourceRequired(task)) {
    const assignment = sourceAssignment(task);
    const approvedProviders = approvedProvidersForSkill(skill);
    if (skill === "writing") return writingGuidance(task, assignment, approvedProviders);
    return receptiveGuidance(task, skill, assignment, approvedProviders);
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
