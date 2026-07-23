CREATE INDEX IF NOT EXISTS tasks_user_created_idx
ON tasks (user_email, created_at DESC);
