ALTER TABLE promptoon_choice
  ADD COLUMN IF NOT EXISTS state_writes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE promptoon_cut
  ADD COLUMN IF NOT EXISTS state_variants JSONB NOT NULL DEFAULT '[]'::jsonb;
