UPDATE joy_core_meta
SET value = '2', updated_at = unixepoch('now') * 1000
WHERE key = 'schema_version';

CREATE TABLE IF NOT EXISTS joy_project_snapshots (
  user_email TEXT NOT NULL,
  project_id TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  current_goal TEXT NOT NULL DEFAULT '',
  current_state_json TEXT NOT NULL DEFAULT '{}',
  next_actions_json TEXT NOT NULL DEFAULT '[]',
  latest_session_id TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, project_id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS joy_work_sessions (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  summary TEXT NOT NULL DEFAULT '',
  outcomes_json TEXT NOT NULL DEFAULT '[]',
  next_actions_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  actor_type TEXT NOT NULL DEFAULT 'assistant'
    CHECK (actor_type IN ('user', 'assistant', 'system', 'import')),
  actor_id TEXT NOT NULL,
  client_request_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS joy_work_sessions_request_idx
ON joy_work_sessions (user_email, client_request_id)
WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS joy_work_sessions_project_idx
ON joy_work_sessions (user_email, project_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS joy_work_session_events (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note'
    CHECK (kind IN (
      'note', 'decision', 'command', 'result', 'blocker', 'evidence',
      'repo_ref', 'task_update', 'plan_update', 'code_change', 'test', 'other'
    )),
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  occurred_at INTEGER NOT NULL,
  client_request_id TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, session_id)
    REFERENCES joy_work_sessions(user_email, id) ON DELETE CASCADE,
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS joy_work_session_events_request_idx
ON joy_work_session_events (user_email, client_request_id)
WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS joy_work_session_events_session_idx
ON joy_work_session_events (user_email, session_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS joy_work_session_events_project_idx
ON joy_work_session_events (user_email, project_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS joy_project_decisions (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT,
  title TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'reversed')),
  supersedes_id TEXT,
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS joy_project_decisions_project_idx
ON joy_project_decisions (user_email, project_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS joy_project_blockers (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved')),
  resolution TEXT NOT NULL DEFAULT '',
  opened_at INTEGER NOT NULL,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS joy_project_blockers_project_idx
ON joy_project_blockers (user_email, project_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS joy_project_memory_evidence (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note'
    CHECK (kind IN ('file', 'url', 'image', 'log', 'commit', 'test', 'metric', 'note')),
  uri TEXT,
  detail TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS joy_project_memory_evidence_project_idx
ON joy_project_memory_evidence (user_email, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS joy_project_repo_refs (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT,
  repo_full_name TEXT NOT NULL,
  ref_type TEXT NOT NULL
    CHECK (ref_type IN ('branch', 'commit', 'pull_request', 'issue', 'workflow', 'file', 'tag')),
  ref TEXT NOT NULL,
  uri TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'merged', 'closed', 'failed', 'superseded')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  FOREIGN KEY (user_email, project_id)
    REFERENCES joy_core_projects(user_email, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS joy_project_repo_refs_project_idx
ON joy_project_repo_refs (user_email, project_id, updated_at DESC);
