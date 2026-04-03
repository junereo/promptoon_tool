CREATE TABLE IF NOT EXISTS promptoon_viewer_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_id UUID NOT NULL REFERENCES promptoon_publish(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES promptoon_episode(id) ON DELETE CASCADE,
  anonymous_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  cut_id UUID NOT NULL,
  choice_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_episode_id
  ON promptoon_viewer_event(episode_id);

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_episode_id_event_type
  ON promptoon_viewer_event(episode_id, event_type);

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_episode_id_cut_id
  ON promptoon_viewer_event(episode_id, cut_id);

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_episode_id_choice_id
  ON promptoon_viewer_event(episode_id, choice_id);

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_publish_id
  ON promptoon_viewer_event(publish_id);

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_created_at
  ON promptoon_viewer_event(created_at);
