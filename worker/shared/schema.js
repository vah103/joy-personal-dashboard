// D1 schema ownership belongs to files in migrations/. These compatibility
// exports remain temporarily so older modules and tests fail safely without
// executing request-time DDL.
export const CREATE_TASK_DELETIONS_TABLE = "SELECT 1";
export const CREATE_TASK_REMINDERS_TABLE = "SELECT 1";
export const CREATE_TASK_REMINDERS_DUE_INDEX = "SELECT 1";
export const CREATE_FOCUS_REMINDERS_TABLE = "SELECT 1";
export const CREATE_DAILY_BRIEF_META_TABLE = "SELECT 1";
export const CREATE_FINANCE_P1008_TABLE = "SELECT 1";
export const CREATE_FINANCE_P1008_SHOPPING_TABLE = "SELECT 1";

export async function ensureReminderTables() {
  // Tables are provisioned by migrations/20260731_canonical_runtime_schema.sql.
}

export async function ensureDailyBriefMetaTable() {
  // Tables are provisioned by migrations/20260731_canonical_runtime_schema.sql.
}
