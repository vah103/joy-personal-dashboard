CREATE TABLE IF NOT EXISTS task_deletions (
  user_email TEXT NOT NULL,
  task_id TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, task_id)
);

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
);

CREATE INDEX IF NOT EXISTS task_reminders_due_idx
ON task_reminders (notification_enabled, status, due_at);

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
);

CREATE TABLE IF NOT EXISTS daily_brief_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_brief_stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  key_points_json TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL,
  scope TEXT NOT NULL,
  source_name TEXT NOT NULL,
  article_url TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 1,
  score INTEGER NOT NULL,
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS daily_brief_active_idx
ON daily_brief_stories (expires_at, score DESC, published_at DESC);

CREATE TABLE IF NOT EXISTS finance_p1008 (
  user_email TEXT PRIMARY KEY,
  data_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_p1008_shopping (
  user_email TEXT PRIMARY KEY,
  data_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS google_integrations (
  user_email TEXT PRIMARY KEY,
  gmail_enabled INTEGER NOT NULL DEFAULT 0,
  sheets_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ielts_core_states (
  user_email TEXT PRIMARY KEY,
  data_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ielts_notification_state (
  user_email TEXT NOT NULL,
  date_key TEXT NOT NULL,
  notification_kind TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, date_key, notification_kind)
);

CREATE TABLE IF NOT EXISTS project_hubs (
  user_email TEXT NOT NULL,
  project_id TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, project_id)
);

CREATE TABLE IF NOT EXISTS vocabulary_words (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  english_key TEXT NOT NULL,
  english TEXT NOT NULL,
  vietnamese TEXT NOT NULL,
  ipa TEXT NOT NULL,
  pronunciation_vi TEXT NOT NULL,
  example TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  UNIQUE (user_email, english_key)
);

CREATE INDEX IF NOT EXISTS vocabulary_words_user_updated_idx
ON vocabulary_words (user_email, updated_at DESC);
