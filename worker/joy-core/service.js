import {
  normalizeEvidence,
  normalizeMilestone,
  normalizeProgressLog,
  normalizeProject,
  normalizeTask,
} from "./model.js";
import {
  JOY_CORE_ACTIONS,
  assertJoyCorePermission,
} from "./permissions.js";
import {
  getCoreEvidence,
  getCoreMilestone,
  getCoreProgressLog,
  getCoreProject,
  getCoreTask,
  listCoreEvidence,
  listCoreMilestones,
  listCoreProgressLogs,
  listCoreProjects,
  listCoreTasks,
  listLegacyInboxTasks,
  listLegacyProjects,
  listOpenCoreTasks,
  listRecentCoreProgressLogs,
  recordCoreAuditEvent,
  saveCoreEvidence,
  saveCoreMilestone,
  saveCoreProgressLog,
  saveCoreProject,
  saveCoreTask,
} from "./repository.js";

const TURTLEBOT_STATE_PATH = "/project-data/turtlebot4/current-state.json";

export class JoyCoreError extends Error {
  constructor(code, status = 400, details = null) {
    super(code);
    this.name = "JoyCoreError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function requireDatabase(env) {
  if (!env?.DB) throw new JoyCoreError("JOY_CORE_DATABASE_UNAVAILABLE", 503);
  return env.DB;
}

function permission(context, action) {
  assertJoyCorePermission(context?.role, action, context?.scopes);
}

function nowValue(now) {
  const numeric = Number(now);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : Date.now();
}

function dateToTimestamp(value, fallback) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function statusFromCompatibility(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "completed" || status === "done") return "completed";
  if (status === "blocked") return "blocked";
  if (status === "paused") return "paused";
  if (status === "not-started" || status === "planned") return "planned";
  return "active";
}

function mergeProjects(primary, fallback) {
  const byId = new Map();
  for (const project of fallback || []) byId.set(project.id, project);
  for (const project of primary || []) byId.set(project.id, project);
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

function stableRequestId(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return normalized || null;
}

function generatedId(prefix, clientRequestId) {
  const stable = stableRequestId(clientRequestId);
  if (stable) return `${prefix}-${stable}`.slice(0, 80);
  return `${prefix}-${crypto.randomUUID()}`;
}

function changedFields(input, allowed) {
  const output = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input || {}, key)) output[key] = input[key];
  }
  return output;
}

function assertBaseVersion(input, entity, code) {
  if (input?.baseVersion === undefined || input?.baseVersion === null) return;
  if (Number(input.baseVersion) !== Number(entity.version || 0)) {
    throw new JoyCoreError(code, 409, { current: entity });
  }
}

async function turtleBotCompatibilityProject(env, now) {
  if (!env?.ASSETS?.fetch) return null;
  try {
    const response = await env.ASSETS.fetch(
      new Request(`https://joy.internal${TURTLEBOT_STATE_PATH}`),
    );
    if (!response.ok) return null;
    const state = await response.json();
    const updatedAt = dateToTimestamp(state.updatedAt, now);
    return normalizeProject({
      id: "turtlebot4",
      title: "TurtleBot4 Graduation Thesis",
      summary: "Graduation thesis project tracked by Joy.",
      status: statusFromCompatibility(state.project?.currentStatus),
      progress: state.history?.progressAfter ?? state.project?.progress ?? 0,
      currentStageId: state.project?.currentStageId || null,
      currentFocus: state.project?.currentFocus || "",
      nextAction: state.project?.nextAction || "",
      blockers: state.project?.currentBlockers || [],
      sourceType: "joy",
      sourceRef: `asset:${TURTLEBOT_STATE_PATH}`,
      metadata: {
        compatibilitySource: "turtlebot-current-state",
        stage3Result: state.project?.stage3Result || null,
      },
      version: 0,
      createdAt: updatedAt,
      updatedAt,
    }, now);
  } catch (error) {
    console.warn("Joy Core TurtleBot adapter failed", error?.message || error);
    return null;
  }
}

async function compatibilityProjects(env, userEmail, now) {
  const db = requireDatabase(env);
  const [legacy, turtleBot] = await Promise.all([
    listLegacyProjects(db, userEmail),
    turtleBotCompatibilityProject(env, now),
  ]);
  return mergeProjects(turtleBot ? [turtleBot] : [], legacy);
}

async function findProject(env, userEmail, projectId, now) {
  const db = requireDatabase(env);
  const core = await getCoreProject(db, userEmail, projectId);
  if (core) return { project: core, persisted: true };
  const compatibility = await compatibilityProjects(env, userEmail, now);
  const project = compatibility.find((item) => item.id === projectId) || null;
  return { project, persisted: false };
}

async function ensurePersistedProject(env, context, projectId, now) {
  const db = requireDatabase(env);
  const found = await findProject(env, context.userEmail, projectId, now);
  if (!found.project) throw new JoyCoreError("JOY_PROJECT_NOT_FOUND", 404);
  if (found.persisted) return found.project;
  const promoted = normalizeProject({
    ...found.project,
    sourceType: found.project.sourceType || "import",
    version: 1,
    updatedAt: now,
  }, now);
  const saved = await saveCoreProject(db, context.userEmail, promoted);
  await audit(env, context, "project:promote", "project", saved.id, {
    sourceRef: saved.sourceRef,
  }, now);
  return saved;
}

async function audit(env, context, action, entityType, entityId, payload, now) {
  const db = requireDatabase(env);
  await recordCoreAuditEvent(db, context.userEmail, {
    id: generatedId("audit", null),
    actorType: context.actorType || "assistant",
    actorId: context.actorId || "custom-gpt",
    action,
    entityType,
    entityId,
    payload,
    createdAt: now,
  });
}

function projectPatch(input) {
  return changedFields(input, [
    "title",
    "summary",
    "status",
    "progress",
    "currentStageId",
    "currentFocus",
    "nextAction",
    "blockers",
    "metadata",
  ]);
}

function taskPatch(input) {
  return changedFields(input, [
    "milestoneId",
    "title",
    "description",
    "status",
    "priority",
    "dueAt",
    "scheduledFor",
    "position",
    "metadata",
  ]);
}

function milestonePatch(input) {
  return changedFields(input, [
    "title",
    "description",
    "status",
    "targetAt",
    "position",
    "metadata",
  ]);
}

export async function getJoyOverview(env, context, options = {}) {
  permission(context, JOY_CORE_ACTIONS.PROJECT_READ);
  permission(context, JOY_CORE_ACTIONS.TASK_READ);
  permission(context, JOY_CORE_ACTIONS.LOG_READ);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const [coreProjects, compatible, openTasks, inboxTasks, recentLogs] = await Promise.all([
    listCoreProjects(db, context.userEmail),
    compatibilityProjects(env, context.userEmail, now),
    listOpenCoreTasks(db, context.userEmail, options.taskLimit || 50),
    listLegacyInboxTasks(db, context.userEmail, options.inboxLimit || 30),
    listRecentCoreProgressLogs(db, context.userEmail, options.logLimit || 20),
  ]);
  return {
    projects: mergeProjects(coreProjects, compatible),
    openTasks,
    inboxTasks,
    recentLogs,
    generatedAt: now,
  };
}

export async function listJoyProjects(env, context, options = {}) {
  permission(context, JOY_CORE_ACTIONS.PROJECT_READ);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const [core, compatible] = await Promise.all([
    listCoreProjects(db, context.userEmail),
    compatibilityProjects(env, context.userEmail, now),
  ]);
  return mergeProjects(core, compatible);
}

export async function getJoyProject(env, context, projectId, options = {}) {
  permission(context, JOY_CORE_ACTIONS.PROJECT_READ);
  permission(context, JOY_CORE_ACTIONS.TASK_READ);
  permission(context, JOY_CORE_ACTIONS.MILESTONE_READ);
  permission(context, JOY_CORE_ACTIONS.LOG_READ);
  permission(context, JOY_CORE_ACTIONS.EVIDENCE_READ);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const found = await findProject(env, context.userEmail, projectId, now);
  if (!found.project) throw new JoyCoreError("JOY_PROJECT_NOT_FOUND", 404);
  if (!found.persisted) {
    return {
      project: found.project,
      tasks: [],
      milestones: [],
      progressLogs: [],
      evidence: [],
      compatibilityMode: true,
    };
  }
  const [tasks, milestones, progressLogs, evidence] = await Promise.all([
    listCoreTasks(db, context.userEmail, projectId),
    listCoreMilestones(db, context.userEmail, projectId),
    listCoreProgressLogs(db, context.userEmail, projectId),
    listCoreEvidence(db, context.userEmail, projectId),
  ]);
  return {
    project: found.project,
    tasks,
    milestones,
    progressLogs,
    evidence,
    compatibilityMode: false,
  };
}

export async function updateJoyProject(env, context, projectId, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.PROJECT_UPDATE);
  if (String(input.status || "").toLowerCase() === "archived") {
    permission(context, JOY_CORE_ACTIONS.PROJECT_ARCHIVE);
  }
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const current = await ensurePersistedProject(env, context, projectId, now);
  assertBaseVersion(input, current, "JOY_PROJECT_VERSION_CONFLICT");
  const next = normalizeProject({
    ...current,
    ...projectPatch(input),
    id: current.id,
    sourceType: current.sourceType,
    sourceRef: current.sourceRef,
    version: current.version + 1,
    createdAt: current.createdAt,
    updatedAt: now,
  }, now);
  const saved = await saveCoreProject(db, context.userEmail, next);
  await audit(env, context, JOY_CORE_ACTIONS.PROJECT_UPDATE, "project", saved.id, {
    baseVersion: current.version,
    nextVersion: saved.version,
    changed: Object.keys(projectPatch(input)),
  }, now);
  return saved;
}

export async function createJoyTask(env, context, projectId, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.TASK_CREATE);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  await ensurePersistedProject(env, context, projectId, now);
  const id = generatedId("task", input.clientRequestId);
  const existing = await getCoreTask(db, context.userEmail, id);
  if (existing) return { task: existing, deduplicated: true };
  const task = normalizeTask({
    ...input,
    id,
    projectId,
    sourceType: "joy",
    sourceRef: "custom-gpt",
    version: 1,
    createdAt: now,
    updatedAt: now,
  }, now);
  const saved = await saveCoreTask(db, context.userEmail, task);
  await audit(env, context, JOY_CORE_ACTIONS.TASK_CREATE, "task", saved.id, {
    projectId,
  }, now);
  return { task: saved, deduplicated: false };
}

export async function updateJoyTask(env, context, taskId, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.TASK_UPDATE);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const current = await getCoreTask(db, context.userEmail, taskId);
  if (!current) throw new JoyCoreError("JOY_TASK_NOT_FOUND", 404);
  assertBaseVersion(input, current, "JOY_TASK_VERSION_CONFLICT");
  const next = normalizeTask({
    ...current,
    ...taskPatch(input),
    id: current.id,
    projectId: current.projectId,
    sourceType: current.sourceType,
    sourceRef: current.sourceRef,
    version: current.version + 1,
    createdAt: current.createdAt,
    updatedAt: now,
  }, now);
  const saved = await saveCoreTask(db, context.userEmail, next);
  await audit(env, context, JOY_CORE_ACTIONS.TASK_UPDATE, "task", saved.id, {
    projectId: saved.projectId,
    baseVersion: current.version,
    nextVersion: saved.version,
    changed: Object.keys(taskPatch(input)),
  }, now);
  return saved;
}

export async function createJoyMilestone(env, context, projectId, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.MILESTONE_CREATE);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  await ensurePersistedProject(env, context, projectId, now);
  const id = generatedId("milestone", input.clientRequestId);
  const existing = await getCoreMilestone(db, context.userEmail, id);
  if (existing) return { milestone: existing, deduplicated: true };
  const milestone = normalizeMilestone({
    ...input,
    id,
    projectId,
    sourceType: "joy",
    sourceRef: "custom-gpt",
    version: 1,
    createdAt: now,
    updatedAt: now,
  }, now);
  const saved = await saveCoreMilestone(db, context.userEmail, milestone);
  await audit(env, context, JOY_CORE_ACTIONS.MILESTONE_CREATE, "milestone", saved.id, {
    projectId,
  }, now);
  return { milestone: saved, deduplicated: false };
}

export async function updateJoyMilestone(env, context, milestoneId, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.MILESTONE_UPDATE);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const current = await getCoreMilestone(db, context.userEmail, milestoneId);
  if (!current) throw new JoyCoreError("JOY_MILESTONE_NOT_FOUND", 404);
  assertBaseVersion(input, current, "JOY_MILESTONE_VERSION_CONFLICT");
  const next = normalizeMilestone({
    ...current,
    ...milestonePatch(input),
    id: current.id,
    projectId: current.projectId,
    sourceType: current.sourceType,
    sourceRef: current.sourceRef,
    version: current.version + 1,
    createdAt: current.createdAt,
    updatedAt: now,
  }, now);
  const saved = await saveCoreMilestone(db, context.userEmail, next);
  await audit(env, context, JOY_CORE_ACTIONS.MILESTONE_UPDATE, "milestone", saved.id, {
    projectId: saved.projectId,
    baseVersion: current.version,
    nextVersion: saved.version,
    changed: Object.keys(milestonePatch(input)),
  }, now);
  return saved;
}

export async function appendJoyProgressLog(env, context, projectId, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.LOG_CREATE);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const project = await ensurePersistedProject(env, context, projectId, now);
  if (input.taskId) {
    const task = await getCoreTask(db, context.userEmail, input.taskId);
    if (!task || task.projectId !== projectId) {
      throw new JoyCoreError("JOY_LOG_TASK_INVALID", 400);
    }
  }
  const id = generatedId("log", input.clientRequestId);
  const existing = await getCoreProgressLog(db, context.userEmail, id);
  if (existing) return { progressLog: existing, project, deduplicated: true };
  const log = normalizeProgressLog({
    ...input,
    id,
    projectId,
    sourceType: "joy",
    sourceRef: "custom-gpt",
    createdAt: now,
  }, now);
  const saved = await saveCoreProgressLog(db, context.userEmail, log);
  let updatedProject = project;
  if (saved.progressAfter !== null && saved.progressAfter !== project.progress) {
    updatedProject = normalizeProject({
      ...project,
      progress: saved.progressAfter,
      version: project.version + 1,
      updatedAt: now,
    }, now);
    updatedProject = await saveCoreProject(db, context.userEmail, updatedProject);
  }
  await audit(env, context, JOY_CORE_ACTIONS.LOG_CREATE, "progressLog", saved.id, {
    projectId,
    taskId: saved.taskId,
    progressAfter: saved.progressAfter,
  }, now);
  return { progressLog: saved, project: updatedProject, deduplicated: false };
}

export async function attachJoyEvidence(env, context, projectId, input = {}, options = {}) {
  permission(context, JOY_CORE_ACTIONS.EVIDENCE_CREATE);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  await ensurePersistedProject(env, context, projectId, now);
  if (input.taskId) {
    const task = await getCoreTask(db, context.userEmail, input.taskId);
    if (!task || task.projectId !== projectId) {
      throw new JoyCoreError("JOY_EVIDENCE_TASK_INVALID", 400);
    }
  }
  if (input.progressLogId) {
    const log = await getCoreProgressLog(db, context.userEmail, input.progressLogId);
    if (!log || log.projectId !== projectId) {
      throw new JoyCoreError("JOY_EVIDENCE_LOG_INVALID", 400);
    }
  }
  const id = generatedId("evidence", input.clientRequestId);
  const existing = await getCoreEvidence(db, context.userEmail, id);
  if (existing) return { evidence: existing, deduplicated: true };
  const evidence = normalizeEvidence({
    ...input,
    id,
    projectId,
    sourceType: "joy",
    sourceRef: "custom-gpt",
    createdAt: now,
  }, now);
  const saved = await saveCoreEvidence(db, context.userEmail, evidence);
  await audit(env, context, JOY_CORE_ACTIONS.EVIDENCE_CREATE, "evidence", saved.id, {
    projectId,
    taskId: saved.taskId,
    progressLogId: saved.progressLogId,
  }, now);
  return { evidence: saved, deduplicated: false };
}
