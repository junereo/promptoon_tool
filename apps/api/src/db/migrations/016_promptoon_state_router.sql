ALTER TABLE promptoon_cut
  ADD COLUMN IF NOT EXISTS state_routes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE promptoon_cut
  ADD COLUMN IF NOT EXISTS state_fallback_cut_id UUID NULL;

ALTER TABLE promptoon_cut
  ADD CONSTRAINT fk_promptoon_cut_state_fallback_cut
  FOREIGN KEY (state_fallback_cut_id)
  REFERENCES promptoon_cut(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;
