CREATE TABLE IF NOT EXISTS promptoon_landing_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_landing_config_singleton CHECK (id)
);

INSERT INTO promptoon_landing_config (id, enabled)
VALUES (TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS promptoon_landing_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_landing_item_target_type CHECK (target_type IN ('publish', 'project')),
  CONSTRAINT ck_promptoon_landing_item_status CHECK (status IN ('active', 'disabled')),
  CONSTRAINT uq_promptoon_landing_item_target UNIQUE (target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_promptoon_landing_item_status_order
  ON promptoon_landing_item(status, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_promptoon_landing_item_target
  ON promptoon_landing_item(target_type, target_id);
