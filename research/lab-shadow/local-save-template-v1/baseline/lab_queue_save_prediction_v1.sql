CREATE OR REPLACE FUNCTION public.lab_queue_save_prediction_v1(p_job_id uuid, p_user_id uuid, p_protocol_version text, p_payload jsonb, p_original_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
 SET lock_timeout TO '5s'
 SET statement_timeout TO '12s'
AS $function$
DECLARE
  v_job public.lab_prediction_jobs;
  v_run public.lab_worker_runs;
  v_prediction_id uuid;
  v_receipt public.lab_local_queue_save_receipts;
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_original_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'SAVE_REJECTED'; END IF;
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
$function$
