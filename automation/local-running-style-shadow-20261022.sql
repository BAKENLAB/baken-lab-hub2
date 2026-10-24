-- BAKEN LAB | LOCAL 1.6 running-style research, 2026-10-22
-- READ ONLY. No UPDATE, prediction changes, migrations or Cron changes.
-- IMPORTANT: horse_runs has no stable lineage id. This is a NAME-MATCHED
-- DIAGNOSTIC ONLY, not a production-ready or causally proven shadow model.
-- horse_runs ends 2026-08-31; some recent runs in October are unavailable.
-- No racing outcomes on/after the target race date enter archive selection.
-- Rule: if rank5 has fewer than 2 top-three early positions across up to
-- 5 historical starts, replace rank5 with the best-ranked outside-top5 horse
-- having 2+ top-three early positions and 2+ reported early positions.
-- Not an adopted model rule. Compare gained and lost winners, not net alone.

WITH base AS (
 SELECT p.race_date,p.track,p.race_no,p.payload,
        (r.result->'finishers'->0->>'horse_no')::int winner_no
 FROM public.official_predictions p
 JOIN public.official_results r USING (race_date,track,race_no,circuit)
 WHERE p.circuit='LOCAL'
   AND p.protocol_version='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'
), ranked AS (
 SELECT p.race_date,p.track,p.race_no,p.winner_no,
        (j.value->>'rank')::int pre_rank,
        (j.value->>'horse_no')::int horse_no,
        j.value->>'horse_name' horse_name
 FROM base p CROSS JOIN LATERAL jsonb_array_elements(p.payload->'runners') j
 WHERE COALESCE(j.value->>'status','ACTIVE') NOT IN ('CANCELLED','EXCLUDED')
   AND j.value->>'rank' ~ '^[0-9]+$'
), features AS (
 SELECT r.*,
   (coalesce(h.position_count,0)>=2 AND coalesce(h.first3_count,0)>=2) early_flag
 FROM ranked r
 LEFT JOIN LATERAL (
   SELECT count(*) FILTER (WHERE early_pos IS NOT NULL) position_count,
          count(*) FILTER (WHERE early_pos<=3) first3_count
   FROM (
     SELECT early_pos FROM public.horse_runs h
     WHERE h.horse_name=r.horse_name AND h.race_date<r.race_date
     ORDER BY race_date DESC,race_no DESC LIMIT 5
   ) old
 ) h ON true
), proposed_in AS (
 SELECT DISTINCT ON(race_date,track,race_no)
        race_date,track,race_no,horse_no incoming_no
 FROM features WHERE pre_rank>5 AND early_flag
 ORDER BY race_date,track,race_no,pre_rank
), per_race AS (
 SELECT f.race_date,f.track,f.race_no,
        max(f.winner_no) winner_no,
        max(f.horse_no) FILTER(WHERE f.pre_rank=5) outgoing_no,
        coalesce(bool_or(f.early_flag) FILTER(WHERE f.pre_rank=5),false) rank5_flag,
        max(i.incoming_no) incoming_no,
        bool_or(f.horse_no=f.winner_no AND f.pre_rank<=5) original_top5_hit
 FROM features f LEFT JOIN proposed_in i USING(race_date,track,race_no)
 GROUP BY f.race_date,f.track,f.race_no
)
SELECT CASE WHEN race_date<'2026-10-21' THEN 'Oct13_to_Oct20' ELSE 'Oct21' END comparison_period,
 count(*) races,
 count(*) FILTER(WHERE original_top5_hit) original_top5_hits,
 count(*) FILTER(WHERE incoming_no IS NOT NULL AND NOT rank5_flag) hypothetical_swaps,
 count(*) FILTER(WHERE incoming_no IS NOT NULL AND NOT rank5_flag AND incoming_no=winner_no) winner_gains,
 count(*) FILTER(WHERE incoming_no IS NOT NULL AND NOT rank5_flag AND outgoing_no=winner_no) winner_losses,
 count(*) FILTER(WHERE original_top5_hit
   AND NOT(incoming_no IS NOT NULL AND NOT rank5_flag AND outgoing_no=winner_no)
   OR NOT original_top5_hit AND incoming_no IS NOT NULL
     AND NOT rank5_flag AND incoming_no=winner_no) hypothetical_top5_hits
FROM per_race GROUP BY 1 ORDER BY 1;
