export const CREATE_TASK_DELETIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS task_deletions (
    user_email TEXT NOT NULL,
    task_id TEXT NOT NULL,
    deleted_at INTEGER NOT NULL,
    PRIMARY KEY (user_email, task_id)
  )
`;

export const CREATE_TASK_REMINDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS task_reminders (
    user_email TEXT NOT NULL,
    task_id TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    repeat_type TEXT NOT NULL DEFAULT 'once',
    repeat_days TEXT NOT NULL DEFAULT '[]',
    notification_enabled INTEGER NOT NULL DEFAULT 1,
    snoozed_until INTEGER,
    last_notified_at INTEGER,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_email, task_id)
  )
`;

export const CREATE_TASK_REMINDERS_DUE_INDEX = `
  CREATE INDEX IF NOT EXISTS task_reminders_due_idx
  ON task_reminders (notification_enabled, status, due_at)
`;

export const CREATE_FOCUS_REMINDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS focus_reminders (
    user_email TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT 'Stay focused',
    start_time TEXT NOT NULL DEFAULT '08:00',
    end_time TEXT NOT NULL DEFAULT '23:30',
    min_minutes INTEGER NOT NULL DEFAULT 60,
    max_minutes INTEGER NOT NULL DEFAULT 180,
    next_at INTEGER,
    updated_at INTEGER NOT NULL
  )
`;

export const CREATE_DAILY_BRIEF_META_TABLE = `
  CREATE TABLE IF NOT EXISTS daily_brief_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

export const CREATE_FINANCE_P1008_TABLE = `
  CREATE TABLE IF NOT EXISTS finance_p1008 (
    user_email TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL
  )
`;

export async function ensureReminderTables(env) {
  await env.DB.batch([
    env.DB.prepare(CREATE_TASK_REMINDERS_TABLE),
    env.DB.prepare(CREATE_TASK_REMINDERS_DUE_INDEX),
    env.DB.prepare(CREATE_FOCUS_REMINDERS_TABLE),
  ]);
}

export async function ensureDailyBriefMetaTable(env) {
  await env.DB.prepare(CREATE_DAILY_BRIEF_META_TABLE).run();
}
