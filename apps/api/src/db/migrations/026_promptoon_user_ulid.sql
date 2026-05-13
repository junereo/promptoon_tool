CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION generate_ulid()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet CONSTANT TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  timestamp_value NUMERIC := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000);
  random_bytes BYTEA := gen_random_bytes(10);
  random_value NUMERIC := 0;
  output TEXT := '';
  random_output TEXT := '';
  index_value INTEGER;
BEGIN
  FOR index_value IN 1..10 LOOP
    output := substr(alphabet, mod(timestamp_value, 32)::INTEGER + 1, 1) || output;
    timestamp_value := trunc(timestamp_value / 32);
  END LOOP;

  FOR index_value IN 0..9 LOOP
    random_value := random_value * 256 + get_byte(random_bytes, index_value);
  END LOOP;

  FOR index_value IN 1..16 LOOP
    random_output := substr(alphabet, mod(random_value, 32)::INTEGER + 1, 1) || random_output;
    random_value := trunc(random_value / 32);
  END LOOP;

  RETURN output || random_output;
END;
$$;

CREATE TABLE IF NOT EXISTS promptoon_user_id_migration_map (
  old_uuid UUID PRIMARY KEY,
  new_ulid TEXT NOT NULL UNIQUE,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO promptoon_user_id_migration_map (old_uuid, new_ulid)
SELECT id, generate_ulid()
FROM users
ON CONFLICT (old_uuid) DO NOTHING;

ALTER TABLE users
  ADD COLUMN id_ulid TEXT;

UPDATE users
SET id_ulid = id_map.new_ulid
FROM promptoon_user_id_migration_map AS id_map
WHERE users.id = id_map.old_uuid;

ALTER TABLE users
  ALTER COLUMN id_ulid SET NOT NULL;

ALTER TABLE promptoon_asset ADD COLUMN created_by_ulid TEXT;
UPDATE promptoon_asset SET created_by_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_asset.created_by = id_map.old_uuid;

ALTER TABLE promptoon_asset_history ADD COLUMN created_by_ulid TEXT;
UPDATE promptoon_asset_history SET created_by_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_asset_history.created_by = id_map.old_uuid;

ALTER TABLE promptoon_channel ADD COLUMN owner_user_id_ulid TEXT;
UPDATE promptoon_channel SET owner_user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_channel.owner_user_id = id_map.old_uuid;

ALTER TABLE promptoon_comment ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_comment SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_comment.user_id = id_map.old_uuid;

ALTER TABLE promptoon_feed_impression ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_feed_impression SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_feed_impression.user_id = id_map.old_uuid;

ALTER TABLE promptoon_oauth_account ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_oauth_account SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_oauth_account.user_id = id_map.old_uuid;
ALTER TABLE promptoon_oauth_account ALTER COLUMN user_id_ulid SET NOT NULL;

ALTER TABLE promptoon_platform_admin
  ADD COLUMN user_id_ulid TEXT,
  ADD COLUMN granted_by_ulid TEXT;
UPDATE promptoon_platform_admin SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_platform_admin.user_id = id_map.old_uuid;
UPDATE promptoon_platform_admin SET granted_by_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_platform_admin.granted_by = id_map.old_uuid;
ALTER TABLE promptoon_platform_admin ALTER COLUMN user_id_ulid SET NOT NULL;

ALTER TABLE promptoon_project ADD COLUMN created_by_ulid TEXT;
UPDATE promptoon_project SET created_by_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_project.created_by = id_map.old_uuid;
ALTER TABLE promptoon_project ALTER COLUMN created_by_ulid SET NOT NULL;

ALTER TABLE promptoon_project_member ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_project_member SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_project_member.user_id = id_map.old_uuid;
ALTER TABLE promptoon_project_member ALTER COLUMN user_id_ulid SET NOT NULL;

ALTER TABLE promptoon_publish ADD COLUMN created_by_ulid TEXT;
UPDATE promptoon_publish SET created_by_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_publish.created_by = id_map.old_uuid;
ALTER TABLE promptoon_publish ALTER COLUMN created_by_ulid SET NOT NULL;

ALTER TABLE promptoon_session ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_session SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_session.user_id = id_map.old_uuid;
ALTER TABLE promptoon_session ALTER COLUMN user_id_ulid SET NOT NULL;

ALTER TABLE promptoon_studio_member ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_studio_member SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_studio_member.user_id = id_map.old_uuid;
ALTER TABLE promptoon_studio_member ALTER COLUMN user_id_ulid SET NOT NULL;

ALTER TABLE promptoon_telemetry_event ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_telemetry_event SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_telemetry_event.user_id = id_map.old_uuid;

ALTER TABLE promptoon_user_bookmark ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_user_bookmark SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_user_bookmark.user_id = id_map.old_uuid;
ALTER TABLE promptoon_user_bookmark ALTER COLUMN user_id_ulid SET NOT NULL;

ALTER TABLE promptoon_user_like ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_user_like SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_user_like.user_id = id_map.old_uuid;
ALTER TABLE promptoon_user_like ALTER COLUMN user_id_ulid SET NOT NULL;

ALTER TABLE promptoon_user_subscription ADD COLUMN user_id_ulid TEXT;
UPDATE promptoon_user_subscription SET user_id_ulid = id_map.new_ulid FROM promptoon_user_id_migration_map AS id_map WHERE promptoon_user_subscription.user_id = id_map.old_uuid;
ALTER TABLE promptoon_user_subscription ALTER COLUMN user_id_ulid SET NOT NULL;

ALTER TABLE promptoon_asset DROP CONSTRAINT IF EXISTS promptoon_asset_created_by_fkey;
ALTER TABLE promptoon_asset_history DROP CONSTRAINT IF EXISTS promptoon_asset_history_created_by_fkey;
ALTER TABLE promptoon_channel DROP CONSTRAINT IF EXISTS promptoon_channel_owner_user_id_fkey;
ALTER TABLE promptoon_comment DROP CONSTRAINT IF EXISTS promptoon_comment_user_id_fkey;
ALTER TABLE promptoon_feed_impression DROP CONSTRAINT IF EXISTS promptoon_feed_impression_user_id_fkey;
ALTER TABLE promptoon_oauth_account DROP CONSTRAINT IF EXISTS promptoon_oauth_account_user_id_fkey;
ALTER TABLE promptoon_platform_admin DROP CONSTRAINT IF EXISTS promptoon_platform_admin_granted_by_fkey;
ALTER TABLE promptoon_platform_admin DROP CONSTRAINT IF EXISTS promptoon_platform_admin_user_id_fkey;
ALTER TABLE promptoon_project DROP CONSTRAINT IF EXISTS fk_promptoon_project_created_by_user;
ALTER TABLE promptoon_project_member DROP CONSTRAINT IF EXISTS promptoon_project_member_user_id_fkey;
ALTER TABLE promptoon_publish DROP CONSTRAINT IF EXISTS fk_promptoon_publish_created_by_user;
ALTER TABLE promptoon_session DROP CONSTRAINT IF EXISTS promptoon_session_user_id_fkey;
ALTER TABLE promptoon_studio_member DROP CONSTRAINT IF EXISTS promptoon_studio_member_user_id_fkey;
ALTER TABLE promptoon_telemetry_event DROP CONSTRAINT IF EXISTS promptoon_telemetry_event_user_id_fkey;
ALTER TABLE promptoon_user_bookmark DROP CONSTRAINT IF EXISTS promptoon_user_bookmark_user_id_fkey;
ALTER TABLE promptoon_user_like DROP CONSTRAINT IF EXISTS promptoon_user_like_user_id_fkey;
ALTER TABLE promptoon_user_subscription DROP CONSTRAINT IF EXISTS promptoon_user_subscription_user_id_fkey;

DROP INDEX IF EXISTS idx_promptoon_channel_owner;
DROP INDEX IF EXISTS uq_promptoon_channel_owner_default;
DROP INDEX IF EXISTS idx_promptoon_session_active;
DROP INDEX IF EXISTS idx_promptoon_session_revoked;
DROP INDEX IF EXISTS idx_promptoon_session_user_expires;

ALTER TABLE promptoon_platform_admin DROP CONSTRAINT IF EXISTS promptoon_platform_admin_pkey;
ALTER TABLE promptoon_project_member DROP CONSTRAINT IF EXISTS promptoon_project_member_pkey;
ALTER TABLE promptoon_studio_member DROP CONSTRAINT IF EXISTS promptoon_studio_member_pkey;
ALTER TABLE promptoon_user_bookmark DROP CONSTRAINT IF EXISTS promptoon_user_bookmark_pkey;
ALTER TABLE promptoon_user_like DROP CONSTRAINT IF EXISTS promptoon_user_like_pkey;
ALTER TABLE promptoon_user_subscription DROP CONSTRAINT IF EXISTS promptoon_user_subscription_pkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;

ALTER TABLE users DROP COLUMN id;
ALTER TABLE users RENAME COLUMN id_ulid TO id;
ALTER TABLE users ALTER COLUMN id SET DEFAULT generate_ulid();
ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE users ADD CONSTRAINT ck_users_id_ulid CHECK (id ~ '^[0-9A-HJKMNP-TV-Z]{26}$');

ALTER TABLE promptoon_asset DROP COLUMN created_by;
ALTER TABLE promptoon_asset RENAME COLUMN created_by_ulid TO created_by;

ALTER TABLE promptoon_asset_history DROP COLUMN created_by;
ALTER TABLE promptoon_asset_history RENAME COLUMN created_by_ulid TO created_by;

ALTER TABLE promptoon_channel DROP COLUMN owner_user_id;
ALTER TABLE promptoon_channel RENAME COLUMN owner_user_id_ulid TO owner_user_id;

ALTER TABLE promptoon_comment DROP COLUMN user_id;
ALTER TABLE promptoon_comment RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_feed_impression DROP COLUMN user_id;
ALTER TABLE promptoon_feed_impression RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_oauth_account DROP COLUMN user_id;
ALTER TABLE promptoon_oauth_account RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_platform_admin DROP COLUMN user_id;
ALTER TABLE promptoon_platform_admin RENAME COLUMN user_id_ulid TO user_id;
ALTER TABLE promptoon_platform_admin DROP COLUMN granted_by;
ALTER TABLE promptoon_platform_admin RENAME COLUMN granted_by_ulid TO granted_by;

ALTER TABLE promptoon_project DROP COLUMN created_by;
ALTER TABLE promptoon_project RENAME COLUMN created_by_ulid TO created_by;

ALTER TABLE promptoon_project_member DROP COLUMN user_id;
ALTER TABLE promptoon_project_member RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_publish DROP COLUMN created_by;
ALTER TABLE promptoon_publish RENAME COLUMN created_by_ulid TO created_by;

ALTER TABLE promptoon_session DROP COLUMN user_id;
ALTER TABLE promptoon_session RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_studio_member DROP COLUMN user_id;
ALTER TABLE promptoon_studio_member RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_telemetry_event DROP COLUMN user_id;
ALTER TABLE promptoon_telemetry_event RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_user_bookmark DROP COLUMN user_id;
ALTER TABLE promptoon_user_bookmark RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_user_like DROP COLUMN user_id;
ALTER TABLE promptoon_user_like RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_user_subscription DROP COLUMN user_id;
ALTER TABLE promptoon_user_subscription RENAME COLUMN user_id_ulid TO user_id;

ALTER TABLE promptoon_oauth_account ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE promptoon_platform_admin ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE promptoon_project ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE promptoon_project_member ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE promptoon_publish ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE promptoon_session ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE promptoon_studio_member ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE promptoon_user_bookmark ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE promptoon_user_like ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE promptoon_user_subscription ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE promptoon_platform_admin ADD CONSTRAINT promptoon_platform_admin_pkey PRIMARY KEY (user_id);
ALTER TABLE promptoon_project_member ADD CONSTRAINT promptoon_project_member_pkey PRIMARY KEY (project_id, user_id);
ALTER TABLE promptoon_studio_member ADD CONSTRAINT promptoon_studio_member_pkey PRIMARY KEY (user_id);
ALTER TABLE promptoon_user_bookmark ADD CONSTRAINT promptoon_user_bookmark_pkey PRIMARY KEY (user_id, publish_id);
ALTER TABLE promptoon_user_like ADD CONSTRAINT promptoon_user_like_pkey PRIMARY KEY (user_id, publish_id);
ALTER TABLE promptoon_user_subscription ADD CONSTRAINT promptoon_user_subscription_pkey PRIMARY KEY (user_id, channel_id);

ALTER TABLE promptoon_asset ADD CONSTRAINT promptoon_asset_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE promptoon_asset_history ADD CONSTRAINT promptoon_asset_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE promptoon_channel ADD CONSTRAINT promptoon_channel_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE promptoon_comment ADD CONSTRAINT promptoon_comment_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE promptoon_feed_impression ADD CONSTRAINT promptoon_feed_impression_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE promptoon_oauth_account ADD CONSTRAINT promptoon_oauth_account_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promptoon_platform_admin ADD CONSTRAINT promptoon_platform_admin_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE promptoon_platform_admin ADD CONSTRAINT promptoon_platform_admin_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promptoon_project ADD CONSTRAINT fk_promptoon_project_created_by_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE promptoon_project_member ADD CONSTRAINT promptoon_project_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promptoon_publish ADD CONSTRAINT fk_promptoon_publish_created_by_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE promptoon_session ADD CONSTRAINT promptoon_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promptoon_studio_member ADD CONSTRAINT promptoon_studio_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promptoon_telemetry_event ADD CONSTRAINT promptoon_telemetry_event_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE promptoon_user_bookmark ADD CONSTRAINT promptoon_user_bookmark_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promptoon_user_like ADD CONSTRAINT promptoon_user_like_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promptoon_user_subscription ADD CONSTRAINT promptoon_user_subscription_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_promptoon_channel_owner
  ON promptoon_channel(owner_user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_channel_owner_default
  ON promptoon_channel(owner_user_id)
  WHERE is_default = TRUE AND owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_session_active
  ON promptoon_session(id, user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_promptoon_session_revoked
  ON promptoon_session(user_id, revoked_at)
  WHERE revoked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promptoon_session_user_expires
  ON promptoon_session(user_id, expires_at DESC);
