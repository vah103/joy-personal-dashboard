CREATE TABLE IF NOT EXISTS sale_viewings (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  viewing_address TEXT NOT NULL,
  viewing_at INTEGER NOT NULL,
  reminder_at INTEGER,
  reminder_notified_at INTEGER,
  followup_at INTEGER,
  followup_notified_at INTEGER,
  cancelled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sale_viewings_user_upcoming_idx
ON sale_viewings (user_email, cancelled_at, viewing_at);

CREATE INDEX IF NOT EXISTS sale_viewings_reminder_due_idx
ON sale_viewings (cancelled_at, reminder_notified_at, reminder_at);

CREATE INDEX IF NOT EXISTS sale_viewings_followup_due_idx
ON sale_viewings (cancelled_at, followup_notified_at, followup_at);
