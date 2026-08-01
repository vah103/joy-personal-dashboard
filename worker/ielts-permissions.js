import { JoyCoreError } from "./joy-core/service.js";

export const IELTS_ACTIONS = Object.freeze({
  READ: "ielts:read",
  TASK_UPDATE: "ielts:task:update",
  ASSESSMENT_CREATE: "ielts:assessment:create",
  ERROR_CREATE: "ielts:error:create",
  COURSE_CREATE: "ielts:course:create",
  PLAN_UPDATE: "ielts:plan:update",
  LISTENING_TRANSCRIBE: "ielts:listening:transcribe",
  LISTENING_REVIEW: "ielts:listening:review",
});

const ROLE_PERMISSIONS = Object.freeze({
  viewer: new Set([
    IELTS_ACTIONS.READ,
  ]),
  assistant: new Set(Object.values(IELTS_ACTIONS)),
  owner: new Set(Object.values(IELTS_ACTIONS)),
});

export function canPerformIeltsAction(role, action, scopes = null) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (!ROLE_PERMISSIONS[normalizedRole]?.has(action)) return false;
  if (!Array.isArray(scopes) || scopes.length === 0) return true;
  return scopes.includes("*")
    || scopes.includes("ielts:*")
    || scopes.includes(action);
}

export function assertIeltsPermission(context, action) {
  if (canPerformIeltsAction(context?.role, action, context?.scopes)) return;
  throw new JoyCoreError("IELTS_FORBIDDEN", 403, { action });
}
