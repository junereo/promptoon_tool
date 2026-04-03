CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  login_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_users_login_id UNIQUE (login_id)
);

INSERT INTO users (id, login_id, password_hash)
SELECT DISTINCT created_by, 'dummy_' || created_by, 'NO_LOGIN_POSSIBLE'
FROM promptoon_project
WHERE created_by IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, login_id, password_hash)
SELECT DISTINCT created_by, 'dummy_' || created_by, 'NO_LOGIN_POSSIBLE'
FROM promptoon_publish
WHERE created_by IS NOT NULL
ON CONFLICT (id) DO NOTHING;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_promptoon_project_created_by_user'
  ) THEN
    ALTER TABLE promptoon_project
      ADD CONSTRAINT fk_promptoon_project_created_by_user
      FOREIGN KEY (created_by)
      REFERENCES users(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_promptoon_publish_created_by_user'
  ) THEN
    ALTER TABLE promptoon_publish
      ADD CONSTRAINT fk_promptoon_publish_created_by_user
      FOREIGN KEY (created_by)
      REFERENCES users(id)
      ON DELETE RESTRICT;
  END IF;
END $$;
