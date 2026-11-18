-- BAKEN LAB | JRA predication-time evidence audit | 2026-10-22
-- READ ONLY. No backfill, no model invocation, no write, no Cron.
-- Current jra_live_runners can have been refreshed AFTER a frozen prediction.
-- Such records are explicitly NON-CAUSAL; never reconstruct FROZEN from them.
WITH frozen AS (
 SELECT p.race_date,p.track,p.race_no,p.frozen_at,p.post_time,p.payload,
        z.value AS runner,(z.value->>'horse_no')::integer AS horse_no
 FROM public.official_predictions p
 CROSS JOIN LATERAL jsonb_array_elements(p.payload->'runners') AS z(value)
 WHERE p.circuit='JRA'
   AND p.protocol_version='JRA_REBUILD_0.3_FLAT_HISTORY_EYE_ALLCLASS_20261004'
), paired AS (
 SELECT f.*,rr.horse_name AS live_horse_name,rr.horse_ref,
        rr.source_checked_at,rr.past_runs
 FROM frozen f
 LEFT JOIN public.jra_live_races l
   ON l.race_date=f.race_date AND l.track=f.track AND l.race_no=f.race_no
 LEFT JOIN public.jra_live_runners rr
   ON rr.live_race_id=l.id AND rr.horse_no=f.horse_no
)
SELECT COUNT(DISTINCT (race_date,track,race_no)) AS frozen_races,
       COUNT(*) AS frozen_horses,
       COUNT(*) FILTER (WHERE source_checked_at <= frozen_at) AS current_live_source_checked_before_frozen,
       COUNT(*) FILTER (WHERE source_checked_at > frozen_at) AS current_live_source_checked_after_frozen,
       COUNT(*) FILTER (WHERE source_checked_at IS NULL) AS unknown_live_source_time,
       COUNT(*) FILTER (WHERE past_runs IS NOT NULL
           AND jsonb_typeof(past_runs)='array'
           AND jsonb_array_length(past_runs)>0) AS current_live_nonempty_history,
       COUNT(*) FILTER (WHERE past_runs::text LIKE '%"early_pos"%') AS current_live_early_pos_present,
       COUNT(*) FILTER (WHERE runner ? 'running_style_reference') AS frozen_style_explicitly_saved,
       COUNT(*) FILTER (WHERE runner ? 'history_runs_checked') AS frozen_history_checked_field_saved
FROM paired;
