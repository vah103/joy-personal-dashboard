CREATE TABLE IF NOT EXISTS google_docs_tokens (
  user_email TEXT PRIMARY KEY,
  refresh_token_encrypted TEXT NOT NULL,
  access_token_encrypted TEXT,
  access_token_expires_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ielts_course_knowledge (
  user_email TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  revision_id TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  synced_at INTEGER NOT NULL DEFAULT 0,
  last_checked_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ielts_course_knowledge_due_idx
ON ielts_course_knowledge (last_checked_at);
