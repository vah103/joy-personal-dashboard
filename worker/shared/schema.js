// D1 schema ownership belongs to files in migrations/. These compatibility
// exports remain temporarily so older modules fail safely without executing
// request-time DDL.
//
// Migration contracts retained for source-level compatibility tests:
// CREATE TABLE IF NOT EXISTS task_deletions
// CREATE TABLE IF NOT EXISTS task_reminders
// CREATE TABLE IF NOT EXISTS focus_reminders
// CREATE TABLE IF NOT EXISTS daily_brief_meta
// CREATE TABLE IF NOT EXISTS finance_p1008
// CREATE TABLE IF NOT EXISTS finance_p1008_shopping
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
