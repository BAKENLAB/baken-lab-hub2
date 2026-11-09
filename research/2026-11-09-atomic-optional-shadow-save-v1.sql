-- BAKEN LAB / research-only: atomic official-save + optional shadow seal.
-- Shadow failures MUST NOT block the exact original guarded save.
-- If the official save rejects, PostgreSQL rolls back any shadow insert.
-- No existing FROZEN changes, no direct official_predictions write.

CREATE OR REPLACE FUNCTION private.lab_shadow_draft_equals_save_v1(
 p_circuit text,p_payload jsonb,p_baseline jsonb
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO pg_catalog,public,private
AS $$
DECLARE
 v_runners jsonb;
 v_all_status_missing boolean;
 v_candidates jsonb;
 v_n integer;
BEGIN
 IF p_circuit NOT IN ('JRA','LOCAL') OR
   jsonb_typeof(p_payload->'runners') IS DISTINCT FROM 'array' OR
   jsonb_typeof(p_baseline) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 v_runners:=p_payload->'runners';
 v_all_status_missing:=p_circuit='JRA' AND NOT EXISTS
  (SELECT 1 FROM jsonb_array_elements(v_runners) x WHERE x ? 'status');
 SELECT jsonb_agg(jsonb_build_object('horse_no',(x->>'horse_no')::integer,
  'horse_name',x->>'horse_name','rank',(x->>'rank')::integer)
  ORDER BY (x->>'rank')::integer)
 INTO v_candidates
 FROM jsonb_array_elements(v_runners) x
 WHERE x->>'status'='ACTIVE' OR v_all_status_missing;
 v_n:=jsonb_array_length(p_baseline);
 IF v_n<6 OR v_n>20 OR jsonb_array_length(v_candidates)<>v_n OR
  (SELECT count(DISTINCT x->>'rank') FROM jsonb_array_elements(v_candidates) x)<>v_n OR
  (SELECT count(DISTINCT x->>'horse_no') FROM jsonb_array_elements(v_candidates) x)<>v_n THEN
   RETURN false;
 END IF;
 RETURN v_candidates IS NOT DISTINCT FROM (
   SELECT jsonb_agg(jsonb_build_object('horse_no',(x->>'horse_no')::integer,
    'horse_name',x->>'horse_name','rank',(x->>'rank')::integer)
    ORDER BY (x->>'rank')::integer)
   FROM jsonb_array_elements(p_baseline) x
 );
EXCEPTION WHEN OTHERS THEN
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION private.lab_shadow_draft_equals_save_v1(text,jsonb,jsonb)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.lab_shadow_draft_equals_save_v1(text,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.jra_save_claimed_prediction_with_shadow_v1(
 p_job_id uuid,p_protocol_version text,p_payload jsonb,
 p_baseline jsonb DEFAULT NULL,p_preview jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO pg_catalog,public,private
SET lock_timeout TO '5s'
AS $$
DECLARE
 v_prediction_id uuid;
 v_receipt jsonb;
 v_shadow_status text:='NOT_PROVIDED';
BEGIN
 -- Must use same JRA job -> worker lock order as original save.
 IF p_baseline IS NOT NULL AND p_preview IS NOT NULL THEN
  BEGIN
   IF NOT private.lab_shadow_draft_equals_save_v1('JRA',p_payload,p_baseline) THEN
     RAISE EXCEPTION 'SHADOW_DRAFT_NOT_SAVED_PAYLOAD';
   END IF;
   v_receipt:=public.lab_capture_rank_shadow_preflight_v1('JRA',p_job_id,p_baseline,p_preview);
   v_shadow_status:=coalesce(v_receipt->>'status','UNVERIFIED_RECEIPT');
  EXCEPTION WHEN OTHERS THEN
   v_shadow_status:='OPTIONAL_CAPTURE_SKIPPED';
   -- Subtransaction rolls back all failed shadow attempts.
  END;
 END IF;
 -- ORIGINAL guard: atomic with optional shadow. Failure rolls back both.
 v_prediction_id:=public.jra_save_claimed_prediction(p_job_id,p_protocol_version,p_payload);
 IF v_prediction_id IS NULL THEN RAISE EXCEPTION 'SAVE_REJECTED'; END IF;
 RETURN jsonb_build_object('ok',true,'prediction_id',v_prediction_id,
   'shadow_status',v_shadow_status,'official_saved',true);
END $$;
REVOKE ALL ON FUNCTION public.jra_save_claimed_prediction_with_shadow_v1(uuid,text,jsonb,jsonb,jsonb)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jra_save_claimed_prediction_with_shadow_v1(uuid,text,jsonb,jsonb,jsonb)
TO service_role;

CREATE OR REPLACE FUNCTION public.lab_queue_save_prediction_with_shadow_v1(
 p_job_id uuid,p_user_id uuid,p_protocol_version text,p_payload jsonb,
 p_original_payload jsonb,p_baseline jsonb DEFAULT NULL,p_preview jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO pg_catalog,public,private
SET lock_timeout TO '5s'
SET statement_timeout TO '12s'
AS $$
DECLARE
 v_response jsonb;
 v_receipt jsonb;
 v_shadow_status text:='NOT_PROVIDED';
BEGIN
 IF p_baseline IS NOT NULL AND p_preview IS NOT NULL THEN
  BEGIN
   IF NOT private.lab_shadow_draft_equals_save_v1('LOCAL',p_payload,p_baseline)
   THEN RAISE EXCEPTION 'SHADOW_DRAFT_NOT_SAVED_PAYLOAD'; END IF;
   -- Keep LOCAL queue save's advisory lock order before the preflight check.
   PERFORM pg_advisory_xact_lock(72817,hashtext(p_job_id::text));
   v_receipt:=public.lab_capture_rank_shadow_preflight_v1('LOCAL',p_job_id,p_baseline,p_preview);
   v_shadow_status:=coalesce(v_receipt->>'status','UNVERIFIED_RECEIPT');
  EXCEPTION WHEN OTHERS THEN
   v_shadow_status:='OPTIONAL_CAPTURE_SKIPPED';
  END;
 END IF;
 v_response:=public.lab_queue_save_prediction_v1(
   p_job_id,p_user_id,p_protocol_version,p_payload,p_original_payload);
 IF v_response->'ok' IS DISTINCT FROM 'true'::jsonb THEN
  RAISE EXCEPTION 'SAVE_REJECTED';
 END IF;
 RETURN v_response||jsonb_build_object('shadow_status',v_shadow_status,
   'official_saved',true);
END $$;
REVOKE ALL ON FUNCTION public.lab_queue_save_prediction_with_shadow_v1(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_queue_save_prediction_with_shadow_v1(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb)
TO service_role;
