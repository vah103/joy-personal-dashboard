CREATE TABLE IF NOT EXISTS joy_projects (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  focus TEXT NOT NULL,
  next_action TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  accent TEXT NOT NULL DEFAULT 'slate',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id)
);

CREATE INDEX IF NOT EXISTS joy_projects_user_active_idx
ON joy_projects (user_email, archived, updated_at DESC);
