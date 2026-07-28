CREATE TABLE IF NOT EXISTS vocabulary_words (
  user_email TEXT NOT NULL,
  id TEXT NOT NULL,
  english_key TEXT NOT NULL,
  english TEXT NOT NULL,
  vietnamese TEXT NOT NULL,
  ipa TEXT NOT NULL,
  pronunciation_vi TEXT NOT NULL,
  example TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, id),
  UNIQUE (user_email, english_key)
);

CREATE INDEX IF NOT EXISTS vocabulary_words_user_updated_idx
  ON vocabulary_words (user_email, updated_at DESC);
