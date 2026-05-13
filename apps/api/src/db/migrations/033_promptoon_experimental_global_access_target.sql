ALTER TABLE promptoon_experimental_access_target
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE promptoon_experimental_access_target
  DROP CONSTRAINT IF EXISTS ck_promptoon_experimental_access_target_type;

ALTER TABLE promptoon_experimental_access_target
  DROP CONSTRAINT IF EXISTS ck_promptoon_experimental_access_target_shape;

ALTER TABLE promptoon_experimental_access_target
  ADD CONSTRAINT ck_promptoon_experimental_access_target_type
  CHECK (target_type IN ('all', 'project', 'publish'));

ALTER TABLE promptoon_experimental_access_target
  ADD CONSTRAINT ck_promptoon_experimental_access_target_shape
  CHECK (
    (target_type = 'all' AND project_id IS NULL AND publish_id IS NULL)
    OR (target_type = 'project' AND project_id IS NOT NULL AND publish_id IS NULL)
    OR (target_type = 'publish' AND project_id IS NOT NULL AND publish_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_promptoon_experimental_access_target_all
  ON promptoon_experimental_access_target(target_type)
  WHERE target_type = 'all';
