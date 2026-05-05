CREATE INDEX IF NOT EXISTS idx_promptoon_user_like_publish
  ON promptoon_user_like(publish_id);

CREATE INDEX IF NOT EXISTS idx_promptoon_user_bookmark_publish
  ON promptoon_user_bookmark(publish_id);

CREATE INDEX IF NOT EXISTS idx_promptoon_user_subscription_channel
  ON promptoon_user_subscription(channel_id);
