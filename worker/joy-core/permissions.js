export const JOY_CORE_ROLES = Object.freeze(["owner", "assistant", "viewer"]);

export const JOY_CORE_ACTIONS = Object.freeze({
  PROJECT_READ: "project:read",
  PROJECT_CREATE: "project:create",
  PROJECT_UPDATE: "project:update",
  PROJECT_ARCHIVE: "project:archive",
  PROJECT_DELETE: "project:delete",
  TASK_READ: "task:read",
  TASK_CREATE: "task:create",
  TASK_UPDATE: "task:update",
  TASK_DELETE: "task:delete",
  MILESTONE_READ: "milestone:read",
  MILESTONE_CREATE: "milestone:create",
  MILESTONE_UPDATE: "milestone:update",
  MILESTONE_DELETE: "milestone:delete",
  LOG_READ: "log:read",
  LOG_CREATE: "log:create",
  LOG_DELETE: "log:delete",
  EVIDENCE_READ: "evidence:read",
  EVIDENCE_CREATE: "evidence:create",
  EVIDENCE_DELETE: "evidence:delete",
  WORKSPACE_READ: "workspace:read",
  WORKSPACE_UPDATE: "workspace:update",
  SESSION_CREATE: "session:create",
  SESSION_UPDATE: "session:update",
  MEMORY_CREATE: "memory:create",
  REPOSITORY_READ: "repository:read",
  REPOSITORY_BRANCH_CREATE: "repository:branch:create",
  REPOSITORY_WRITE: "repository:write",
  REPOSITORY_CHECK_RUN: "repository:checks:run",
  REPOSITORY_PR_CREATE: "repository:pr:create",
  ACCESS_READ: "access:read",
  ACCESS_MANAGE: "access:manage",
  AUDIT_READ: "audit:read",
});

const READ_ACTIONS = [
  JOY_CORE_ACTIONS.PROJECT_READ,
  JOY_CORE_ACTIONS.TASK_READ,
  JOY_CORE_ACTIONS.MILESTONE_READ,
  JOY_CORE_ACTIONS.LOG_READ,
  JOY_CORE_ACTIONS.EVIDENCE_READ,
  JOY_CORE_ACTIONS.WORKSPACE_READ,
  JOY_CORE_ACTIONS.REPOSITORY_READ,
];

const ROLE_PERMISSIONS = Object.freeze({
  viewer: new Set(READ_ACTIONS),
  assistant: new Set([
    ...READ_ACTIONS,
    JOY_CORE_ACTIONS.PROJECT_UPDATE,
    JOY_CORE_ACTIONS.TASK_CREATE,
    JOY_CORE_ACTIONS.TASK_UPDATE,
    JOY_CORE_ACTIONS.MILESTONE_CREATE,
    JOY_CORE_ACTIONS.MILESTONE_UPDATE,
    JOY_CORE_ACTIONS.LOG_CREATE,
    JOY_CORE_ACTIONS.EVIDENCE_CREATE,
    JOY_CORE_ACTIONS.WORKSPACE_UPDATE,
    JOY_CORE_ACTIONS.SESSION_CREATE,
    JOY_CORE_ACTIONS.SESSION_UPDATE,
    JOY_CORE_ACTIONS.MEMORY_CREATE,
    JOY_CORE_ACTIONS.REPOSITORY_BRANCH_CREATE,
    JOY_CORE_ACTIONS.REPOSITORY_WRITE,
    JOY_CORE_ACTIONS.REPOSITORY_CHECK_RUN,
    JOY_CORE_ACTIONS.REPOSITORY_PR_CREATE,
  ]),
  owner: new Set(Object.values(JOY_CORE_ACTIONS)),
});

export function normalizeJoyCoreRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return JOY_CORE_ROLES.includes(role) ? role : null;
}

export function canPerformJoyCoreAction(role, action, scopes = null) {
  const normalizedRole = normalizeJoyCoreRole(role);
  if (!normalizedRole || !Object.values(JOY_CORE_ACTIONS).includes(action)) return false;
  if (!ROLE_PERMISSIONS[normalizedRole].has(action)) return false;
  if (!Array.isArray(scopes) || scopes.length === 0) return true;
  return scopes.includes("*") || scopes.includes(action);
}

export function assertJoyCorePermission(role, action, scopes = null) {
  if (!canPerformJoyCoreAction(role, action, scopes)) {
    const error = new Error("JOY_CORE_FORBIDDEN");
    error.code = "JOY_CORE_FORBIDDEN";
    error.status = 403;
    throw error;
  }
}
