CREATE UNIQUE INDEX IF NOT EXISTS joy_work_sessions_one_open_project_idx
ON joy_work_sessions (user_email, project_id)
WHERE status = 'open';
