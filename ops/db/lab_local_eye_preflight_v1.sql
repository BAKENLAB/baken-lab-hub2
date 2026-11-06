-- Production read-only diagnostic already applied in migration 2026-11-07 JST.
-- Kept here for source review and future reproducibility; DO NOT enable Cron or replace the save gate.

CREATE OR REPLACE FUNCTION public.lab_local_eye_preflight_v1(p_protocol_version text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 a jsonb; err text[] := ARRAY[]::text[]; outs int[]; checked int[]; candidates int[]; factors int[];
BEGIN
 IF p_protocol_version IS DISTINCT FROM 'CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'
 THEN err:=array_append(err,'PROTOCOL_NOT_LOCAL_1_6'); END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
   RETURN jsonb_build_object('ok',false,'errors',ARRAY['PAYLOAD_NOT_OBJECT'],'scope','LOCAL_1_6_FLAG_POOL_PREFLIGHT');
 END IF;
 a:=p_payload->'audit';
 IF jsonb_typeof(a) IS DISTINCT FROM 'object' THEN
   RETURN jsonb_build_object('ok',false,'errors',ARRAY['AUDIT_NOT_OBJECT'],'scope','LOCAL_1_6_FLAG_POOL_PREFLIGHT');
 END IF;
 IF a->>'protocol_version' IS DISTINCT FROM p_protocol_version THEN err:=array_append(err,'AUDIT_PROTOCOL_MISMATCH'); END IF;
 IF a->'rank6_auto_selected' IS DISTINCT FROM 'false'::jsonb THEN err:=array_append(err,'RANK6_AUTO_NOT_FALSE'); END IF;
 IF a->'market_used_for_eye' IS DISTINCT FROM 'false'::jsonb THEN err:=array_append(err,'EYE_MARKET_FLAG_NOT_FALSE'); END IF;
 IF a->>'eye_selection_method' IS DISTINCT FROM 'LOCAL_EYE_FACTOR_COUNT_V1' THEN err:=array_append(err,'EYE_SELECTION_METHOD_WRONG'); END IF;
 IF a->>'eye_reaudit_guard' IS DISTINCT FROM 'EYE_REAUDIT_GUARD_20260929' THEN err:=array_append(err,'EYE_REAUDIT_GUARD_WRONG'); END IF;
 IF jsonb_typeof(p_payload->'bets') IS DISTINCT FROM 'array' OR p_payload->'bets' IS DISTINCT FROM '[]'::jsonb THEN err:=array_append(err,'BETS_NOT_EMPTY'); END IF;
 IF p_payload->>'bet_strategy' IS DISTINCT FROM 'SUSPENDED_FOR_ABILITY_STABILITY' THEN err:=array_append(err,'BET_STRATEGY_WRONG'); END IF;
 IF jsonb_typeof(p_payload->'runners') IS DISTINCT FROM 'array' OR jsonb_typeof(p_payload->'top5') IS DISTINCT FROM 'array' THEN
   err:=array_append(err,'RUNNERS_OR_TOP5_NOT_ARRAY');
 ELSE
   IF jsonb_array_length(p_payload->'top5')<>5 THEN err:=array_append(err,'TOP5_NOT_FIVE'); END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'runners') x WHERE coalesce(x->>'rank','') !~ '^[0-9]+$'
      OR coalesce(x->>'horse_no','') !~ '^[0-9]+$') THEN
      err:=array_append(err,'RUNNER_RANK_OR_NO_INVALID');
   ELSE
      SELECT array_agg((x->>'horse_no')::int ORDER BY (x->>'horse_no')::int) INTO outs
      FROM jsonb_array_elements(p_payload->'runners') x WHERE (x->>'rank')::int>5;
   END IF;
 END IF;
 IF jsonb_typeof(a->'eye_pool_checked')='array'
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a->'eye_pool_checked') x WHERE jsonb_typeof(x)<>'number' OR x::text !~ '^[0-9]+$')
 THEN
  SELECT array_agg(x::text::int ORDER BY x::text::int) INTO checked FROM jsonb_array_elements(a->'eye_pool_checked') x;
 ELSE err:=array_append(err,'EYE_POOL_INVALID'); END IF;
 IF jsonb_typeof(a->'eye_candidate_audit')='array'
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a->'eye_candidate_audit') x WHERE coalesce(x->>'horse_no','') !~ '^[0-9]+$')
 THEN
  SELECT array_agg((x->>'horse_no')::int ORDER BY (x->>'horse_no')::int) INTO candidates FROM jsonb_array_elements(a->'eye_candidate_audit') x;
 ELSE err:=array_append(err,'EYE_CANDIDATES_INVALID'); END IF;
 IF jsonb_typeof(a->'eye_positive_factor_audit')='array'
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a->'eye_positive_factor_audit') x WHERE coalesce(x->>'horse_no','') !~ '^[0-9]+$')
 THEN
  SELECT array_agg((x->>'horse_no')::int ORDER BY (x->>'horse_no')::int) INTO factors FROM jsonb_array_elements(a->'eye_positive_factor_audit') x;
 ELSE err:=array_append(err,'EYE_FACTOR_POOL_INVALID'); END IF;
 IF outs IS NOT NULL AND checked IS DISTINCT FROM outs THEN err:=array_append(err,'EYE_CHECKED_POOL_SET_MISMATCH'); END IF;
 IF outs IS NOT NULL AND candidates IS DISTINCT FROM outs THEN err:=array_append(err,'EYE_CANDIDATE_SET_MISMATCH'); END IF;
 IF outs IS NOT NULL AND factors IS DISTINCT FROM outs THEN err:=array_append(err,'EYE_FACTOR_POOL_SET_MISMATCH'); END IF;
 IF jsonb_typeof(a->'eye_pairwise_comparison') IS DISTINCT FROM 'array'
  OR a->'eye_pairwise_comparison' IS DISTINCT FROM '[]'::jsonb
 THEN err:=array_append(err,'V1_6_OLD_PAIRS_OR_INVALID'); END IF;
 RETURN jsonb_build_object('ok',cardinality(err)=0,'errors',err,'scope','LOCAL_1_6_FLAG_POOL_PREFLIGHT',
  'runners',CASE WHEN jsonb_typeof(p_payload->'runners')='array' THEN jsonb_array_length(p_payload->'runners') ELSE NULL END,
  'outside_top5',coalesce(cardinality(outs),0));
END;
$function$


REVOKE ALL ON FUNCTION public.lab_local_eye_preflight_v1(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_local_eye_preflight_v1(text,jsonb) TO service_role;
