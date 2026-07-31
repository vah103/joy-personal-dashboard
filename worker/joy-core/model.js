export const JOY_CORE_SCHEMA_VERSION = 1;

export const PROJECT_STATUSES = Object.freeze([
  "planned",
  "active",
  "blocked",
  "paused",
  "completed",
  "archived",
]);

export const TASK_STATUSES = Object.freeze([
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);

export const TASK_PRIORITIES = Object.freeze([
  "low",
  "normal",
  "high",
  "critical",
]);

export const MILESTONE_STATUSES = Object.freeze([
  "planned",
  "active",
  "completed",
  "missed",
  "cancelled",
]);

export const PROGRESS_LOG_KINDS = Object.freeze([
  "note",
  "progress",
  "decision",
  "blocker",
  "result",
]);

export const EVIDENCE_KINDS = Object.freeze([
  "file",
  "url",
  "image",
  "log",
  "commit",
]);

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const SOURCE_TYPES = new Set(["manual", "joy", "github", "google", "import"]);

function requiredId(value, field = "id") {
  const id = String(value || "").trim().toLowerCase();
  if (!ID_PATTERN.test(id)) {
    throw new TypeError(`${field} must use 1-80 lowercase letters, numbers, dots, underscores, or hyphens`);
  }
  return id;
}

function requiredText(value, field, maxLength = 240) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(`${field} is required`);
  if (text.length > maxLength) throw new TypeError(`${field} must be at most ${maxLength} characters`);
  return text;
}

function optionalText(value, maxLength = 4_000) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, maxLength);
}

function nullableText(value, maxLength = 4_000) {
  const text = optionalText(value, maxLength);
  return text || null;
}

function enumValue(value, allowed, fallback, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (!allowed.includes(normalized)) {
    throw new TypeError(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return normalized;
}

function timestamp(value, fallback = Date.now()) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.trunc(numeric) : fallback;
}

function nullableTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  return timestamp(value, null);
}

function percentage(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function position(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function stringList(value, maxItems = 30, maxLength = 500) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function sourceType(value) {
  const normalized = String(value || "manual").trim().toLowerCase();
  return SOURCE_TYPES.has(normalized) ? normalized : "import";
}

function commonSource(input) {
  return {
    sourceType: sourceType(input.sourceType),
    sourceRef: nullableText(input.sourceRef, 1_000),
  };
}

export function normalizeProject(input = {}, now = Date.now()) {
  const createdAt = timestamp(input.createdAt, now);
  const status = enumValue(input.status, PROJECT_STATUSES, "planned", "project.status");
  return {
    schemaVersion: JOY_CORE_SCHEMA_VERSION,
    id: requiredId(input.id, "project.id"),
    title: requiredText(input.title, "project.title"),
    summary: optionalText(input.summary),
    status,
    progress: status === "completed" ? 100 : percentage(input.progress),
    currentStageId: nullableText(input.currentStageId, 80),
    currentFocus: optionalText(input.currentFocus, 1_000),
    nextAction: optionalText(input.nextAction, 1_000),
    blockers: stringList(input.blockers),
    ...commonSource(input),
    metadata: plainObject(input.metadata),
    version: Math.max(0, position(input.version)),
    createdAt,
    updatedAt: timestamp(input.updatedAt, Math.max(createdAt, now)),
    archivedAt: status === "archived"
      ? timestamp(input.archivedAt, now)
      : nullableTimestamp(input.archivedAt),
  };
}

export function normalizeTask(input = {}, now = Date.now()) {
  const createdAt = timestamp(input.createdAt, now);
  const status = enumValue(input.status, TASK_STATUSES, "todo", "task.status");
  return {
    schemaVersion: JOY_CORE_SCHEMA_VERSION,
    id: requiredId(input.id, "task.id"),
    projectId: requiredId(input.projectId, "task.projectId"),
    milestoneId: input.milestoneId ? requiredId(input.milestoneId, "task.milestoneId") : null,
    title: requiredText(input.title, "task.title"),
    description: optionalText(input.description),
    status,
    priority: enumValue(input.priority, TASK_PRIORITIES, "normal", "task.priority"),
    dueAt: nullableTimestamp(input.dueAt),
    scheduledFor: nullableTimestamp(input.scheduledFor),
    completedAt: status === "done"
      ? timestamp(input.completedAt, now)
      : nullableTimestamp(input.completedAt),
    position: position(input.position),
    ...commonSource(input),
    metadata: plainObject(input.metadata),
    version: Math.max(0, position(input.version)),
    createdAt,
    updatedAt: timestamp(input.updatedAt, Math.max(createdAt, now)),
  };
}

export function normalizeMilestone(input = {}, now = Date.now()) {
  const createdAt = timestamp(input.createdAt, now);
  const status = enumValue(input.status, MILESTONE_STATUSES, "planned", "milestone.status");
  return {
    schemaVersion: JOY_CORE_SCHEMA_VERSION,
    id: requiredId(input.id, "milestone.id"),
    projectId: requiredId(input.projectId, "milestone.projectId"),
    title: requiredText(input.title, "milestone.title"),
    description: optionalText(input.description),
    status,
    targetAt: nullableTimestamp(input.targetAt),
    completedAt: status === "completed"
      ? timestamp(input.completedAt, now)
      : nullableTimestamp(input.completedAt),
    position: position(input.position),
    ...commonSource(input),
    metadata: plainObject(input.metadata),
    version: Math.max(0, position(input.version)),
    createdAt,
    updatedAt: timestamp(input.updatedAt, Math.max(createdAt, now)),
  };
}

export function normalizeProgressLog(input = {}, now = Date.now()) {
  return {
    schemaVersion: JOY_CORE_SCHEMA_VERSION,
    id: requiredId(input.id, "progressLog.id"),
    projectId: requiredId(input.projectId, "progressLog.projectId"),
    taskId: input.taskId ? requiredId(input.taskId, "progressLog.taskId") : null,
    kind: enumValue(input.kind, PROGRESS_LOG_KINDS, "note", "progressLog.kind"),
    title: requiredText(input.title, "progressLog.title"),
    detail: optionalText(input.detail, 20_000),
    progressAfter: input.progressAfter === null || input.progressAfter === undefined
      ? null
      : percentage(input.progressAfter),
    occurredAt: timestamp(input.occurredAt, now),
    ...commonSource(input),
    metadata: plainObject(input.metadata),
    createdAt: timestamp(input.createdAt, now),
  };
}

export function normalizeEvidence(input = {}, now = Date.now()) {
  return {
    schemaVersion: JOY_CORE_SCHEMA_VERSION,
    id: requiredId(input.id, "evidence.id"),
    projectId: requiredId(input.projectId, "evidence.projectId"),
    taskId: input.taskId ? requiredId(input.taskId, "evidence.taskId") : null,
    progressLogId: input.progressLogId
      ? requiredId(input.progressLogId, "evidence.progressLogId")
      : null,
    kind: enumValue(input.kind, EVIDENCE_KINDS, "file", "evidence.kind"),
    label: requiredText(input.label, "evidence.label"),
    uri: requiredText(input.uri, "evidence.uri", 2_000),
    contentType: nullableText(input.contentType, 200),
    ...commonSource(input),
    metadata: plainObject(input.metadata),
    createdAt: timestamp(input.createdAt, now),
  };
}

export function serializeJoyCoreEntity(entity) {
  return JSON.parse(JSON.stringify(entity));
}
