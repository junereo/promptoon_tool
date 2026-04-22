ALTER TABLE promptoon_viewer_event
  ADD COLUMN IF NOT EXISTS session_id UUID NULL,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_episode_id_session_id
  ON promptoon_viewer_event(episode_id, session_id);

CREATE INDEX IF NOT EXISTS idx_promptoon_viewer_event_episode_id_event_type_duration
  ON promptoon_viewer_event(episode_id, event_type, duration_ms);
