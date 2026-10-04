CREATE OR REPLACE FUNCTION public.lab_save_claimed_prediction(p_run_id uuid, p_job_id uuid, p_claim_token uuid, p_protocol_version text, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_run public.lab_worker_runs;
  v_job public.lab_prediction_jobs;
  v_race public.official_races;
  v_prediction public.official_predictions;
  v_prediction_id uuid;
  v_protocol text;
  v_audit jsonb;
  v_now timestamptz;
  v_count integer;
BEGIN
  -- Every save locks run -> job -> registry race, agreeing with Phase 1.
  SELECT * INTO v_run FROM public.lab_worker_runs
  WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.status <> 'RUNNING' THEN
    RAISE EXCEPTION 'SAVE_RUN_NOT_RUNNING';
  END IF;
  SELECT * INTO v_job FROM public.lab_prediction_jobs
  WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SAVE_JOB_NOT_FOUND'; END IF;
  IF v_job.job_status <> 'CLAIMED'
    OR v_job.worker_run_id IS DISTINCT FROM p_run_id
    OR v_job.claim_token IS DISTINCT FROM p_claim_token
    OR v_job.claimed_by IS DISTINCT FROM v_run.worker_id
    OR v_job.lease_until IS NULL OR v_job.lease_until <= clock_timestamp()
    OR v_job.attempts > v_job.max_attempts THEN
    RAISE EXCEPTION 'SAVE_STALE_OR_EXPIRED_CLAIM';
  END IF;
  IF v_job.circuit <> 'LOCAL' THEN RAISE EXCEPTION 'SAVE_LOCAL_ONLY'; END IF;
  SELECT * INTO v_race FROM public.official_races
  WHERE (race_date,track,race_no,circuit) =
    (v_job.race_date,v_job.track,v_job.race_no,v_job.circuit)
  FOR UPDATE;
  IF NOT FOUND OR v_race.circuit <> 'LOCAL'
    OR (v_race.race_date,v_race.track,v_race.race_no,v_race.circuit)
      IS DISTINCT FROM (v_job.race_date,v_job.track,v_job.race_no,v_job.circuit) THEN
    RAISE EXCEPTION 'SAVE_RACE_MISMATCH';
  END IF;
  IF v_race.prediction_status NOT IN ('PENDING','RETRY') THEN
    RAISE EXCEPTION 'SAVE_RACE_STATUS';
  END IF;
  IF v_race.post_time IS NULL
    OR v_race.post_time <= clock_timestamp() + interval '3 minutes' THEN
    RAISE EXCEPTION 'SAVE_PRE_RACE_DEADLINE';
  END IF;

  -- SHARE permits concurrent saves, but prevents active-version updates and
  -- phantom new active rows through transaction end. This lock comes AFTER
  -- run/job/race. Protocol administration must not reverse that lock order.
  LOCK TABLE public.lab_prediction_protocols IN SHARE MODE;
  BEGIN
    SELECT version INTO STRICT v_protocol FROM public.lab_prediction_protocols
    WHERE protocol_key = 'LOCAL_MAIN' AND is_active = true;
  EXCEPTION
    WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
      RAISE EXCEPTION 'SAVE_ACTIVE_PROTOCOL_NOT_UNIQUE';
  END;
  IF p_protocol_version IS NULL OR p_protocol_version IS DISTINCT FROM v_protocol
    OR v_protocol IS NULL OR btrim(v_protocol) = '' THEN
    RAISE EXCEPTION 'SAVE_PROTOCOL_MISMATCH';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'SAVE_PAYLOAD_KEYS';
  END IF;
  IF NOT (p_payload ?& ARRAY['runners','top5','eye','bets','summary','bet_strategy','audit'])
    OR (SELECT count(*) FROM jsonb_object_keys(p_payload)) <> 7 THEN
    RAISE EXCEPTION 'SAVE_PAYLOAD_KEYS';
  END IF;
  IF jsonb_typeof(p_payload->'runners') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_payload->'top5') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_payload->'audit') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_payload->'eye') NOT IN ('object','null') THEN
    RAISE EXCEPTION 'SAVE_PAYLOAD_SHAPE';
  END IF;
  IF jsonb_array_length(p_payload->'runners') = 0
    OR jsonb_array_length(p_payload->'top5') = 0 THEN
    RAISE EXCEPTION 'SAVE_PAYLOAD_SHAPE';
  END IF;
  IF p_payload->'bets' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'SAVE_BETS_MUST_BE_EMPTY';
  END IF;
  IF p_payload->'bet_strategy' IS DISTINCT FROM '"SUSPENDED_FOR_ABILITY_STABILITY"'::jsonb THEN
    RAISE EXCEPTION 'SAVE_BET_STRATEGY';
  END IF;
  v_audit := p_payload->'audit';
  IF v_audit->'all_runners_checked' IS DISTINCT FROM 'true'::jsonb
    OR v_audit->'market_used_for_ranking' IS DISTINCT FROM 'false'::jsonb
    OR v_audit->'field_integrity_checked' IS DISTINCT FROM 'true'::jsonb
    OR v_audit->'protocol_version' IS DISTINCT FROM to_jsonb(v_protocol)
    OR v_audit->'execution_profile' IS DISTINCT FROM '"UNIFIED_LOCAL_ABILITY_V1"'::jsonb THEN
    RAISE EXCEPTION 'SAVE_AUDIT_REQUIRED';
  END IF;
  IF jsonb_array_length(p_payload->'runners') >= 6 AND (
    v_audit->'outside_top5_reaudited' IS DISTINCT FROM 'true'::jsonb
    OR v_audit->'eye_reaudit_guard' IS DISTINCT FROM '"EYE_REAUDIT_GUARD_20260929"'::jsonb
    OR v_audit->'rank6_auto_selected' IS DISTINCT FROM 'false'::jsonb
    OR v_audit->'eye_audit_specificity_guard' IS DISTINCT FROM 'true'::jsonb
  ) THEN
    RAISE EXCEPTION 'SAVE_SIX_RUNNER_AUDIT_REQUIRED';
  END IF;
  -- Three-column production uniqueness; legacy saved output remains protected.
  IF EXISTS (SELECT 1 FROM public.official_predictions p
    WHERE (p.race_date,p.track,p.race_no) = (v_job.race_date,v_job.track,v_job.race_no))
    OR EXISTS (SELECT 1 FROM public.chappy_predictions p
    WHERE (p.race_date,p.track,p.race_no) = (v_job.race_date,v_job.track,v_job.race_no)) THEN
    RAISE EXCEPTION 'SAVE_PREDICTION_ALREADY_EXISTS';
  END IF;
  v_now := clock_timestamp();
  IF v_job.lease_until <= v_now THEN RAISE EXCEPTION 'SAVE_STALE_OR_EXPIRED_CLAIM'; END IF;
  IF v_race.post_time <= v_now + interval '3 minutes' THEN
    RAISE EXCEPTION 'SAVE_PRE_RACE_DEADLINE';
  END IF;

  -- Plain INSERT. An external competing INSERT loses/wins at the existing
  -- UNIQUE constraint; no upsert/update/delete or exception swallowing.
  INSERT INTO public.official_predictions (
    race_date,track,race_no,race_name,circuit,post_time,protocol_version,
    model_label,source,status,predicted_at,frozen_at,payload
  ) VALUES (
    v_race.race_date,v_race.track,v_race.race_no,v_race.race_name,'LOCAL',
    v_race.post_time,v_protocol,'GPT-5.6 Sol','CHATGPT','FROZEN',v_now,v_now,p_payload
  ) RETURNING id INTO v_prediction_id;
  IF NOT FOUND OR v_prediction_id IS NULL THEN RAISE EXCEPTION 'SAVE_INSERT_SUPPRESSED'; END IF;
  -- AFTER INSERT triggers run before this reread. A registry FROZEN update is
  -- permitted, but no trigger may rewrite the saved payload or fixed metadata.
  SELECT * INTO v_prediction FROM public.official_predictions WHERE id = v_prediction_id;
  IF NOT FOUND OR v_prediction.payload IS DISTINCT FROM p_payload
    OR (v_prediction.race_date,v_prediction.track,v_prediction.race_no,v_prediction.circuit)
      IS DISTINCT FROM (v_race.race_date,v_race.track,v_race.race_no,v_race.circuit)
    OR v_prediction.race_name IS DISTINCT FROM v_race.race_name
    OR v_prediction.post_time IS DISTINCT FROM v_race.post_time
    OR v_prediction.protocol_version IS DISTINCT FROM v_protocol
    OR v_prediction.status <> 'FROZEN' OR v_prediction.source <> 'CHATGPT'
    OR v_prediction.model_label <> 'GPT-5.6 Sol' THEN
    RAISE EXCEPTION 'SAVE_INSERT_CONTRACT_CHANGED';
  END IF;
  UPDATE public.lab_prediction_jobs SET job_status = 'DONE', last_error = NULL,
    claimed_by = NULL, claimed_at = NULL, lease_until = NULL,
    claim_token = NULL, worker_run_id = NULL
  WHERE id = p_job_id AND job_status = 'CLAIMED'
    AND worker_run_id = p_run_id AND claim_token = p_claim_token
    AND claimed_by = v_run.worker_id AND lease_until > clock_timestamp()
    AND attempts <= max_attempts;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'SAVE_STALE_OR_EXPIRED_CLAIM'; END IF;
  UPDATE public.lab_worker_runs SET completed_count = completed_count + 1
  WHERE id = p_run_id AND status = 'RUNNING';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'SAVE_RUN_NOT_RUNNING'; END IF;

  -- Recheck clock and synchronous trigger effects before returning. A deferred
  -- trigger/constraint error at caller COMMIT also rolls back the transaction.
  IF v_job.lease_until <= clock_timestamp() THEN
    RAISE EXCEPTION 'SAVE_STALE_OR_EXPIRED_CLAIM';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.official_races r
    WHERE (r.race_date,r.track,race_no,r.circuit) =
      (v_job.race_date,v_job.track,v_job.race_no,v_job.circuit)
      AND r.post_time IS NOT DISTINCT FROM v_race.post_time
      AND r.post_time > clock_timestamp() + interval '3 minutes') THEN
    RAISE EXCEPTION 'SAVE_PRE_RACE_DEADLINE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lab_prediction_jobs j
    WHERE j.id = p_job_id AND j.job_status = 'DONE'
      AND (j.race_date,j.track,j.race_no,j.circuit) =
        (v_job.race_date,v_job.track,v_job.race_no,v_job.circuit)
      AND j.claimed_by IS NULL AND j.claimed_at IS NULL AND j.lease_until IS NULL
      AND j.claim_token IS NULL AND j.worker_run_id IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.lab_worker_runs r
      WHERE r.id = p_run_id AND r.status = 'RUNNING'
        AND r.completed_count = v_run.completed_count + 1) THEN
    RAISE EXCEPTION 'SAVE_COMPLETION_CONTRACT_CHANGED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.official_predictions p
    WHERE p.id = v_prediction_id AND to_jsonb(p) = to_jsonb(v_prediction)) THEN
    RAISE EXCEPTION 'SAVE_INSERT_CONTRACT_CHANGED';
  END IF;
  RETURN v_prediction_id;
END
$function$

