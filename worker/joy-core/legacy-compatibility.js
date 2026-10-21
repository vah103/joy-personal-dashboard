export const LEGACY_PROJECT_REPLACEMENTS = Object.freeze({
  "1": "turtlebot4",
  "2": "ielts",
});

const LEGACY_TASK_PROJECTS = new Map([
  ["complete the input reading task.", "ielts"],
  ["complete the listening input task.", "ielts"],
  ["complete the ielts practice test.", "ielts"],
  ["save 50 each night and practice the writing exam weekends.", "ielts"],
  ["prepare for the graduation project meeting.", "turtlebot4"],
]);

function normalizedLegacyId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function classifyLegacyTask(task) {
  return LEGACY_TASK_PROJECTS.get(String(task?.title || "").trim().toLowerCase()) || null;
}

export function legacyTaskCoreId(legacyTaskId) {
  const normalized = normalizedLegacyId(legacyTaskId);
  return normalized ? `task-legacy-${normalized}`.slice(0, 80) : null;
}

export function legacyTaskSourceRef(legacyTaskId) {
  const id = String(legacyTaskId ?? "").trim();
  return id ? `legacy:tasks:${encodeURIComponent(id)}` : null;
}

export function legacyProjectMigrationContext(project) {
  return {
    legacyProjectId: project.id,
    reportedProgress: project.progress,
    previousFocus: project.currentFocus,
    previousNextAction: project.nextAction,
    sourceRef: project.sourceRef,
    reportedAt: project.updatedAt,
  };
}

export function isMigratedLegacyProject(project, replacementIds) {
  const replacementId = LEGACY_PROJECT_REPLACEMENTS[project.id];
  const isLegacyJoyProject = project.sourceRef === "legacy:joy_projects"
    && project.metadata?.compatibilitySource === "joy_projects";
  return isLegacyJoyProject && replacementId && replacementIds.has(replacementId);
}
