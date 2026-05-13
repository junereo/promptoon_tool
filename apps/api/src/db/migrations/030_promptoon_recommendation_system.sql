CREATE TABLE IF NOT EXISTS promptoon_recommendation_request (
  request_id UUID PRIMARY KEY,
  user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  anonymous_id UUID NULL,
  surface TEXT NOT NULL,
  device TEXT NOT NULL DEFAULT 'unknown',
  locale TEXT NOT NULL DEFAULT 'ko-KR',
  policy_id TEXT NOT NULL,
  model_version TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  cursor TEXT NULL,
  limit_requested INTEGER NOT NULL,
  constraints_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promptoon_recommendation_request_user_created
  ON promptoon_recommendation_request(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_recommendation_request_anonymous_created
  ON promptoon_recommendation_request(anonymous_id, created_at DESC)
  WHERE anonymous_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS promptoon_recommendation_result (
  request_id UUID NOT NULL REFERENCES promptoon_recommendation_request(request_id) ON DELETE CASCADE,
  publish_id UUID NOT NULL,
  rank INTEGER NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  tracking_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_promptoon_recommendation_result_publish
  ON promptoon_recommendation_result(publish_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_recommendation_result_token
  ON promptoon_recommendation_result(tracking_token);

ALTER TABLE promptoon_viewer_event
  ADD COLUMN IF NOT EXISTS surface TEXT NULL,
  ADD COLUMN IF NOT EXISTS position INTEGER NULL,
  ADD COLUMN IF NOT EXISTS tracking_token TEXT NULL,
  ADD COLUMN IF NOT EXISTS recommendation_request_id UUID NULL,
  ADD COLUMN IF NOT EXISTS policy_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS model_version TEXT NULL,
  ADD COLUMN IF NOT EXISTS experiment_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_tracking_token
  ON promptoon_viewer_event(tracking_token)
  WHERE tracking_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_recommendation_request
  ON promptoon_viewer_event(recommendation_request_id)
  WHERE recommendation_request_id IS NOT NULL;
