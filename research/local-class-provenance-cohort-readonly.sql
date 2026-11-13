-- READ ONLY FROZEN LOCAL class source provenance cohort.
-- No CLAIM, UPDATE, source enrichment, rank/score change or backdating.
SELECT race_date,track,race_no,race_name,
 payload->'audit'->'missing_conditions' AS original_missing_conditions
FROM public.official_predictions
WHERE circuit='LOCAL' AND status='FROZEN'
  AND race_date BETWEEN '2026-11-07' AND '2026-11-12'
ORDER BY race_date,track,race_no;
