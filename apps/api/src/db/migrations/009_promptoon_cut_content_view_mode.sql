ALTER TABLE promptoon_cut
  ADD COLUMN IF NOT EXISTS content_view_mode TEXT NOT NULL DEFAULT 'default';
