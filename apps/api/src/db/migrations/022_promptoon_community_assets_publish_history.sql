CREATE TABLE IF NOT EXISTS promptoon_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_id UUID NOT NULL REFERENCES promptoon_publish(id) ON DELETE CASCADE,
  discussion_id UUID NULL REFERENCES promptoon_episode_discussion(id) ON DELETE SET NULL,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  moderation_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_comment_status CHECK (status IN ('visible', 'hidden', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_promptoon_comment_publish_created
  ON promptoon_comment(publish_id, created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_promptoon_comment_publish_status
  ON promptoon_comment(publish_id, status);

CREATE TABLE IF NOT EXISTS promptoon_discourse_thread_sync (
  publish_id UUID PRIMARY KEY REFERENCES promptoon_publish(id) ON DELETE CASCADE,
  discourse_topic_id TEXT NULL,
  provider_status TEXT NOT NULL DEFAULT 'pending',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_discourse_thread_sync_status CHECK (provider_status IN ('pending', 'synced', 'failed'))
);

CREATE TABLE IF NOT EXISTS promptoon_asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  asset_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'upload',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_asset_project_url UNIQUE (project_id, asset_url),
  CONSTRAINT ck_promptoon_asset_source CHECK (source IN ('project_thumbnail', 'episode_cover', 'cut_asset', 'upload')),
  CONSTRAINT ck_promptoon_asset_status CHECK (status IN ('active', 'deleted', 'replaced'))
);

CREATE INDEX IF NOT EXISTS idx_promptoon_asset_project_updated
  ON promptoon_asset(project_id, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS promptoon_asset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NULL REFERENCES promptoon_asset(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_asset_url TEXT NULL,
  next_asset_url TEXT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_asset_history_action CHECK (action IN ('created', 'metadata_updated', 'replaced', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_promptoon_asset_history_project_created
  ON promptoon_asset_history(project_id, created_at DESC, id DESC);
