-- Review candidate; generate a timestamped migration with Supabase CLI before rollout.
-- Additive only. Never execute production baseline SQL as a migration.
BEGIN;
CREATE FUNCTION public.lab_queue_claim_next_v1(p_worker_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
SET lock_timeout = '5s' SET statement_timeout = '12s'
AS $function$
DECLARE
  v_region text;
  v_run public.lab_worker_runs;
  v_job public.lab_prediction_jobs;
  v_resume public.lab_prediction_jobs;
  v_live integer := 0;
  v_run_id uuid;
BEGIN
  v_region := CASE p_worker_id
    WHEN 'LOCAL_QUEUE_WEST' THEN '西日本'
    WHEN 'LOCAL_QUEUE_KANTO' THEN '関東'
    WHEN 'LOCAL_QUEUE_CHUBU' THEN '中部'
    WHEN 'LOCAL_QUEUE_HOKKAIDO_TOHOKU' THEN '北海道東北'
    WHEN 'LOCAL_QUEUE_RESCUE' THEN 'RESCUE' END;
  IF v_region IS NULL THEN RAISE EXCEPTION 'WORKER_NOT_ALLOWED'; END IF;
  -- Advisory lock is transaction scoped. All NEW queue entries must use it.
  PERFORM pg_advisory_xact_lock(72816, hashtext(p_worker_id));
  PERFORM public.lab_enqueue_prediction_jobs((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date);
  -- Existing guarded save also locks run -> job. Never reverse that order.
  FOR v_run IN SELECT r.* FROM public.lab_worker_runs r
    WHERE r.worker_id=p_worker_id AND r.status='RUNNING'
    ORDER BY r.id FOR UPDATE OF r
  LOOP
    IF v_run.region IS DISTINCT FROM v_region THEN RAISE EXCEPTION 'QUEUE_STATE_UNAVAILABLE'; END IF;
    FOR v_job IN SELECT j.* FROM public.lab_prediction_jobs j
      WHERE j.worker_run_id=v_run.id AND j.job_status='CLAIMED'
        AND (j.lease_until IS NULL OR j.lease_until > clock_timestamp())
      ORDER BY j.id FOR UPDATE OF j
    LOOP
      -- Corrupt/inconsistent unexpired claims block new work; never steal them.
      IF v_job.circuit IS DISTINCT FROM 'LOCAL'
        OR v_job.claimed_by IS DISTINCT FROM p_worker_id
        OR v_job.claim_token IS NULL OR v_job.lease_until IS NULL
        OR v_job.attempts > v_job.max_attempts
        OR (v_region<>'RESCUE' AND v_job.region IS DISTINCT FROM v_region)
        OR NOT EXISTS (SELECT 1 FROM public.lab_prediction_race_state s
          WHERE (s.race_date,s.track,s.race_no,s.circuit)=
            (v_job.race_date,v_job.track,v_job.race_no,v_job.circuit)
          AND s.region=v_job.region AND s.prediction_status IN ('PENDING','RETRY')
          AND NOT s.has_official_prediction AND NOT s.has_legacy_prediction
          AND s.post_time>clock_timestamp()+interval '3 minutes')
      THEN RAISE EXCEPTION 'QUEUE_STATE_UNAVAILABLE'; END IF;
      v_live:=v_live+1; v_resume:=v_job;
    END LOOP;
  END LOOP;
  -- Missing/terminal owner run must not be treated as permission to start again.
  IF EXISTS (SELECT 1 FROM public.lab_prediction_jobs j
    LEFT JOIN public.lab_worker_runs r ON r.id=j.worker_run_id
    WHERE j.claimed_by=p_worker_id AND j.job_status='CLAIMED'
      AND (j.lease_until IS NULL OR j.lease_until>clock_timestamp())
      AND (r.id IS NULL OR r.worker_id IS DISTINCT FROM p_worker_id OR r.status<>'RUNNING'))
    OR v_live>1 THEN RAISE EXCEPTION 'QUEUE_STATE_UNAVAILABLE'; END IF;
  -- Check expired ownership too; inconsistent claims are never cleaned/reclaimed.
  IF EXISTS (SELECT 1 FROM public.lab_prediction_jobs j
    LEFT JOIN public.lab_worker_runs r ON r.id=j.worker_run_id
    WHERE j.job_status='CLAIMED' AND (r.worker_id=p_worker_id OR j.claimed_by=p_worker_id)
      AND (r.id IS NULL OR r.worker_id IS DISTINCT FROM p_worker_id
        OR r.region IS DISTINCT FROM v_region
        OR j.claimed_by IS DISTINCT FROM r.worker_id OR j.circuit IS DISTINCT FROM 'LOCAL'
        OR j.claim_token IS NULL OR j.lease_until IS NULL
        OR (v_region<>'RESCUE' AND j.region IS DISTINCT FROM r.region)
        OR NOT EXISTS (SELECT 1 FROM public.lab_prediction_race_state s
          WHERE (s.race_date,s.track,s.race_no,s.circuit)=
            (j.race_date,j.track,j.race_no,j.circuit) AND s.region=j.region)))
    THEN RAISE EXCEPTION 'QUEUE_STATE_UNAVAILABLE'; END IF;
  -- Only this worker's runs with NO unexpired claim are eligible for cleanup.
  -- Re-lock/recheck under the run lock; old direct callers must be retired.
  FOR v_run IN SELECT r.* FROM public.lab_worker_runs r
    WHERE r.worker_id=p_worker_id AND r.region=v_region AND r.status='RUNNING'
    ORDER BY r.id FOR UPDATE OF r
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.lab_prediction_jobs j
      WHERE j.worker_run_id=v_run.id AND j.job_status='CLAIMED'
        AND (j.lease_until IS NULL OR j.lease_until>clock_timestamp())) THEN
      PERFORM public.lab_finish_worker_run(v_run.id,'ABANDONED','QUEUE_NO_LIVE_CLAIM');
    END IF;
  END LOOP;
  IF v_live=1 THEN
    IF v_resume.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'QUEUE_STATE_UNAVAILABLE'; END IF;
    RETURN jsonb_build_object('claimed',true,'resumed',true,'job_id',v_resume.id,
      'run_id',v_resume.worker_run_id,'region',v_region,'lease_until',v_resume.lease_until);
  END IF;
  v_run_id:=public.lab_start_worker_run(p_worker_id,v_region);
  SELECT j.* INTO v_job FROM public.lab_claim_prediction_jobs(v_run_id,1,900) j;
  IF NOT FOUND THEN
    PERFORM public.lab_finish_worker_run(v_run_id,'SUCCEEDED',NULL);
    RETURN jsonb_build_object('claimed',false,'resumed',false);
  END IF;
  RETURN jsonb_build_object('claimed',true,'resumed',false,'job_id',v_job.id,
    'run_id',v_run_id,'region',v_region,'lease_until',v_job.lease_until);
END
$function$;
REVOKE ALL ON FUNCTION public.lab_queue_claim_next_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_queue_claim_next_v1(text) TO service_role;

-- Receipt proves a successful save through THIS route. No prediction duplication.
CREATE TABLE public.lab_local_queue_save_receipts (
  job_id uuid PRIMARY KEY REFERENCES public.lab_prediction_jobs(id),
  prediction_id uuid NOT NULL UNIQUE REFERENCES public.official_predictions(id),
  user_id uuid NOT NULL,
  original_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.lab_local_queue_save_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lab_local_queue_save_receipts FROM PUBLIC;
REVOKE ALL ON public.lab_local_queue_save_receipts FROM anon;
REVOKE ALL ON public.lab_local_queue_save_receipts FROM authenticated;
REVOKE ALL ON public.lab_local_queue_save_receipts FROM service_role;
GRANT SELECT,INSERT ON public.lab_local_queue_save_receipts TO service_role;
-- No policies for ordinary clients. Supabase service_role's BYPASSRLS is required.
CREATE FUNCTION public.lab_queue_save_prediction_v1(
  p_job_id uuid,p_user_id uuid,p_protocol_version text,p_payload jsonb,p_original_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
SET lock_timeout='5s' SET statement_timeout='12s'
AS $function$
DECLARE
  v_job public.lab_prediction_jobs;
  v_run public.lab_worker_runs;
  v_prediction_id uuid;
  v_receipt public.lab_local_queue_save_receipts;
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_original_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'SAVE_REJECTED'; END IF;
  -- Serializes response-loss retries. No prediction writes outside guarded RPC.
  PERFORM pg_advisory_xact_lock(72817,hashtext(p_job_id::text));
  SELECT j.* INTO v_job FROM public.lab_prediction_jobs j WHERE j.id=p_job_id;
  IF NOT FOUND OR v_job.circuit IS DISTINCT FROM 'LOCAL' THEN RAISE EXCEPTION 'SAVE_REJECTED'; END IF;
  IF v_job.job_status='DONE' THEN
    SELECT r.* INTO v_receipt FROM public.lab_local_queue_save_receipts r
      WHERE r.job_id=p_job_id AND r.user_id=p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'SAVE_REJECTED'; END IF;
    IF v_receipt.original_payload IS DISTINCT FROM p_original_payload THEN RAISE EXCEPTION 'SAVE_RETRY_MISMATCH'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.official_predictions p
      WHERE p.id=v_receipt.prediction_id AND p.circuit='LOCAL' AND p.status='FROZEN'
        AND p.source='CHATGPT'
        AND (p.race_date,p.track,p.race_no)=(v_job.race_date,v_job.track,v_job.race_no)
        AND p.protocol_version=p_protocol_version AND p.payload=p_payload) THEN
      RAISE EXCEPTION 'SAVE_RETRY_MISMATCH';
    END IF;
    RETURN jsonb_build_object('ok',true,'prediction_id',v_receipt.prediction_id,'already_saved',true);
  END IF;
  SELECT r.* INTO v_run FROM public.lab_worker_runs r WHERE r.id=v_job.worker_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.status<>'RUNNING' THEN RAISE EXCEPTION 'SAVE_REJECTED'; END IF;
  SELECT j.* INTO v_job FROM public.lab_prediction_jobs j WHERE j.id=p_job_id FOR UPDATE;
  IF v_job.worker_run_id IS DISTINCT FROM v_run.id OR v_job.claimed_by IS DISTINCT FROM v_run.worker_id
    OR v_job.job_status<>'CLAIMED' OR v_job.claim_token IS NULL
    OR v_job.lease_until IS NULL OR v_job.lease_until<=clock_timestamp()
    OR v_job.attempts>v_job.max_attempts
    OR NOT ((v_run.worker_id='LOCAL_QUEUE_RESCUE' AND v_run.region='RESCUE')
      OR (v_run.worker_id='LOCAL_QUEUE_WEST' AND v_run.region='西日本' AND v_job.region=v_run.region)
      OR (v_run.worker_id='LOCAL_QUEUE_KANTO' AND v_run.region='関東' AND v_job.region=v_run.region)
      OR (v_run.worker_id='LOCAL_QUEUE_CHUBU' AND v_run.region='中部' AND v_job.region=v_run.region)
      OR (v_run.worker_id='LOCAL_QUEUE_HOKKAIDO_TOHOKU' AND v_run.region='北海道東北' AND v_job.region=v_run.region))
    THEN RAISE EXCEPTION 'SAVE_REJECTED'; END IF;
  v_prediction_id:=public.lab_save_claimed_prediction(v_run.id,p_job_id,v_job.claim_token,p_protocol_version,p_payload);
  INSERT INTO public.lab_local_queue_save_receipts(job_id,prediction_id,user_id,original_payload)
    VALUES(p_job_id,v_prediction_id,p_user_id,p_original_payload);
  RETURN jsonb_build_object('ok',true,'prediction_id',v_prediction_id,'already_saved',false);
END
$function$;
REVOKE ALL ON FUNCTION public.lab_queue_save_prediction_v1(uuid,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lab_queue_save_prediction_v1(uuid,uuid,text,jsonb,jsonb) TO service_role;
COMMIT;
