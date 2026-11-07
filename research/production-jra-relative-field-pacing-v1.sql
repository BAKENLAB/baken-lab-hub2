-- Read-only relative JRA pace composition from the SAME four-run context
-- already accepted by public.jra_claimed_context(). NO target result, odds or ranks.
CREATE OR REPLACE FUNCTION private.jra_relative_pace_summary_v1(
  p_history jsonb, p_surface text, p_distance integer
) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path TO 'pg_catalog','private'
AS $fn$
WITH entries AS (
 SELECT a.value AS runner
 FROM jsonb_array_elements(
   CASE WHEN jsonb_typeof(p_history)='array' THEN p_history ELSE '[]'::jsonb END
 ) a
), per AS (
 SELECT e.runner->'horse_no' AS horse_no,
        e.runner->>'horse_name' AS horse_name,
        COALESCE(z.position_runs,0)::int position_runs,
        COALESCE(z.comparable_runs,0)::int comparable_runs,
        COALESCE(z.front_runs,0)::int front_runs
 FROM entries e
 LEFT JOIN LATERAL (
  SELECT
   count(*) FILTER (WHERE pr->>'early_pos' ~ '^[0-9]+([.][0-9]+)?$'
      AND (pr->>'early_pos')::numeric BETWEEN 1 AND 24) AS position_runs,
   count(*) FILTER (WHERE pr->>'early_pos' ~ '^[0-9]+([.][0-9]+)?$'
      AND (pr->>'early_pos')::numeric BETWEEN 1 AND 24
      AND pr->>'surface'=p_surface
      AND pr->>'distance' ~ '^[0-9]{3,4}$'
      AND abs((pr->>'distance')::integer-p_distance)<=200) AS comparable_runs,
   count(*) FILTER (WHERE pr->>'early_pos' ~ '^[0-9]+([.][0-9]+)?$'
      AND (pr->>'early_pos')::numeric BETWEEN 1 AND 3
      AND pr->>'surface'=p_surface
      AND pr->>'distance' ~ '^[0-9]{3,4}$'
      AND abs((pr->>'distance')::integer-p_distance)<=200) AS front_runs
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(e.runner->'past_runs')='array'
      THEN e.runner->'past_runs' ELSE '[]'::jsonb END
  ) AS pr
 ) z ON true
)
SELECT jsonb_build_object(
 'status',CASE WHEN p_surface IS NULL OR p_distance IS NULL THEN 'CONDITIONS_UNAVAILABLE'
    WHEN NOT EXISTS(SELECT 1 FROM entries) THEN 'NO_RUNNERS' ELSE 'READY' END,
 'scope','JRA_VERIFIED_CONTEXT_RECENT_FOUR',
 'model_status','DESCRIPTIVE_NOT_VALIDATED_NO_SCORE_CHANGE',
 'surface',p_surface,'distance',p_distance,
 'runners',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'horse_no',horse_no,'horse_name',horse_name,
   'prior_position_runs',position_runs,
   'comparable_position_runs',comparable_runs,
   'comparable_front3_runs',front_runs,
   'repeated_front_evidence',(comparable_runs>=2 AND front_runs>=2),
   'assessment_status',CASE WHEN comparable_runs>=2 THEN 'COMPARABLE'
       ELSE 'INSUFFICIENT_POSITION_HISTORY' END
 ) ORDER BY (horse_no #>> '{}')::int),'[]'::jsonb) FROM per),
 'runner_count',(SELECT count(*) FROM per),
 'runners_with_position',(SELECT count(*) FROM per WHERE position_runs>0),
 'front_style_contenders',(SELECT count(*) FROM per WHERE comparable_runs>=2 AND front_runs>=2),
 'target_race_result_used',false,'market_used',false,'rank_effect',false
);
$fn$;
REVOKE ALL ON FUNCTION private.jra_relative_pace_summary_v1(jsonb,text,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.jra_relative_pace_summary_v1(jsonb,text,integer)
  TO service_role;
