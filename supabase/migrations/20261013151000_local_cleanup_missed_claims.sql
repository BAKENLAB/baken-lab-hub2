-- Reap LOCAL jobs whose race is already too old for a new FROZEN.
-- Called by the already-running enqueue cron; makes no API calls and never edits FROZEN predictions.
CREATE OR REPLACE FUNCTION public.lab_cleanup_local_missed_deadlines(p_race_date date)
RETURNS integer LANGUAGE plpgsql SET search_path TO 'pg_catalog' AS $cleanup$
DECLARE
  v_runs uuid[];
  v_count integer:=0;
  v_run_id uuid;
BEGIN
  IF p_race_date IS NULL THEN RAISE EXCEPTION 'RACE_DATE_REQUIRED'; END IF;
  WITH eligible AS (
    SELECT j.id,j.worker_run_id
    FROM public.lab_prediction_jobs j
    JOIN public.official_races r
      ON (r.race_date,r.track,r.race_no,r.circuit)=(j.race_date,j.track,j.race_no,j.circuit)
    WHERE j.race_date=p_race_date AND j.circuit='LOCAL'
      AND r.post_time < clock_timestamp() - interval '3 minutes'
      AND (
        j.job_status IN ('QUEUED','RETRY')
        OR (j.job_status='CLAIMED' AND (j.lease_until IS NULL OR j.lease_until<=clock_timestamp()))
      )
    FOR UPDATE OF j SKIP LOCKED
  ), updated AS (
    UPDATE public.lab_prediction_jobs j
    SET job_status='DEAD',
        last_error=CASE WHEN j.job_status='CLAIMED'
          THEN 'EXPIRED_CLAIM_PAST_DEADLINE'
          ELSE 'MISSED_FROZEN_DEADLINE_NO_WORKER' END,
        claimed_by=NULL, claimed_at=NULL, lease_until=NULL,
        claim_token=NULL, worker_run_id=NULL
    FROM eligible e WHERE j.id=e.id
    RETURNING j.id
  )
  SELECT count(*)::integer,coalesce(array_agg(DISTINCT e.worker_run_id)
      FILTER(WHERE e.worker_run_id IS NOT NULL),ARRAY[]::uuid[])
  INTO v_count,v_runs FROM updated u JOIN eligible e ON e.id=u.id;

  -- Failed/abandoned runs are recorded, but never reopen or alter prediction rows.
  FOREACH v_run_id IN ARRAY v_runs LOOP
    IF EXISTS (SELECT 1 FROM public.lab_worker_runs
       WHERE id=v_run_id AND status='RUNNING')
      AND NOT EXISTS (SELECT 1 FROM public.lab_prediction_jobs
       WHERE worker_run_id=v_run_id AND job_status='CLAIMED')
    THEN
      PERFORM public.lab_finish_worker_run(v_run_id,'ABANDONED','EXPIRED_CLAIM_PAST_DEADLINE');
    END IF;
  END LOOP;
  RETURN v_count;
END;
$cleanup$;

-- Keep the existing enqueue behavior unchanged; only prepend a stale-deadline sweep.
DO $patch$
DECLARE code text;
  old_anchor text:= 'IF p_race_date IS NULL THEN
    RAISE EXCEPTION ''race_date is required'';
  END IF;';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO code
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='lab_enqueue_prediction_jobs';
  IF code IS NULL OR position(old_anchor IN code)=0
    OR position('lab_cleanup_local_missed_deadlines' IN code)>0
  THEN RAISE EXCEPTION 'ENQUEUE_SOURCE_CHANGED_OR_ALREADY_PATCHED'; END IF;
  code:=replace(code,old_anchor,old_anchor||E'\n\n  PERFORM public.lab_cleanup_local_missed_deadlines(p_race_date);');
  EXECUTE code;
END;
$patch$;
