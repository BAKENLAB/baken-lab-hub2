-- STAGED LOCAL EVIDENCE DELIVERY FUNCTION. NOT DEPLOYED.
-- Read-only; SECURITY INVOKER; private schema (not exposed as a public RPC).
-- Historical horse_runs archive only goes through 2026-08-31.
-- Name-only matches are NOT adequate proof of unique horse identity; explicit caveat returned.
-- No ranked output, odds, results of target race, betting or FROZEN mutation.
-- Must be called by authorized MCP worker before claim result is frozen to reach the prediction context.

CREATE OR REPLACE FUNCTION private.lab_local_pre_race_history_v1(
  p_race_date date, p_track text, p_race_no integer
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
WITH target AS (
 SELECT r.race_date,r.track,r.race_no,r.field_payload
 FROM public.official_races r
 WHERE (r.race_date,r.track,r.race_no,r.circuit)
   =(p_race_date,p_track,p_race_no,'LOCAL')
), runners AS (
 SELECT target.race_date,target.track,target.race_no,
   v.value->>'horse_name' horse_name, v.value->>'horse_no' horse_no
 FROM target CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(target.field_payload->'runners')='array'
    THEN target.field_payload->'runners' ELSE '[]'::jsonb END
 ) v
 WHERE v.value->>'status'='ACTIVE'
), enriched AS (
 SELECT r.horse_name,r.horse_no,
 COALESCE((
 SELECT jsonb_agg(jsonb_build_object(
  'race_date',h.race_date,'track',h.track,'race_no',h.race_no,
  'race_name',h.race_name,'class_name',h.race_name,
  'surface',h.surface,'distance',h.distance,'going',h.going,
  'finish',h.finish,'time_raw',h.time_raw,'margin',h.margin,
  'early_pos',h.early_pos,'final_turn_pos',h.final_turn_pos,
  'pos_change',h.pos_change,'final3f',h.final3f,
  'field_size',h.field_size,'source_month',h.source_month
 ) ORDER BY h.race_date DESC, h.id DESC)
 FROM (
  SELECT hr.*
  FROM public.horse_runs hr
  WHERE hr.horse_name=r.horse_name
   AND hr.race_date<r.race_date
   AND hr.race_type IS DISTINCT FROM 'ばんえい'
  ORDER BY hr.race_date DESC,hr.id DESC
  LIMIT 30
 ) h
 ),'[]'::jsonb) past_runs
 FROM runners r
)
SELECT jsonb_build_object(
 'race_date',p_race_date,'track',p_track,'race_no',p_race_no,
 'status',CASE WHEN NOT EXISTS(SELECT 1 FROM target)
  THEN 'NO_RACE' ELSE 'HISTORICAL_ARCHIVE_PARTIAL' END,
 'runners',COALESCE(
  (SELECT jsonb_agg(jsonb_build_object(
   'horse_no',e.horse_no,'horse_name',e.horse_name,
   'history',e.past_runs,
   'history_count',jsonb_array_length(e.past_runs),
   'corner_data_count',(
     SELECT count(*) FROM jsonb_array_elements(e.past_runs) x
     WHERE x->>'early_pos' IS NOT NULL AND x->>'final_turn_pos' IS NOT NULL
   ),
   'history_identity_status','NAME_ONLY_UNVERIFIED',
   'source_timestamp_verified',false
  ) ORDER BY (e.horse_no)::integer) FROM enriched e),
  '[]'::jsonb),
 'target_race_result_included',false,
 'market_data_included',false,
 'archive_latest_known','2026-08-31',
 'archive_missing_recent_policy','MARK_MISSING_FETCH_OFFICIAL_BEFORE_CLAIM',
 'rank_effect','NONE_UNTIL_VALIDATED'
);
$$;
