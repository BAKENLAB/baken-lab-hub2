-- Read-only JRA0.4 advisory preflight regression, 2026-11-07 JST.
-- Validated production baseline 2026-11-01: 18/18 saved JRA rows pass.
SELECT count(*) tested,
       count(*) FILTER(WHERE (public.lab_jra_save_preflight_v1(protocol_version,payload)->>'ok')::boolean) passed
FROM public.official_predictions
WHERE race_date='2026-11-01' AND circuit='JRA' AND status='FROZEN';

-- Tokyo 6R is a cancellation regression: 15 enrolled, 14 ACTIVE, #13 CANCELLED with null rank;
-- refusal of its cancellation audit entry must be diagnosed without ranking the scratched horse.
WITH p AS (
 SELECT protocol_version,payload
 FROM public.official_predictions
 WHERE race_date='2026-11-01' AND track='東京' AND race_no=6 AND circuit='JRA'
)
SELECT public.lab_jra_save_preflight_v1(protocol_version,payload) valid_scratch,
       public.lab_jra_save_preflight_v1(protocol_version,jsonb_set(payload,'{audit,cancelled_runner_nos}','[]'::jsonb)) missing_scratch_audit
FROM p;

-- 5 synthetic misconfigurations must be detected before attempted official save.
WITH p AS (
 SELECT protocol_version,payload FROM public.official_predictions
 WHERE race_date='2026-11-01' AND circuit='JRA' AND track='京都' AND race_no=2
)
SELECT public.lab_jra_save_preflight_v1(protocol_version,payload) valid,
       public.lab_jra_save_preflight_v1(protocol_version,jsonb_set(payload,'{audit,entry_count_verified}','0'::jsonb)) wrong_entry_count,
       public.lab_jra_save_preflight_v1(protocol_version,jsonb_set(payload,'{audit,official_full_field_verified}','false'::jsonb)) unverified_field,
       public.lab_jra_save_preflight_v1(protocol_version,jsonb_set(payload,'{audit,market_used_for_ranking}','true'::jsonb)) market_used,
       public.lab_jra_save_preflight_v1(protocol_version,jsonb_set(payload,'{bets}','[{"invalid":1}]'::jsonb)) nonempty_bets,
       public.lab_jra_save_preflight_v1(protocol_version,jsonb_set(payload,'{top5}','[]'::jsonb)) missing_top5
FROM p;
