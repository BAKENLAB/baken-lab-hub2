-- Restore original gate definitions; configuration table remains audit-only.
CREATE OR REPLACE FUNCTION public.jra_manual_claim_next_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_date date := (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date;
  v_job public.jra_prediction_jobs;
  v_run_id uuid;
  v_queued integer := 0;
BEGIN
  -- Serialize only the interactive "next" action; never touch Cron.
  PERFORM pg_catalog.pg_advisory_xact_lock(20261017, 12701);
  v_now := clock_timestamp();

  -- The current active claim is resumed rather than claiming a second race.
  SELECT j.* INTO v_job
    FROM public.jra_prediction_jobs j
    JOIN public.jra_prediction_worker_runs w ON w.id=j.worker_run_id
    JOIN public.official_races r
      ON (r.race_date,r.track,r.race_no,r.circuit)=(j.race_date,j.track,j.race_no,'JRA')
   WHERE j.race_date=v_date
     AND j.job_status='CLAIMED'
     AND j.claimed_by='JRA_QUEUE_RESCUE'
     AND j.lease_until>v_now
     AND w.status='RUNNING' AND w.worker_id='JRA_QUEUE_RESCUE'
     AND r.post_time>v_now+interval '3 minutes'
     AND r.prediction_status IN ('PENDING','RETRY')
     AND NOT EXISTS (
       SELECT 1 FROM public.official_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no))
   ORDER BY r.post_time,j.track,j.race_no LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('claimed',true,'resumed',true,
      'job_id',v_job.id,'track',v_job.track,'race_no',v_job.race_no,
      'lease_until',v_job.lease_until,'queued',0);
  END IF;

  -- Create only READY, future, flat-race jobs in the existing JRA job table.
  INSERT INTO public.jra_prediction_jobs(race_date,track,race_no)
  SELECT r.race_date,r.track,r.race_no
    FROM public.official_races r
   WHERE r.race_date=v_date AND r.circuit='JRA'
     AND r.field_status IN ('BASIC_READY','READY')
     AND r.prediction_status IN ('PENDING','RETRY')
     AND r.post_time BETWEEN v_now+interval '3 minutes' AND v_now+interval '70 minutes'
     AND coalesce(r.field_payload->'race'->>'race_type','') <> '障害'
     AND EXISTS (
       SELECT 1 FROM public.jra_live_races lr
       JOIN public.jra_live_runners hr ON hr.live_race_id=lr.id
       WHERE (lr.race_date,lr.track,lr.race_no)=(r.race_date,r.track,r.race_no))
     AND NOT EXISTS (
       SELECT 1 FROM public.official_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(r.race_date,r.track,r.race_no))
     AND NOT EXISTS (
       SELECT 1 FROM public.chappy_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(r.race_date,r.track,r.race_no))
   ON CONFLICT (race_date,track,race_no) DO NOTHING;
  GET DIAGNOSTICS v_queued=ROW_COUNT;

  SELECT j.* INTO v_job
    FROM public.jra_prediction_jobs j
    JOIN public.official_races r
      ON (r.race_date,r.track,r.race_no,r.circuit)=(j.race_date,j.track,j.race_no,'JRA')
   WHERE j.race_date=v_date
     AND r.field_status IN ('BASIC_READY','READY')
     AND r.prediction_status IN ('PENDING','RETRY')
     AND r.post_time BETWEEN v_now+interval '3 minutes' AND v_now+interval '70 minutes'
     AND coalesce(r.field_payload->'race'->>'race_type','') <> '障害'
     AND j.next_attempt_at<=v_now AND j.attempts<j.max_attempts
     AND (j.job_status IN ('QUEUED','RETRY')
       OR (j.job_status='CLAIMED' AND j.lease_until<=v_now))
     AND EXISTS (
       SELECT 1 FROM public.jra_live_races lr
       JOIN public.jra_live_runners hr ON hr.live_race_id=lr.id
       WHERE (lr.race_date,lr.track,lr.race_no)=(j.race_date,j.track,j.race_no))
     AND NOT EXISTS (
       SELECT 1 FROM public.official_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no))
     AND NOT EXISTS (
       SELECT 1 FROM public.chappy_predictions p
       WHERE (p.race_date,p.track,p.race_no)=(j.race_date,j.track,j.race_no))
   ORDER BY r.post_time,j.track,j.race_no
   LIMIT 1 FOR UPDATE OF j SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed',false,
      'reason','NO_READY_UNSAVED_JRA_RACE_IN_3_TO_70_MIN_WINDOW',
      'race_date',v_date,'queued',v_queued);
  END IF;

  INSERT INTO public.jra_prediction_worker_runs(worker_id,status)
  VALUES ('JRA_QUEUE_RESCUE','RUNNING')
  RETURNING id INTO v_run_id;

  UPDATE public.jra_prediction_jobs
     SET job_status='CLAIMED',attempts=attempts+1,
         claimed_by='JRA_QUEUE_RESCUE',claimed_at=v_now,
         lease_until=v_now+interval '15 minutes',
         claim_token=gen_random_uuid(),worker_run_id=v_run_id,updated_at=v_now
   WHERE id=v_job.id
   RETURNING * INTO v_job;

  UPDATE public.jra_prediction_worker_runs
     SET claimed_count=claimed_count+1
   WHERE id=v_run_id;

  RETURN jsonb_build_object('claimed',true,'resumed',false,
    'job_id',v_job.id,'track',v_job.track,'race_no',v_job.race_no,
    'lease_until',v_job.lease_until,'queued',v_queued);
END
$function$;

CREATE OR REPLACE FUNCTION public.jra_manual_readiness_v1(p_race_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_today date := (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date;
  v_date date;
  v_queue jsonb;
  v_data jsonb;
BEGIN
  SELECT COALESCE(
    p_race_date,
    (SELECT min(q.race_date) FROM public.jra_live_queue q WHERE q.race_date >= v_today),
    v_today
  ) INTO v_date;

  SELECT COALESCE(jsonb_object_agg(track, jsonb_build_object('total', total,'pending', pending,'done', done,'error', errors)), '{}'::jsonb)
    INTO v_queue
  FROM (
    SELECT track, count(*) AS total,
      count(*) FILTER (WHERE status='pending') AS pending,
      count(*) FILTER (WHERE status='done') AS done,
      count(*) FILTER (WHERE status='error') AS errors
    FROM public.jra_live_queue
    WHERE race_date=v_date
    GROUP BY track
  ) q;

  SELECT COALESCE(jsonb_object_agg(track, jsonb_build_object('races', n,'runner_rows', runner_rows)), '{}'::jsonb)
    INTO v_data
  FROM (
    SELECT r.track,count(DISTINCT r.id) AS n,count(hr.id) AS runner_rows
    FROM public.jra_live_races r
    LEFT JOIN public.jra_live_runners hr ON hr.live_race_id=r.id
    WHERE r.race_date=v_date
    GROUP BY r.track
  ) r;

  RETURN jsonb_build_object(
    'jst_today',v_today,
    'race_date',v_date,
    'jra_capture_queue',v_queue,
    'live_race_data',v_data,
    'official_races', (SELECT count(*) FROM public.official_races r WHERE r.race_date=v_date AND r.circuit='JRA'),
    'official_field_ready', (SELECT count(*) FROM public.official_races r WHERE r.race_date=v_date AND r.circuit='JRA' AND r.field_status IN ('BASIC_READY','READY')),
    'official_unsaved_ready', (SELECT count(*) FROM public.official_races r
        WHERE r.race_date=v_date AND r.circuit='JRA'
        AND r.field_status IN ('BASIC_READY','READY')
        AND r.prediction_status IN ('PENDING','RETRY')
        AND coalesce(r.field_payload->'race'->>'race_type','')<>'障害'
        AND NOT EXISTS (SELECT 1 FROM public.official_predictions p
          WHERE (p.race_date,p.track,p.race_no,p.circuit)=(r.race_date,r.track,r.race_no,'JRA'))),
    'frozen', (SELECT count(*) FROM public.official_predictions p
      WHERE p.race_date=v_date AND p.circuit='JRA' AND p.status='FROZEN'),
    'jobs', (SELECT count(*) FROM public.jra_prediction_jobs j WHERE j.race_date=v_date),
    'claimed', (SELECT count(*) FROM public.jra_prediction_jobs j
      WHERE j.race_date=v_date AND j.job_status='CLAIMED' AND j.lease_until>clock_timestamp()),
    'ready_to_claim_now', (SELECT count(*) FROM public.official_races r
      WHERE r.race_date=v_date AND r.circuit='JRA'
      AND r.field_status IN ('BASIC_READY','READY')
      AND r.prediction_status IN ('PENDING','RETRY')
      AND r.post_time BETWEEN clock_timestamp()+interval '3 minutes' AND clock_timestamp()+interval '70 minutes'
      AND coalesce(r.field_payload->'race'->>'race_type','')<>'障害'
      AND EXISTS (SELECT 1 FROM public.jra_live_races lr
        JOIN public.jra_live_runners h ON h.live_race_id=lr.id
        WHERE (lr.race_date,lr.track,lr.race_no)=(r.race_date,r.track,r.race_no))
      AND NOT EXISTS (SELECT 1 FROM public.official_predictions p
        WHERE (p.race_date,p.track,p.race_no,p.circuit)=(r.race_date,r.track,r.race_no,'JRA')))
  );
END;
$function$;
