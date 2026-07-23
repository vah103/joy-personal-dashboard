CREATE TABLE IF NOT EXISTS scratchpads (
  user_email TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scratchpad_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS scratchpad_revisions_user_idx
ON scratchpad_revisions (user_email, created_at DESC);
