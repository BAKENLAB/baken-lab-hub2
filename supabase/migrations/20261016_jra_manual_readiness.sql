-- JRA read-only manual operational status; does not enqueue, claim, save or change Cron.
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
$function$
;
REVOKE ALL ON FUNCTION public.jra_manual_readiness_v1(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jra_manual_readiness_v1(date) TO service_role;
