CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  expiration_time INTEGER,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
ON push_subscriptions (user_email, updated_at DESC);

CREATE TABLE IF NOT EXISTS rain_notification_state (
  user_email TEXT PRIMARY KEY,
  last_window_key TEXT NOT NULL DEFAULT '',
  last_notified_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
