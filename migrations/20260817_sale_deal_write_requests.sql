CREATE TABLE IF NOT EXISTS sale_deal_write_requests (
  user_email TEXT NOT NULL,
  request_id TEXT NOT NULL,
  payload_revision TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('started', 'committed')),
  source_row INTEGER,
  detail_row INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, request_id)
);

CREATE INDEX IF NOT EXISTS idx_sale_deal_write_requests_state
  ON sale_deal_write_requests (user_email, state, updated_at DESC);
