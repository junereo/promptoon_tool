ALTER TABLE promptoon_cut
  ADD COLUMN IF NOT EXISTS content_blocks JSONB;

ALTER TABLE promptoon_choice
  ADD COLUMN IF NOT EXISTS after_select_reaction_text TEXT,
  ADD COLUMN IF NOT EXISTS after_select_delay_ms INTEGER NOT NULL DEFAULT 2000;
