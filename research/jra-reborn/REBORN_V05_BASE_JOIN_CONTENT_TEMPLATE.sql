-- REBORN v0.5 chronologically isolated residual signal check.
-- Base: frozen v0.4 2024 coefficients. Signal: pre-target historical content only.
-- Fit 2024. Test untouched fixed weights on 2025, 2026.
WITH base_scored AS (<BASE_SQL>),
     content_signals AS (<CONTENT_SQL>)
SELECT b.segment,b.surface,c.late_position_gain,c.hot_front_survivor,
 c.overlooked_closer,c.any_verified_pace,
 b.research_rate,b.target_top3,b.race_id,b.horse_no
FROM base_scored b JOIN content_signals c
 ON c.race_id=b.race_id AND c.horse_no=b.horse_no;
