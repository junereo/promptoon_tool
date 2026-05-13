ALTER TABLE promptoon_cut
  ADD COLUMN IF NOT EXISTS loop_metadata JSONB NULL;
