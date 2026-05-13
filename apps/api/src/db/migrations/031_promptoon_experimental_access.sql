CREATE TABLE IF NOT EXISTS promptoon_experimental_access_target (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  project_id UUID NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  publish_id UUID NULL REFERENCES promptoon_publish(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_experimental_access_target_type CHECK (target_type IN ('all', 'project', 'publish')),
  CONSTRAINT ck_promptoon_experimental_access_target_status CHECK (status IN ('active', 'disabled')),
  CONSTRAINT ck_promptoon_experimental_access_target_shape CHECK (
    (target_type = 'all' AND project_id IS NULL AND publish_id IS NULL)
    OR (target_type = 'project' AND project_id IS NOT NULL AND publish_id IS NULL)
    OR (target_type = 'publish' AND project_id IS NOT NULL AND publish_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_experimental_access_target_all
  ON promptoon_experimental_access_target(target_type)
  WHERE target_type = 'all';

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_experimental_access_target_project
  ON promptoon_experimental_access_target(project_id)
  WHERE target_type = 'project';

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_experimental_access_target_publish
  ON promptoon_experimental_access_target(publish_id)
  WHERE target_type = 'publish';

CREATE INDEX IF NOT EXISTS idx_promptoon_experimental_access_target_active_project
  ON promptoon_experimental_access_target(project_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_promptoon_experimental_access_target_active_publish
  ON promptoon_experimental_access_target(publish_id)
  WHERE status = 'active' AND publish_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS promptoon_experimental_invite_code (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES promptoon_experimental_access_target(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_prefix TEXT NOT NULL,
  code_suffix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  max_redemptions INTEGER NOT NULL DEFAULT 1,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_experimental_invite_code_hash UNIQUE (code_hash),
  CONSTRAINT ck_promptoon_experimental_invite_code_status CHECK (status IN ('active', 'revoked')),
  CONSTRAINT ck_promptoon_experimental_invite_code_redemptions CHECK (
    max_redemptions > 0 AND redeemed_count >= 0 AND redeemed_count <= max_redemptions
  )
);

CREATE INDEX IF NOT EXISTS idx_promptoon_experimental_invite_code_target_created
  ON promptoon_experimental_invite_code(target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS promptoon_experimental_access_grant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES promptoon_experimental_access_target(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'manual',
  source_invite_code_id UUID NULL REFERENCES promptoon_experimental_invite_code(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  granted_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_experimental_access_grant_target_user UNIQUE (target_id, user_id),
  CONSTRAINT ck_promptoon_experimental_access_grant_source CHECK (source IN ('manual', 'invite_code')),
  CONSTRAINT ck_promptoon_experimental_access_grant_status CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_promptoon_experimental_access_grant_user_active
  ON promptoon_experimental_access_grant(user_id, target_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS promptoon_experimental_invite_redemption (
  invite_code_id UUID NOT NULL REFERENCES promptoon_experimental_invite_code(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES promptoon_experimental_access_grant(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (invite_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promptoon_experimental_invite_redemption_user
  ON promptoon_experimental_invite_redemption(user_id, redeemed_at DESC);
