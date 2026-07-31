CREATE TABLE IF NOT EXISTS joy_core_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO joy_core_meta (key, value, updated_at)
VALUES ('schema_version', '1', unixepoch('now') * 1000)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

CREATE TABLE IF NOT EXISTS joy_core_projects (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'blocked', 'paused', 'completed', 'archived')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  current_stage_id TEXT,
  current_focus TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  blockers_json TEXT NOT NULL DEFAULT '[]',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER,
  PRIMARY KEY (user_email, id)
);

CREATE INDEX IF NOT EXISTS joy_core_projects_status_idx
ON joy_core_projects (user_email, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS joy_core_milestones (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed', 'missed', 'cancelled')),
  target_at INTEGER,
  completed_at INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS joy_core_milestones_project_idx
ON joy_core_milestones (user_email, project_id, position, target_at);

CREATE TABLE IF NOT EXISTS joy_core_tasks (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  milestone_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  due_at INTEGER,
  scheduled_for INTEGER,
  completed_at INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS joy_core_tasks_project_idx
ON joy_core_tasks (user_email, project_id, status, position, due_at);

CREATE INDEX IF NOT EXISTS joy_core_tasks_due_idx
ON joy_core_tasks (user_email, status, due_at);

CREATE TABLE IF NOT EXISTS joy_core_progress_logs (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_id TEXT,
  kind TEXT NOT NULL DEFAULT 'note'
    CHECK (kind IN ('note', 'progress', 'decision', 'blocker', 'result')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  progress_after INTEGER CHECK (progress_after BETWEEN 0 AND 100),
  occurred_at INTEGER NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS joy_core_progress_logs_project_idx
ON joy_core_progress_logs (user_email, project_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS joy_core_evidence (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_id TEXT,
  progress_log_id TEXT,
  kind TEXT NOT NULL DEFAULT 'file'
    CHECK (kind IN ('file', 'url', 'image', 'log', 'commit')),
  label TEXT NOT NULL,
  uri TEXT NOT NULL,
  content_type TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS joy_core_evidence_project_idx
ON joy_core_evidence (user_email, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS joy_core_access_grants (
  user_email TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'client')),
  subject_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'assistant', 'viewer')),
  scopes_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY (user_email, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS joy_core_access_grants_subject_idx
ON joy_core_access_grants (subject_type, subject_id, revoked_at);

CREATE TABLE IF NOT EXISTS joy_core_audit_events (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'assistant', 'system', 'import')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id)
);

CREATE INDEX IF NOT EXISTS joy_core_audit_events_entity_idx
ON joy_core_audit_events (user_email, entity_type, entity_id, created_at DESC);
