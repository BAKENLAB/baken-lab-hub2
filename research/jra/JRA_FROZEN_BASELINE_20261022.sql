-- BAKEN LAB | JRA 0.3 frozen baseline | 2026-10-22
-- READ ONLY. Always include both gained and LOST prior winning selections
-- when eventually evaluating a proposed pace/style model.
WITH f AS (
 SELECT p.race_date,p.track,p.race_no,p.payload,
        (r.result->'finishers'->0->>'horse_no')::integer AS winner_no
 FROM public.official_predictions p
 LEFT JOIN public.official_results r
 USING(race_date,track,race_no,circuit)
 WHERE p.circuit='JRA'
 AND p.protocol_version='JRA_REBUILD_0.3_FLAT_HISTORY_EYE_ALLCLASS_20261004'
)
SELECT COUNT(*) AS frozen_races,
       COUNT(*) FILTER (WHERE winner_no IS NOT NULL) AS official_winner_available,
       COUNT(*) FILTER(WHERE winner_no IS NOT NULL AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(payload->'runners') z
         WHERE (z->>'horse_no')::integer=winner_no AND (z->>'rank')::integer<=5
       )) AS winner_in_frozen_top5,
       COUNT(*) FILTER(WHERE winner_no IS NOT NULL AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(payload->'runners') z
         WHERE (z->>'horse_no')::integer=winner_no AND (z->>'rank')::integer=1
       )) AS winner_frozen_rank1
FROM f;
