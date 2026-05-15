CREATE TABLE IF NOT EXISTS promptoon_platform_access_code (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL,
  code_prefix TEXT NOT NULL,
  code_suffix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  max_redemptions INTEGER NOT NULL DEFAULT 1,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_platform_access_code_hash UNIQUE (code_hash),
  CONSTRAINT ck_promptoon_platform_access_code_status CHECK (status IN ('active', 'revoked')),
  CONSTRAINT ck_promptoon_platform_access_code_redemptions CHECK (
    max_redemptions > 0
    AND redeemed_count >= 0
    AND redeemed_count <= max_redemptions
  )
);

CREATE INDEX IF NOT EXISTS idx_promptoon_platform_access_code_created
  ON promptoon_platform_access_code(created_at DESC);

CREATE TABLE IF NOT EXISTS promptoon_platform_access_grant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'code',
  source_code_id UUID NULL REFERENCES promptoon_platform_access_code(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  granted_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_platform_access_grant_user UNIQUE (user_id),
  CONSTRAINT ck_promptoon_platform_access_grant_source CHECK (source IN ('manual', 'code')),
  CONSTRAINT ck_promptoon_platform_access_grant_status CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_promptoon_platform_access_grant_status
  ON promptoon_platform_access_grant(status, granted_at DESC);

CREATE TABLE IF NOT EXISTS promptoon_platform_access_redemption (
  code_id UUID NOT NULL REFERENCES promptoon_platform_access_code(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES promptoon_platform_access_grant(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promptoon_platform_access_redemption_user
  ON promptoon_platform_access_redemption(user_id, redeemed_at DESC);
