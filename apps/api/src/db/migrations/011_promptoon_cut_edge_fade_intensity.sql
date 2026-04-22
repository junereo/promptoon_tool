ALTER TABLE promptoon_cut
  ADD COLUMN IF NOT EXISTS edge_fade_intensity TEXT NOT NULL DEFAULT 'normal';
