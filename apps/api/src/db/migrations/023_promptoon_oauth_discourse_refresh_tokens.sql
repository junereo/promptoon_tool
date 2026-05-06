ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT NULL,
  ADD COLUMN IF NOT EXISTS display_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS discourse_username TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_not_null
  ON users(LOWER(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_discourse_username_not_null
  ON users(LOWER(discourse_username))
  WHERE discourse_username IS NOT NULL;

ALTER TABLE promptoon_oauth_account
  ADD COLUMN IF NOT EXISTS email TEXT NULL,
  ADD COLUMN IF NOT EXISTS display_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS access_token_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT NULL;

ALTER TABLE promptoon_session
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS replaced_by_session_id UUID NULL,
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_session_refresh_hash
  ON promptoon_session(token_hash)
  WHERE token_hash IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_session_revoked
  ON promptoon_session(user_id, revoked_at)
  WHERE revoked_at IS NOT NULL;
