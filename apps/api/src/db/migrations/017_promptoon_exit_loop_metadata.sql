ALTER TABLE promptoon_episode
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE promptoon_episode
  ADD COLUMN IF NOT EXISTS exit_loop_metadata JSONB NULL;

ALTER TABLE promptoon_episode
  DROP CONSTRAINT IF EXISTS ck_promptoon_episode_mode;

ALTER TABLE promptoon_episode
  ADD CONSTRAINT ck_promptoon_episode_mode
  CHECK (mode IN ('standard', 'exit_loop'));
