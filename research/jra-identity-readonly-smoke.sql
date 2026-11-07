-- BAKEN LAB JRA pre-CLAIM identity and missing-id source smoke test.
-- Read only; okay to run against yesterday's completed races because this only
-- exercises historical source functions, not guarded claimed-context or FROZEN.
WITH base(v) AS (VALUES ('[{"horse_no":1,"horse_name":"A"},{"horse_no":2,"horse_name":"B"}]'::jsonb)),
variations(name,e) AS (
 VALUES
 ('valid','[{"horse_no":1,"horse_name":"A"},{"horse_no":2,"horse_name":"B"}]'::jsonb),
 ('wrong_horse_names','[{"horse_no":1,"horse_name":"B"},{"horse_no":2,"horse_name":"A"}]'::jsonb),
 ('duplicate_horse_no','[{"horse_no":1,"horse_name":"A"},{"horse_no":1,"horse_name":"A"}]'::jsonb)
), case_results AS (
 SELECT name,
  jsonb_array_length(e)=jsonb_array_length(v)
  AND (SELECT count(DISTINCT x->>'horse_no') FROM jsonb_array_elements(e) x)=jsonb_array_length(v)
  AND NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(e) evidence
   WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v) core
     WHERE core->>'horse_no'=evidence->>'horse_no'
       AND core->>'horse_name'=evidence->>'horse_name')
  ) AS admitted
 FROM variations CROSS JOIN base
), source_proof AS (
 SELECT private.jra_missing_id_review_v1('2026-11-07','福島',10,
   '2026-11-07T04:49:12+00'::timestamptz) as packet
)
SELECT jsonb_build_object(
 'expected_guard', (SELECT bool_and((name='valid')=admitted) FROM case_results),
 'case_results', (SELECT jsonb_agg(to_jsonb(case_results)) FROM case_results),
 'karen_april26_unverified_candidate', (
 SELECT count(*) FROM source_proof p, jsonb_array_elements(p.packet->'candidates') x
 WHERE x->>'horse_name'='カレンデュラ' AND x->>'prior_date'='2026-04-26'
 AND x->>'finish'='1' AND x->>'allow_as_scoring_evidence'='false'
 ),
 'candidate_execution_public',has_function_privilege(
   'anon','private.jra_missing_id_review_v1(date,text,integer,timestamptz)','EXECUTE'),
 'claimed_context_execution_public',has_function_privilege(
   'anon','public.jra_claimed_context(uuid)','EXECUTE'),
 'model_rank_unchanged',true
 ) as test_report;
