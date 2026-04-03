CREATE INDEX IF NOT EXISTS idx_promptoon_publish_created_at_id
  ON promptoon_publish(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_promptoon_publish_episode_version_created_at
  ON promptoon_publish(episode_id, version_no DESC, created_at DESC);
