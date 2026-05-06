ALTER TABLE promptoon_channel
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE promptoon_channel
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE promptoon_channel
  DROP CONSTRAINT IF EXISTS uq_promptoon_channel_project;

CREATE INDEX IF NOT EXISTS idx_promptoon_channel_owner
  ON promptoon_channel(owner_user_id, created_at DESC);

WITH user_scope AS (
  SELECT DISTINCT
    users.id AS user_id,
    COALESCE(NULLIF(BTRIM(users.display_name), ''), NULLIF(BTRIM(users.login_id), ''), 'channel') AS display_name,
    users.profile_image_url
  FROM users
  WHERE EXISTS (
      SELECT 1
      FROM promptoon_project AS project
      WHERE project.created_by = users.id
    )
    OR EXISTS (
      SELECT 1
      FROM promptoon_channel AS channel
      WHERE channel.owner_user_id = users.id
    )
),
normalized_user_scope AS (
  SELECT
    user_id,
    display_name,
    profile_image_url,
    LEFT(
      BTRIM(REGEXP_REPLACE(LOWER(display_name), '[^a-z0-9가-힣]+', '-', 'g'), '-'),
      48
    ) AS normalized_slug
  FROM user_scope
),
default_channel_seed AS (
  SELECT
    user_id,
    display_name,
    profile_image_url,
    CONCAT(COALESCE(NULLIF(normalized_slug, ''), 'channel'), '-', LEFT(user_id::text, 8)) AS slug
  FROM normalized_user_scope
)
INSERT INTO promptoon_channel (
  project_id,
  owner_user_id,
  slug,
  display_name,
  handle,
  avatar_url,
  bio,
  is_default
)
SELECT
  NULL,
  user_id,
  slug,
  display_name,
  CONCAT('@', slug),
  profile_image_url,
  NULL,
  TRUE
FROM default_channel_seed
ON CONFLICT (slug) DO UPDATE
  SET project_id = NULL,
      owner_user_id = EXCLUDED.owner_user_id,
      display_name = EXCLUDED.display_name,
      handle = EXCLUDED.handle,
      avatar_url = COALESCE(promptoon_channel.avatar_url, EXCLUDED.avatar_url),
      is_default = TRUE,
      updated_at = NOW()
  WHERE promptoon_channel.owner_user_id IS NULL
     OR promptoon_channel.owner_user_id = EXCLUDED.owner_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_channel_owner_default
  ON promptoon_channel(owner_user_id)
  WHERE is_default = TRUE AND owner_user_id IS NOT NULL;

WITH default_channels AS (
  SELECT owner_user_id, id
  FROM promptoon_channel
  WHERE is_default = TRUE
)
UPDATE promptoon_publish AS publish
SET channel_id = default_channels.id
FROM promptoon_project AS project
JOIN default_channels ON default_channels.owner_user_id = project.created_by
WHERE publish.project_id = project.id
  AND publish.channel_id IS DISTINCT FROM default_channels.id;

WITH default_channels AS (
  SELECT owner_user_id, id
  FROM promptoon_channel
  WHERE is_default = TRUE
)
UPDATE promptoon_series AS series
SET channel_id = default_channels.id,
    updated_at = NOW()
FROM promptoon_project AS project
JOIN default_channels ON default_channels.owner_user_id = project.created_by
WHERE series.project_id = project.id
  AND series.channel_id IS DISTINCT FROM default_channels.id;

WITH default_channels AS (
  SELECT owner_user_id, id, slug, display_name
  FROM promptoon_channel
  WHERE is_default = TRUE
)
UPDATE promptoon_feed_item AS item
SET channel_id = default_channels.id,
    payload_json = JSONB_SET(
      JSONB_SET(
        JSONB_SET(item.payload_json, '{channelId}', TO_JSONB(default_channels.id::text), TRUE),
        '{channelSlug}',
        TO_JSONB(default_channels.slug),
        TRUE
      ),
      '{channelName}',
      TO_JSONB(default_channels.display_name),
      TRUE
    ),
    updated_at = NOW()
FROM promptoon_project AS project
JOIN default_channels ON default_channels.owner_user_id = project.created_by
WHERE item.project_id = project.id
  AND item.channel_id IS DISTINCT FROM default_channels.id;

WITH default_channels AS (
  SELECT owner_user_id, id
  FROM promptoon_channel
  WHERE is_default = TRUE
)
UPDATE promptoon_short_clip AS short
SET channel_id = default_channels.id
FROM promptoon_project AS project
JOIN default_channels ON default_channels.owner_user_id = project.created_by
WHERE short.project_id = project.id
  AND short.channel_id IS DISTINCT FROM default_channels.id;

WITH default_channels AS (
  SELECT owner_user_id, id
  FROM promptoon_channel
  WHERE is_default = TRUE
)
UPDATE promptoon_telemetry_event AS event
SET channel_id = default_channels.id
FROM promptoon_project AS project
JOIN default_channels ON default_channels.owner_user_id = project.created_by
WHERE event.project_id = project.id
  AND event.channel_id IS DISTINCT FROM default_channels.id;

DELETE FROM promptoon_channel_home_projection;
