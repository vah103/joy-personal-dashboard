CREATE TABLE IF NOT EXISTS finance_transactions (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'actual' CHECK (status IN ('actual', 'planned')),
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'joy',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (user_email, id)
);

CREATE INDEX IF NOT EXISTS finance_transactions_user_month_idx
ON finance_transactions (user_email, year, month, deleted_at, occurred_on DESC);

CREATE INDEX IF NOT EXISTS finance_transactions_user_status_idx
ON finance_transactions (user_email, status, deleted_at, updated_at DESC);
