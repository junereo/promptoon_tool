ALTER TABLE promptoon_cut
  ADD COLUMN IF NOT EXISTS edge_fade_color TEXT NOT NULL DEFAULT 'black';
