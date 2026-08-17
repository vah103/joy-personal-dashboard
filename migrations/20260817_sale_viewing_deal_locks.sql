CREATE TABLE IF NOT EXISTS sale_viewing_deal_locks (
  viewing_id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  locked_at INTEGER NOT NULL,
  FOREIGN KEY (viewing_id) REFERENCES sale_viewings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sale_viewing_deal_locks_user
  ON sale_viewing_deal_locks (user_email, locked_at DESC);
