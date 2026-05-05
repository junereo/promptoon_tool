CREATE TABLE IF NOT EXISTS promptoon_channel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  handle TEXT NULL,
  avatar_url TEXT NULL,
  banner_url TEXT NULL,
  bio TEXT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_channel_project UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS promptoon_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  channel_id UUID NULL REFERENCES promptoon_channel(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  cover_image_url TEXT NULL,
  status TEXT NOT NULL DEFAULT 'ongoing',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_series_project_slug UNIQUE (project_id, slug)
);

ALTER TABLE promptoon_publish
  ADD COLUMN IF NOT EXISTS channel_id UUID NULL REFERENCES promptoon_channel(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_id UUID NULL REFERENCES promptoon_series(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_publish_channel_created_at
  ON promptoon_publish(channel_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_promptoon_publish_series_episode
  ON promptoon_publish(series_id, episode_id);

CREATE TABLE IF NOT EXISTS promptoon_feed_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_id UUID NOT NULL REFERENCES promptoon_publish(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  channel_id UUID NULL REFERENCES promptoon_channel(id) ON DELETE SET NULL,
  series_id UUID NULL REFERENCES promptoon_series(id) ON DELETE SET NULL,
  episode_id UUID NOT NULL REFERENCES promptoon_episode(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'promptoon',
  title TEXT NOT NULL,
  description TEXT NULL,
  cover_image_url TEXT NULL,
  video_url TEXT NULL,
  duration_sec INTEGER NULL,
  start_cut_snapshot_json JSONB NULL,
  choice_count INTEGER NOT NULL DEFAULT 0,
  metrics_json JSONB NOT NULL DEFAULT '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb,
  entry_json JSONB NOT NULL,
  payload_json JSONB NOT NULL,
  ranking_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_feed_item_episode UNIQUE (episode_id)
);

CREATE INDEX IF NOT EXISTS idx_promptoon_feed_item_published_id
  ON promptoon_feed_item(published_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_promptoon_feed_item_channel
  ON promptoon_feed_item(channel_id, published_at DESC);

CREATE TABLE IF NOT EXISTS promptoon_channel_home_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES promptoon_channel(id) ON DELETE CASCADE,
  profile_json JSONB NOT NULL,
  featured_series_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  latest_episodes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  latest_shorts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  community_meta_json JSONB NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_channel_home_projection_channel UNIQUE (channel_id)
);

CREATE TABLE IF NOT EXISTS promptoon_short_clip (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  channel_id UUID NULL REFERENCES promptoon_channel(id) ON DELETE SET NULL,
  series_id UUID NULL REFERENCES promptoon_series(id) ON DELETE SET NULL,
  episode_id UUID NULL REFERENCES promptoon_episode(id) ON DELETE SET NULL,
  publish_id UUID NULL REFERENCES promptoon_publish(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  video_url TEXT NULL,
  thumbnail_url TEXT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'published',
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promptoon_user_like (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  publish_id UUID NOT NULL REFERENCES promptoon_publish(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, publish_id)
);

CREATE TABLE IF NOT EXISTS promptoon_user_bookmark (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  publish_id UUID NOT NULL REFERENCES promptoon_publish(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, publish_id)
);

CREATE TABLE IF NOT EXISTS promptoon_user_subscription (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES promptoon_channel(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS promptoon_feed_impression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID NULL REFERENCES promptoon_feed_item(id) ON DELETE SET NULL,
  publish_id UUID NULL REFERENCES promptoon_publish(id) ON DELETE SET NULL,
  anonymous_id UUID NULL,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promptoon_episode_view_stat (
  episode_id UUID PRIMARY KEY REFERENCES promptoon_episode(id) ON DELETE CASCADE,
  publish_id UUID NULL REFERENCES promptoon_publish(id) ON DELETE SET NULL,
  total_views INTEGER NOT NULL DEFAULT 0,
  unique_viewers INTEGER NOT NULL DEFAULT 0,
  completed_views INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promptoon_episode_discussion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES promptoon_episode(id) ON DELETE CASCADE,
  publish_id UUID NULL REFERENCES promptoon_publish(id) ON DELETE SET NULL,
  discourse_topic_id TEXT NULL,
  discussion_url TEXT NULL,
  comment_count INTEGER NOT NULL DEFAULT 0,
  latest_comment_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_episode_discussion_episode UNIQUE (episode_id)
);

CREATE TABLE IF NOT EXISTS promptoon_telemetry_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  anonymous_id UUID NULL,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID NULL,
  project_id UUID NULL REFERENCES promptoon_project(id) ON DELETE SET NULL,
  channel_id UUID NULL REFERENCES promptoon_channel(id) ON DELETE SET NULL,
  series_id UUID NULL REFERENCES promptoon_series(id) ON DELETE SET NULL,
  episode_id UUID NULL REFERENCES promptoon_episode(id) ON DELETE SET NULL,
  publish_id UUID NULL REFERENCES promptoon_publish(id) ON DELETE SET NULL,
  feed_item_id UUID NULL REFERENCES promptoon_feed_item(id) ON DELETE SET NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promptoon_telemetry_event_name_created
  ON promptoon_telemetry_event(event_name, created_at DESC);

CREATE TABLE IF NOT EXISTS promptoon_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS promptoon_oauth_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_oauth_account_provider UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS promptoon_studio_member (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'studio_admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promptoon_project_member (
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);
