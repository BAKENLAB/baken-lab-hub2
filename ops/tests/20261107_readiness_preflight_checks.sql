-- Safe regression diagnostics. SELECT-only, never saves predictions or changes a queue.
-- Run with a privileged database operator role; both functions only have EXECUTE granted to service_role.
SELECT circuit,track,count(*) registered,
       count(*) FILTER(WHERE attention_code='OK_FROZEN') frozen,
       count(*) FILTER(WHERE attention_code<>'OK_FROZEN') not_frozen
FROM public.lab_race_readiness_audit_v1('2026-11-06')
GROUP BY circuit,track ORDER BY circuit,track;

-- Last recorded LOCAL 2026-11-06 baseline: 笠松10/12 園田10/12 船橋8/12.
SELECT count(*) tested,
       count(*) FILTER(WHERE (public.lab_local_eye_preflight_v1(protocol_version,payload)->>'ok')::boolean) passed
FROM public.official_predictions
WHERE race_date='2026-11-06' AND circuit='LOCAL' AND status='FROZEN';

-- Exact flag regression: successful frozen payload passes; 5 modified copies must fail.
WITH p AS (
  SELECT protocol_version,payload FROM public.official_predictions
  WHERE race_date='2026-11-06' AND track='船橋' AND race_no=12 AND circuit='LOCAL' LIMIT 1
), trials AS (
 SELECT 'valid' label,protocol_version,payload candidate FROM p
 UNION ALL SELECT 'wrong_method',protocol_version,jsonb_set(payload,'{audit,eye_selection_method}','"LOCAL_EYE_COMPARISON_V1"'::jsonb) FROM p
 UNION ALL SELECT 'rank6_auto',protocol_version,jsonb_set(payload,'{audit,rank6_auto_selected}','true'::jsonb) FROM p
 UNION ALL SELECT 'market_flag',protocol_version,jsonb_set(payload,'{audit,market_used_for_eye}','true'::jsonb) FROM p
 UNION ALL SELECT 'bad_reaudit_guard',protocol_version,jsonb_set(payload,'{audit,eye_reaudit_guard}','"WRONG_GUARD"'::jsonb) FROM p
 UNION ALL SELECT 'wrong_checked_pool',protocol_version,jsonb_set(payload,'{audit,eye_pool_checked}','[]'::jsonb) FROM p
)
SELECT label,public.lab_local_eye_preflight_v1(protocol_version,candidate) diagnostic FROM trials;

-- Next date: call after official race ingestion.
SELECT * FROM public.lab_race_readiness_audit_v1('2026-11-07') ORDER BY post_jst,track,race_no;
