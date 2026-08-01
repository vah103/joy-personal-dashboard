import IELTS_SOURCE_LIBRARY from "../project-data/ielts/sources.json" with { type: "json" };

const CHECKED_PRACTICE_SKILLS = new Set(
  IELTS_SOURCE_LIBRARY.selectionPolicy?.teacherRecommendedCheckedPracticeSkills || [],
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

export function getIeltsSourceLibrary() {
  return clone(IELTS_SOURCE_LIBRARY);
}

export function getIeltsSourceGuidance(task = {}) {
  const material = fixedMaterial(task);
  if (material) {
    return {
      mode: "fixed-task-material",
      fixedMaterial: material,
      approvedProviders: [],
      rules: [
        "Use the exact task material before considering any general practice provider.",
        "For a baseline task, keep the result tied to the supplied official material.",
        "Record the test result and reviewed errors as evidence; do not replace the task with another test.",
      ],
      evidenceTemplate: [
        "Material: <task material>",
        "Result: <raw score or criterion result>",
        "Wrong items or weaknesses: <items>",
        "Review: <what caused the errors and the prevention action>",
      ],
    };
  }

  const skill = String(task.skill || "").trim().toLowerCase();
  const approvedProviders = CHECKED_PRACTICE_SKILLS.has(skill)
    ? approvedProvidersForSkill(skill)
    : [];

  if (approvedProviders.length) {
    return {
      mode: "approved-checked-practice",
      fixedMaterial: null,
      approvedProviders,
      rules: [
        "Ask the owner to choose or open one concrete test on an approved provider.",
        "The owner completes the test on the provider platform and returns the result or screenshots.",
        "Use the platform answer check as practice evidence, not as an official IELTS score.",
        "Do not scrape, reproduce, or store the full test or full third-party answer key.",
      ],
      evidenceTemplate: [
        "Provider: <study4 or youpass>",
        "Test: <test title or identifier>",
        "URL: <concrete test URL>",
        "Result: <raw score, for example 31/40>",
        "Wrong items: <question numbers or types>",
        "Platform checked: yes",
        "Reflection: <cause and next prevention action>",
      ],
    };
  }

  return {
    mode: "task-or-owner-material",
    fixedMaterial: null,
    approvedProviders: [],
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
