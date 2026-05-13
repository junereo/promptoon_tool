CREATE TABLE IF NOT EXISTS promptoon_platform_admin (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'platform_admin',
  granted_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_platform_admin_role CHECK (role = 'platform_admin')
);

CREATE INDEX IF NOT EXISTS idx_promptoon_platform_admin_created
  ON promptoon_platform_admin(created_at DESC);
