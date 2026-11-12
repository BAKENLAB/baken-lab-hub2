-- RESEARCH STAGE ONLY. DO NOT EXECUTE THIS SQL IN PRODUCTION UNTIL
-- EXPLICIT REVIEW OF SOURCE FRESHNESS, FULL-FIELD IDENTITY, RANK EFFECTS,
-- AND REGRESSION CHECKS. No database migration was applied in this task.
-- Minimal change to installed private.jra_relative_condition_comparison_v1:
-- preserve separately parsed JRA official "race_class_detail" (e.g. 2勝ク)
-- in supporting_runs without altering numeric comparisons, FROZEN, or RLS.
-- Reject contradictory named/detail tiers in the pure research scorer.
-- Source: deployed function body retrieved read-only 2026-11-13 JST.
CREATE OR REPLACE FUNCTION private.jra_relative_condition_comparison_v1(p_history jsonb, p_target_date date, p_surface text, p_distance integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
  v_per jsonb := '[]'::jsonb;
  v_pairs jsonb := '[]'::jsonb;
  n integer := 0;
BEGIN
 IF jsonb_typeof(p_history)<>'array'
    OR p_target_date IS NULL
    OR p_surface NOT IN ('芝','ダート')
    OR p_distance NOT BETWEEN 1000 AND 3600
    OR jsonb_array_length(p_history) NOT BETWEEN 2 AND 24
 THEN
  RETURN jsonb_build_object('status','CONDITIONS_OR_ROSTER_UNAVAILABLE','rank_effect',false,'market_used',false);
 END IF;
 n:=jsonb_array_length(p_history);
 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_history) r
   WHERE (r->>'horse_no') !~ '^[0-9]{1,2}$'
      OR (r->>'horse_no')::integer NOT BETWEEN 1 AND 24
      OR COALESCE(r->>'horse_name','')=''
      OR jsonb_typeof(r->'past_runs')<>'array'
      OR jsonb_array_length(r->'past_runs')>12
 ) OR (SELECT count(DISTINCT r->>'horse_no') FROM jsonb_array_elements(p_history) r)<>n
 THEN
  RETURN jsonb_build_object('status','UNVERIFIED_ROSTER','rank_effect',false,'market_used',false);
 END IF;
 -- Strict target-date boundary. Any future/equal-date historical row rejects
 -- the optional comparison, rather than interpreting it as prior evidence.
 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_history) r,
      jsonb_array_elements(r->'past_runs') h
   WHERE (h->>'race_date') !~ '^\d{4}-\d{2}-\d{2}$'
      OR (h->>'race_date')>=p_target_date::text
 ) THEN
  RETURN jsonb_build_object('status','HISTORICAL_ASOF_REJECTED','rank_effect',false,'market_used',false);
 END IF;
 WITH field AS(
   SELECT (r->>'horse_no')::int hn,r->>'horse_name' name,
     r->'past_runs' history
   FROM jsonb_array_elements(p_history) r
 ), expanded AS(
   SELECT f.hn, h,
     (h->>'surface'=p_surface AND (h->>'distance') ~ '^[0-9]{3,4}$'
       AND abs((h->>'distance')::integer-p_distance)<=200) similar,
     CASE WHEN (h->>'finish') ~ '^[0-9]{1,2}$'
       THEN (h->>'finish')::integer END fin,
     CASE WHEN (h->>'margin_to_winner') ~ '^[0-9]{1,2}([.][0-9]{1,3})?$'
       THEN (h->>'margin_to_winner')::numeric END margin,
     CASE WHEN (h->>'early_pos') ~ '^[0-9]{1,2}$'
       THEN (h->>'early_pos')::integer END early
   FROM field f LEFT JOIN LATERAL jsonb_array_elements(f.history) h ON true
 ), measures AS (
   SELECT f.hn,f.name,
     count(*) FILTER(WHERE e.similar)::int comparable_runs,
     count(*) FILTER(WHERE e.similar AND e.fin=1 OR
       (e.similar AND e.fin BETWEEN 2 AND 3 AND e.margin BETWEEN 0 AND 0.5))::int close_runs,
     count(*) FILTER(WHERE e.similar AND e.fin BETWEEN 1 AND 3)::int podium_runs,
     count(*) FILTER(WHERE e.similar AND e.early BETWEEN 1 AND 3)::int front3_runs,
     count(*) FILTER(WHERE e.similar AND e.fin>=8 AND e.margin>=1.5)::int decisive_defeats,
     COALESCE(jsonb_agg(jsonb_build_object(
       'date',e.h->>'race_date','surface',e.h->>'surface',
       'distance',e.h->>'distance','class',e.h->>'race_class',
       'class_detail',e.h->>'race_class_detail',
       'finish',e.fin,'margin',e.margin,'early_pos',e.early,
       'source_kind',e.h->>'source_kind'
     ) ORDER BY e.h->>'race_date' DESC) FILTER(WHERE e.similar),'[]'::jsonb) supporting_runs
   FROM field f LEFT JOIN expanded e ON e.hn=f.hn
   GROUP BY f.hn,f.name
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'horse_no',hn,'horse_name',name,'comparable_runs',comparable_runs,
   'close_runs',close_runs,'podium_runs',podium_runs,
   'front3_runs',front3_runs,'decisive_defeats',decisive_defeats,
   'supporting_runs',supporting_runs,
   'comparison_status',CASE WHEN comparable_runs>=2 THEN 'REPEATED_COMPARABLE_RUNS'
     WHEN comparable_runs=1 THEN 'SINGLE_COMPARABLE_RUN'
     ELSE 'NO_COMPARABLE_RUN' END
 ) ORDER BY hn),'[]'::jsonb) INTO v_per FROM measures;
 WITH entries AS(
   SELECT (e->>'horse_no')::int hn,
     (e->>'close_runs')::int close_n,
     (e->>'comparable_runs')::int comparable_n,
     (e->>'decisive_defeats')::int poor_n
   FROM jsonb_array_elements(v_per) e
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'a_horse_no',a.hn,'b_horse_no',b.hn,
   'a_close_runs',a.close_n,'b_close_runs',b.close_n,
   'a_comparable_runs',a.comparable_n,'b_comparable_runs',b.comparable_n,
   'a_decisive_defeats',a.poor_n,'b_decisive_defeats',b.poor_n,
   'close_evidence_leader',CASE WHEN a.close_n>b.close_n THEN a.hn
     WHEN b.close_n>a.close_n THEN b.hn ELSE NULL END,
   'disclaimer','COUNTS_ONLY_NOT_PROOF_OF_OVERALL_SUPERIORITY'
 ) ORDER BY a.hn,b.hn),'[]'::jsonb) INTO v_pairs
 FROM entries a JOIN entries b ON a.hn<b.hn
 WHERE a.comparable_n>0 AND b.comparable_n>0
   AND (a.comparable_n>=2 OR b.comparable_n>=2)
   AND a.close_n<>b.close_n;
 RETURN jsonb_build_object(
   'status','READY','source_scope','JRA_CLAIMED_RUNNER_HISTORY',
   'target_date',p_target_date,'target_surface',p_surface,
   'target_distance',p_distance,'runner_count',n,
   'runner_evidence',v_per,'comparisons',v_pairs,
   'comparison_count',jsonb_array_length(v_pairs),
   'target_result_used',false,'market_used',false,'rank_effect',false,
   'scoring_permission',false,
   'interpretation','HISTORICAL_FACTUAL_COMPARISON_ONLY_NOT_A_REPLACEMENT_RANK');
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('status','OPTIONAL_COMPARISON_FAILED','rank_effect',false,'market_used',false);
END;
$function$

