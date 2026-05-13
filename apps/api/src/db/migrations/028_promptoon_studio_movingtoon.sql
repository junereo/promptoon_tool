ALTER TABLE promptoon_project
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'promptoon',
  ADD CONSTRAINT ck_promptoon_project_kind CHECK (kind IN ('promptoon', 'movingtoon', 'hybrid'));

ALTER TABLE promptoon_project
  DROP CONSTRAINT IF EXISTS ck_promptoon_project_status;

ALTER TABLE promptoon_project
  ADD CONSTRAINT ck_promptoon_project_status CHECK (status IN ('draft', 'in_review', 'published', 'archived'));

CREATE TABLE IF NOT EXISTS promptoon_movingtoon_episode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NULL,
  episode_no INTEGER NOT NULL,
  original_video_url TEXT NULL,
  video_url TEXT NULL,
  thumbnail_url TEXT NULL,
  duration_sec INTEGER NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  processing_status TEXT NOT NULL DEFAULT 'empty',
  publish_status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ NULL,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_movingtoon_episode_no UNIQUE (project_id, episode_no),
  CONSTRAINT ck_promptoon_movingtoon_aspect_ratio CHECK (aspect_ratio IN ('9:16', '16:9', '1:1')),
  CONSTRAINT ck_promptoon_movingtoon_processing_status CHECK (processing_status IN ('empty', 'uploading', 'processing', 'ready', 'failed')),
  CONSTRAINT ck_promptoon_movingtoon_publish_status CHECK (publish_status IN ('draft', 'scheduled', 'published', 'unpublished'))
);

CREATE INDEX IF NOT EXISTS idx_promptoon_movingtoon_episode_project
  ON promptoon_movingtoon_episode(project_id, episode_no);

CREATE INDEX IF NOT EXISTS idx_promptoon_movingtoon_episode_processing
  ON promptoon_movingtoon_episode(processing_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS promptoon_movingtoon_processing_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES promptoon_movingtoon_episode(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'uploading',
  source_path TEXT NOT NULL,
  output_scope TEXT NOT NULL,
  error_message TEXT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_movingtoon_job_status CHECK (status IN ('uploading', 'processing', 'ready', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_promptoon_movingtoon_job_status
  ON promptoon_movingtoon_processing_job(status, updated_at ASC);

CREATE TABLE IF NOT EXISTS promptoon_movingtoon_publish (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES promptoon_movingtoon_episode(id) ON DELETE CASCADE,
  channel_id UUID NULL REFERENCES promptoon_channel(id) ON DELETE SET NULL,
  series_id UUID NULL REFERENCES promptoon_series(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_movingtoon_publish_status CHECK (status IN ('published', 'unpublished'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_movingtoon_publish_active_episode
  ON promptoon_movingtoon_publish(episode_id)
  WHERE status = 'published';

ALTER TABLE promptoon_short_clip
  ADD COLUMN IF NOT EXISTS movingtoon_publish_id UUID NULL REFERENCES promptoon_movingtoon_publish(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_short_clip_movingtoon_publish
  ON promptoon_short_clip(movingtoon_publish_id)
  WHERE movingtoon_publish_id IS NOT NULL;

ALTER TABLE promptoon_feed_item
  ADD COLUMN IF NOT EXISTS movingtoon_publish_id UUID NULL REFERENCES promptoon_movingtoon_publish(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS movingtoon_episode_id UUID NULL REFERENCES promptoon_movingtoon_episode(id) ON DELETE CASCADE;

ALTER TABLE promptoon_feed_item
  ALTER COLUMN publish_id DROP NOT NULL,
  ALTER COLUMN episode_id DROP NOT NULL,
  ALTER COLUMN start_cut_snapshot_json DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_feed_item_movingtoon_episode
  ON promptoon_feed_item(movingtoon_episode_id)
  WHERE movingtoon_episode_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_feed_item_movingtoon_publish
  ON promptoon_feed_item(movingtoon_publish_id)
  WHERE movingtoon_publish_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS promptoon_user_movingtoon_like (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movingtoon_publish_id UUID NOT NULL REFERENCES promptoon_movingtoon_publish(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, movingtoon_publish_id)
);

CREATE INDEX IF NOT EXISTS idx_promptoon_user_movingtoon_like_publish
  ON promptoon_user_movingtoon_like(movingtoon_publish_id);

CREATE TABLE IF NOT EXISTS promptoon_user_movingtoon_bookmark (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movingtoon_publish_id UUID NOT NULL REFERENCES promptoon_movingtoon_publish(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, movingtoon_publish_id)
);

CREATE INDEX IF NOT EXISTS idx_promptoon_user_movingtoon_bookmark_publish
  ON promptoon_user_movingtoon_bookmark(movingtoon_publish_id);

ALTER TABLE promptoon_comment
  ADD COLUMN IF NOT EXISTS movingtoon_publish_id UUID NULL REFERENCES promptoon_movingtoon_publish(id) ON DELETE CASCADE;

ALTER TABLE promptoon_comment
  ALTER COLUMN publish_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_comment_movingtoon_publish_created
  ON promptoon_comment(movingtoon_publish_id, created_at ASC, id ASC)
  WHERE movingtoon_publish_id IS NOT NULL;

ALTER TABLE promptoon_comment
  DROP CONSTRAINT IF EXISTS ck_promptoon_comment_publish_target;

ALTER TABLE promptoon_comment
  ADD CONSTRAINT ck_promptoon_comment_publish_target CHECK (
    (publish_id IS NOT NULL AND movingtoon_publish_id IS NULL)
    OR (publish_id IS NULL AND movingtoon_publish_id IS NOT NULL)
  );
