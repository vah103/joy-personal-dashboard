export const WORK_SESSION_STATUSES = Object.freeze(["open", "completed", "cancelled"]);
export const WORK_SESSION_EVENT_KINDS = Object.freeze([
  "note",
  "decision",
  "command",
  "result",
  "blocker",
  "evidence",
  "repo_ref",
  "task_update",
  "plan_update",
  "code_change",
  "test",
  "other",
]);
export const DECISION_STATUSES = Object.freeze(["active", "superseded", "reversed"]);
export const BLOCKER_STATUSES = Object.freeze(["open", "resolved"]);
export const MEMORY_EVIDENCE_KINDS = Object.freeze([
  "file",
  "url",
  "image",
  "log",
  "commit",
  "test",
  "metric",
  "note",
]);
export const REPO_REF_TYPES = Object.freeze([
  "branch",
  "commit",
  "pull_request",
  "issue",
  "workflow",
  "file",
  "tag",
]);
export const REPO_REF_STATUSES = Object.freeze([
  "active",
  "merged",
  "closed",
  "failed",
  "superseded",
]);

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;

function requiredId(value, field) {
  const id = String(value || "").trim().toLowerCase();
  if (!ID_PATTERN.test(id)) throw new TypeError(`${field} is invalid`);
  return id;
}

function optionalId(value, field) {
  if (value === null || value === undefined || value === "") return null;
  return requiredId(value, field);
}

function requiredText(value, field, maxLength = 240) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(`${field} is required`);
  if (text.length > maxLength) throw new TypeError(`${field} is too long`);
  return text;
}

function optionalText(value, maxLength = 4_000) {
  return String(value || "").trim().slice(0, maxLength);
}

function nullableText(value, maxLength = 4_000) {
  const text = optionalText(value, maxLength);
  return text || null;
}

function timestamp(value, fallback = Date.now()) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : Math.trunc(fallback);
}

function nullableTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  return timestamp(value, null);
}

function enumValue(value, allowed, fallback, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (!allowed.includes(normalized)) throw new TypeError(`${field} is invalid`);
  return normalized;
}

function requiredEnum(value, allowed, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!allowed.includes(normalized)) throw new TypeError(`${field} is invalid`);
  return normalized;
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function stringList(value, maxItems = 30, maxLength = 2_000) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
}

export function normalizeProjectSnapshot(input = {}, now = Date.now()) {
  const createdAt = timestamp(input.createdAt, now);
  return {
    projectId: requiredId(input.projectId, "snapshot.projectId"),
    summary: optionalText(input.summary, 20_000),
    currentGoal: optionalText(input.currentGoal, 4_000),
    currentState: plainObject(input.currentState),
    nextActions: stringList(input.nextActions),
    latestSessionId: optionalId(input.latestSessionId, "snapshot.latestSessionId"),
    version: Math.max(0, Math.trunc(Number(input.version || 0))),
    createdAt,
    updatedAt: timestamp(input.updatedAt, Math.max(createdAt, now)),
  };
}

export function normalizeWorkSession(input = {}, now = Date.now()) {
  const createdAt = timestamp(input.createdAt, now);
  const status = enumValue(input.status, WORK_SESSION_STATUSES, "open", "session.status");
  return {
    id: requiredId(input.id, "session.id"),
    projectId: requiredId(input.projectId, "session.projectId"),
    title: requiredText(input.title, "session.title"),
    goal: requiredText(input.goal, "session.goal", 4_000),
    status,
    summary: optionalText(input.summary, 20_000),
    outcomes: stringList(input.outcomes, 50, 4_000),
    nextActions: stringList(input.nextActions, 30, 2_000),
    metadata: plainObject(input.metadata),
    actorType: enumValue(
      input.actorType,
      ["user", "assistant", "system", "import"],
      "assistant",
      "session.actorType",
    ),
    actorId: requiredText(input.actorId, "session.actorId", 240),
    clientRequestId: nullableText(input.clientRequestId, 80),
    version: Math.max(1, Math.trunc(Number(input.version || 1))),
    startedAt: timestamp(input.startedAt, now),
    endedAt: status === "open" ? null : nullableTimestamp(input.endedAt ?? now),
    createdAt,
    updatedAt: timestamp(input.updatedAt, Math.max(createdAt, now)),
  };
}

export function normalizeWorkSessionEvent(input = {}, now = Date.now()) {
  return {
    id: requiredId(input.id, "event.id"),
    sessionId: requiredId(input.sessionId, "event.sessionId"),
    projectId: requiredId(input.projectId, "event.projectId"),
    kind: enumValue(input.kind, WORK_SESSION_EVENT_KINDS, "note", "event.kind"),
    title: requiredText(input.title, "event.title"),
    detail: optionalText(input.detail, 20_000),
    payload: plainObject(input.payload),
    occurredAt: timestamp(input.occurredAt, now),
    clientRequestId: nullableText(input.clientRequestId, 80),
    createdAt: timestamp(input.createdAt, now),
  };
}

export function normalizeProjectDecision(input = {}, now = Date.now()) {
  return {
    id: requiredId(input.id, "decision.id"),
    projectId: requiredId(input.projectId, "decision.projectId"),
    sessionId: optionalId(input.sessionId, "decision.sessionId"),
    title: requiredText(input.title, "decision.title"),
    decision: requiredText(input.decision, "decision.decision", 20_000),
    rationale: optionalText(input.rationale, 20_000),
    status: enumValue(input.status, DECISION_STATUSES, "active", "decision.status"),
    supersedesId: optionalId(input.supersedesId, "decision.supersedesId"),
    occurredAt: timestamp(input.occurredAt, now),
    createdAt: timestamp(input.createdAt, now),
    updatedAt: timestamp(input.updatedAt, now),
  };
}

export function normalizeProjectBlocker(input = {}, now = Date.now()) {
  const status = enumValue(input.status, BLOCKER_STATUSES, "open", "blocker.status");
  return {
    id: requiredId(input.id, "blocker.id"),
    projectId: requiredId(input.projectId, "blocker.projectId"),
    sessionId: optionalId(input.sessionId, "blocker.sessionId"),
    title: requiredText(input.title, "blocker.title"),
    detail: optionalText(input.detail, 20_000),
    status,
    resolution: optionalText(input.resolution, 20_000),
    openedAt: timestamp(input.openedAt, now),
    resolvedAt: status === "resolved" ? timestamp(input.resolvedAt, now) : null,
    createdAt: timestamp(input.createdAt, now),
    updatedAt: timestamp(input.updatedAt, now),
  };
}

export function normalizeProjectMemoryEvidence(input = {}, now = Date.now()) {
  return {
    id: requiredId(input.id, "memoryEvidence.id"),
    projectId: requiredId(input.projectId, "memoryEvidence.projectId"),
    sessionId: optionalId(input.sessionId, "memoryEvidence.sessionId"),
    label: requiredText(input.label, "memoryEvidence.label"),
    kind: enumValue(input.kind, MEMORY_EVIDENCE_KINDS, "note", "memoryEvidence.kind"),
    uri: nullableText(input.uri, 2_000),
    detail: optionalText(input.detail, 20_000),
    metadata: plainObject(input.metadata),
    createdAt: timestamp(input.createdAt, now),
  };
}

export function normalizeProjectRepoRef(input = {}, now = Date.now()) {
  return {
    id: requiredId(input.id, "repoRef.id"),
    projectId: requiredId(input.projectId, "repoRef.projectId"),
    sessionId: optionalId(input.sessionId, "repoRef.sessionId"),
    repoFullName: requiredText(input.repoFullName, "repoRef.repoFullName", 240),
    refType: requiredEnum(input.refType, REPO_REF_TYPES, "repoRef.refType"),
    ref: requiredText(input.ref, "repoRef.ref", 1_000),
    uri: nullableText(input.uri, 2_000),
    status: enumValue(input.status, REPO_REF_STATUSES, "active", "repoRef.status"),
    metadata: plainObject(input.metadata),
    createdAt: timestamp(input.createdAt, now),
    updatedAt: timestamp(input.updatedAt, now),
  };
}
