ALTER TABLE promptoon_cut
  ADD COLUMN IF NOT EXISTS start_effect_duration_ms INTEGER NOT NULL DEFAULT 320,
  ADD COLUMN IF NOT EXISTS end_effect_duration_ms INTEGER NOT NULL DEFAULT 320;

UPDATE promptoon_cut AS cut
SET end_effect_duration_ms = choice_delay.max_delay_ms
FROM (
  SELECT cut_id, MAX(after_select_delay_ms) AS max_delay_ms
  FROM promptoon_choice
  WHERE after_select_delay_ms IS NOT NULL
  GROUP BY cut_id
) AS choice_delay
WHERE cut.id = choice_delay.cut_id
  AND choice_delay.max_delay_ms IS NOT NULL;
