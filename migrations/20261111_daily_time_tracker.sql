-- Daily Time Tracker is intentionally separate from Daily Day templates and streaks.
CREATE TABLE IF NOT EXISTS daily_time_tracker_state (
  user_email TEXT PRIMARY KEY,
  active_activity TEXT,
  active_started_at INTEGER,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_time_tracker_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  activity TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS daily_time_tracker_sessions_by_user_time
  ON daily_time_tracker_sessions (user_email, ended_at, started_at);
