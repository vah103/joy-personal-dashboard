CREATE TABLE IF NOT EXISTS sale_viewing_commissions (
  viewing_id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'received')),
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sale_viewing_commissions_user_idx
ON sale_viewing_commissions (user_email, updated_at);
