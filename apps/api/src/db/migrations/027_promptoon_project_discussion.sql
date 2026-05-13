CREATE TABLE IF NOT EXISTS promptoon_project_discussion (
  project_id UUID PRIMARY KEY REFERENCES promptoon_project(id) ON DELETE CASCADE,
  discourse_topic_id TEXT NULL,
  provider_status TEXT NOT NULL DEFAULT 'pending',
  discussion_url TEXT NULL,
  comment_count INTEGER NOT NULL DEFAULT 0,
  latest_comment_at TIMESTAMPTZ NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_promptoon_project_discussion_status CHECK (provider_status IN ('pending', 'synced', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_promptoon_project_discussion_topic
  ON promptoon_project_discussion(discourse_topic_id)
  WHERE discourse_topic_id IS NOT NULL;
