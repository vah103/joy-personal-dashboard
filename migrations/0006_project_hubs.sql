CREATE TABLE IF NOT EXISTS project_hubs (
  user_email TEXT NOT NULL,
  project_id TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, project_id)
);
