-- Read-only advisory JRA0.4 preflight already applied in Supabase 2026-11-07 JST.
-- Existing guard, official FROZEN records, and Cron untouched. Service-only execute.

CREATE OR REPLACE FUNCTION public.lab_jra_save_preflight_v1(p_protocol_version text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 a jsonb; e text[]:=ARRAY[]::text[];
 n integer; x jsonb; grade text; seen integer[]:=ARRAY[]::integer[];
 top_seen integer[]:=ARRAY[]::integer[];
BEGIN
 IF p_protocol_version IS DISTINCT FROM 'JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023'
 THEN e:=array_append(e,'JRA_PROTOCOL_NOT_ACTIVE_0_4'); END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
   RETURN jsonb_build_object('ok',false,'errors',ARRAY['PAYLOAD_NOT_OBJECT'],'scope','JRA_0_4_SAVE_ADVISORY');
 END IF;
 IF NOT (p_payload ?& ARRAY['runners','top5','eye','bets','summary','bet_strategy','audit'])
    OR (SELECT count(*) FROM jsonb_object_keys(p_payload))<>7 THEN e:=array_append(e,'PAYLOAD_KEYS_NOT_EXACT'); END IF;
 a:=p_payload->'audit';
 IF jsonb_typeof(a) IS DISTINCT FROM 'object' THEN
   RETURN jsonb_build_object('ok',false,'errors',ARRAY['AUDIT_NOT_OBJECT'],'scope','JRA_0_4_SAVE_ADVISORY');
 END IF;
 IF a->>'protocol_version' IS DISTINCT FROM p_protocol_version THEN e:=array_append(e,'JRA_AUDIT_PROTOCOL_MISMATCH'); END IF;
 IF a->>'validated_core' IS DISTINCT FROM 'BASE_CORE_0.1' THEN e:=array_append(e,'JRA_CORE_WRONG'); END IF;
 IF a->'all_runners_checked' IS DISTINCT FROM 'true'::jsonb THEN e:=array_append(e,'JRA_NOT_ALL_RUNNERS_CHECKED'); END IF;
 IF a->'market_used_for_ranking' IS DISTINCT FROM 'false'::jsonb THEN e:=array_append(e,'JRA_MARKET_FOR_RANKING_NOT_FALSE'); END IF;
 IF a->'market_used_for_eye' IS DISTINCT FROM 'false'::jsonb THEN e:=array_append(e,'JRA_MARKET_FOR_EYE_NOT_FALSE'); END IF;
 IF a->'full_depth_comparison' IS DISTINCT FROM 'true'::jsonb THEN e:=array_append(e,'JRA_FULL_DEPTH_NOT_TRUE'); END IF;
 IF a->'official_full_field_verified' IS DISTINCT FROM 'true'::jsonb THEN e:=array_append(e,'JRA_OFFICIAL_FULL_FIELD_NOT_TRUE'); END IF;
 IF p_payload->'bets' IS DISTINCT FROM '[]'::jsonb THEN e:=array_append(e,'JRA_BETS_NOT_EMPTY'); END IF;
 IF p_payload->>'bet_strategy' IS DISTINCT FROM 'SUSPENDED_FOR_ABILITY_STABILITY' THEN e:=array_append(e,'JRA_STRATEGY_WRONG'); END IF;
 IF jsonb_typeof(p_payload->'runners') IS DISTINCT FROM 'array' OR jsonb_typeof(p_payload->'top5') IS DISTINCT FROM 'array' THEN
   RETURN jsonb_build_object('ok',false,'errors',array_append(e,'RUNNERS_OR_TOP5_NOT_ARRAY'),'scope','JRA_0_4_SAVE_ADVISORY');
 END IF;
 n:=jsonb_array_length(p_payload->'runners');
 IF n<5 OR n>20 THEN e:=array_append(e,'JRA_FIELD_RUNNER_COUNT_INVALID'); END IF;
 IF a->>'entry_count_verified' IS DISTINCT FROM n::text THEN e:=array_append(e,'JRA_ENTRY_COUNT_MISMATCH'); END IF;
 IF jsonb_array_length(p_payload->'top5')<>5 THEN e:=array_append(e,'JRA_TOP5_NOT_FIVE'); END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_payload->'runners') LOOP
   IF coalesce(x->>'horse_no','') !~ '^[0-9]+$' OR (coalesce(x->>'status','ACTIVE')<>'CANCELLED' AND coalesce(x->>'rank','') !~ '^[0-9]+$') OR (x->>'status'='CANCELLED' AND x->'rank' IS DISTINCT FROM 'null'::jsonb) THEN
     e:=array_append(e,'JRA_RUNNER_NUMBER_INVALID');CONTINUE;
   END IF;
   IF (x->>'horse_no')::int=ANY(seen) THEN e:=array_append(e,'JRA_DUPLICATE_RUNNER'); END IF;
   seen:=array_append(seen,(x->>'horse_no')::int);
   IF x->>'status'='CANCELLED' AND (
      jsonb_typeof(a->'cancelled_runner_nos') IS DISTINCT FROM 'array' OR
      NOT (a->'cancelled_runner_nos' @> jsonb_build_array((x->>'horse_no')::int))
    ) THEN e:=array_append(e,'JRA_CANCELLED_RUNNER_NOT_AUDITED'); END IF;

   grade:=x->>'grade';
   IF grade IS NULL OR grade NOT IN('S','A','B','C','D','E','F') THEN e:=array_append(e,'JRA_RUNNER_GRADE_INVALID'); END IF;
   IF btrim(coalesce(x->>'reason',x->>'comment',x->>'concrete_upside_reason',''))='' THEN
     e:=array_append(e,'JRA_RUNNER_REASON_MISSING');
   END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p_payload->'top5') LOOP
   IF coalesce(x->>'horse_no','') !~ '^[0-9]+$' THEN
     e:=array_append(e,'JRA_TOP5_HORSE_NO_INVALID');CONTINUE;
   END IF;
   IF (x->>'horse_no')::int=ANY(top_seen) THEN e:=array_append(e,'JRA_TOP5_DUPLICATE'); END IF;
   top_seen:=array_append(top_seen,(x->>'horse_no')::int);
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'runners') r
      WHERE r->'horse_no'=x->'horse_no' AND r->'rank'=x->'rank'
        AND r->'grade'=x->'grade' AND r->'horse_name'=x->'horse_name')
   THEN e:=array_append(e,'JRA_TOP5_RUNNER_MISMATCH'); END IF;
 END LOOP;
 IF jsonb_typeof(p_payload->'eye') NOT IN('object','null') THEN e:=array_append(e,'JRA_EYE_SHAPE_INVALID'); END IF;
 IF jsonb_typeof(p_payload->'eye')='object' AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_payload->'runners') r
      WHERE r->'horse_no'=p_payload->'eye'->'horse_no'
        AND r->'rank'=p_payload->'eye'->'rank'
        AND r->'grade'=p_payload->'eye'->'grade'
        AND r->'horse_name'=p_payload->'eye'->'horse_name')
 THEN e:=array_append(e,'JRA_EYE_RUNNER_MISMATCH'); END IF;
 RETURN jsonb_build_object('ok',cardinality(e)=0,'errors',e,'scope','JRA_0_4_SAVE_ADVISORY','runners',n);
END;
$function$

REVOKE ALL ON FUNCTION public.lab_jra_save_preflight_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_jra_save_preflight_v1(text,jsonb) TO service_role;
