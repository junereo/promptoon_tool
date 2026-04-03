CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS promptoon_project (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NULL,
  thumbnail_url TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promptoon_episode (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  episode_no INTEGER NOT NULL,
  start_cut_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_episode_project_episode_no UNIQUE (project_id, episode_no)
);

CREATE TABLE IF NOT EXISTS promptoon_cut (
  id UUID PRIMARY KEY,
  episode_id UUID NOT NULL REFERENCES promptoon_episode(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  asset_url TEXT NULL,
  position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_start BOOLEAN NOT NULL DEFAULT FALSE,
  is_ending BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE promptoon_episode
  ADD CONSTRAINT fk_promptoon_episode_start_cut
  FOREIGN KEY (start_cut_id)
  REFERENCES promptoon_cut(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS promptoon_choice (
  id UUID PRIMARY KEY,
  cut_id UUID NOT NULL REFERENCES promptoon_cut(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  next_cut_id UUID NULL REFERENCES promptoon_cut(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promptoon_publish (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES promptoon_project(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES promptoon_episode(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  status TEXT NOT NULL,
  manifest JSONB NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_promptoon_publish_version UNIQUE (project_id, episode_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_promptoon_episode_project_id
  ON promptoon_episode(project_id);
CREATE INDEX IF NOT EXISTS idx_promptoon_cut_episode_id_order_index
  ON promptoon_cut(episode_id, order_index);
CREATE INDEX IF NOT EXISTS idx_promptoon_choice_cut_id_order_index
  ON promptoon_choice(cut_id, order_index);
CREATE INDEX IF NOT EXISTS idx_promptoon_choice_next_cut_id
  ON promptoon_choice(next_cut_id);

