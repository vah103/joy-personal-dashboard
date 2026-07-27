CREATE TABLE IF NOT EXISTS ielts_core_states (
  user_email TEXT PRIMARY KEY,
  data_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ielts_core_states_updated_at_idx
  ON ielts_core_states (updated_at);

CREATE TABLE IF NOT EXISTS ielts_notification_state (
  user_email TEXT NOT NULL,
  date_key TEXT NOT NULL,
  notification_kind TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, date_key, notification_kind)
);

CREATE INDEX IF NOT EXISTS ielts_notification_state_sent_at_idx
  ON ielts_notification_state (sent_at);
