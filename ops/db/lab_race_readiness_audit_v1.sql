-- Production read-only diagnostic already applied in migration 2026-11-07 JST.
-- Kept here for source review and future reproducibility; DO NOT enable Cron or replace the save gate.

CREATE OR REPLACE FUNCTION public.lab_race_readiness_audit_v1(p_race_date date)
 RETURNS TABLE(race_date date, circuit text, track text, race_no integer, post_jst timestamp without time zone, field_status text, prediction_status text, job_status text, minutes_to_post numeric, official_runner_count bigint, active_runner_count bigint, local_zero_history_name_matches bigint, jra_live_runner_count bigint, claim_state text, attention_code text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT
 r.race_date,
 r.circuit,
 r.track,
 r.race_no,
 r.post_time AT TIME ZONE 'Asia/Tokyo',
 r.field_status,
 r.prediction_status,
 COALESCE(CASE WHEN r.circuit='LOCAL' THEN lj.job_status ELSE jj.job_status END,'NO_JOB'),
 ROUND((EXTRACT(EPOCH FROM (r.post_time-clock_timestamp()))/60)::numeric,1),
 COALESCE(h.all_count,0),
 COALESCE(h.active_count,0),
 CASE WHEN r.circuit='LOCAL' THEN COALESCE(h.zero_history_count,0) ELSE NULL END,
 CASE WHEN r.circuit='JRA' THEN (
   SELECT COUNT(*)
   FROM public.jra_live_races lr JOIN public.jra_live_runners lrr ON lrr.live_race_id=lr.id
   WHERE lr.race_date=r.race_date AND lr.track=r.track AND lr.race_no=r.race_no
 ) ELSE NULL END,
 CASE
   WHEN r.prediction_status='FROZEN' THEN 'FROZEN'
   WHEN r.circuit='LOCAL' AND lj.job_status='CLAIMED' AND lj.lease_until>clock_timestamp() THEN 'CLAIMED_LIVE'
   WHEN r.circuit='JRA' AND jj.job_status='CLAIMED' AND jj.lease_until>clock_timestamp() THEN 'CLAIMED_LIVE'
   WHEN r.circuit='LOCAL' AND lj.job_status='CLAIMED' THEN 'CLAIM_EXPIRED'
   WHEN r.circuit='JRA' AND jj.job_status='CLAIMED' THEN 'CLAIM_EXPIRED'
   ELSE 'UNCLAIMED' END,
 CASE
   WHEN r.prediction_status='FROZEN' THEN 'OK_FROZEN'
   WHEN r.post_time <=clock_timestamp() THEN 'MISSED_OR_INELIGIBLE_AFTER_POST'
   WHEN r.field_status NOT IN('READY','BASIC_READY') THEN 'FIELD_NOT_READY'
   WHEN r.circuit='LOCAL' AND COALESCE(h.active_count,0)=0 THEN 'NO_ACTIVE_RUNNERS'
   WHEN r.circuit='LOCAL' AND COALESCE(h.zero_history_count,0)>0 THEN 'LOCAL_HISTORY_NAME_MATCH_GAP_RECHECK_OFFICIAL'
   WHEN r.circuit='JRA' AND NOT EXISTS (
      SELECT 1 FROM public.jra_live_races lr JOIN public.jra_live_runners lrr ON lrr.live_race_id=lr.id
      WHERE lr.race_date=r.race_date AND lr.track=r.track AND lr.race_no=r.race_no
   ) THEN 'JRA_LIVE_RUNNERS_MISSING'
   WHEN r.circuit='LOCAL' AND lj.job_status='DEAD' THEN 'LOCAL_JOB_DEAD'
   WHEN r.circuit='JRA' AND jj.job_status='DEAD' THEN 'JRA_JOB_DEAD'
   ELSE 'READY_FOR_CLAIM_WINDOW_CHECK' END
 FROM public.official_races r
 LEFT JOIN public.lab_prediction_jobs lj
   ON r.circuit='LOCAL' AND (lj.race_date,lj.track,lj.race_no,lj.circuit)=(r.race_date,r.track,r.race_no,r.circuit)
 LEFT JOIN public.jra_prediction_jobs jj
   ON r.circuit='JRA' AND (jj.race_date,jj.track,jj.race_no)=(r.race_date,r.track,r.race_no)
 LEFT JOIN LATERAL (
   SELECT COUNT(*) all_count,
          COUNT(*) FILTER(WHERE coalesce(x.v->>'status','ACTIVE')='ACTIVE') active_count,
          COUNT(*) FILTER(
            WHERE coalesce(x.v->>'status','ACTIVE')='ACTIVE'
              AND r.circuit='LOCAL'
              AND NOT EXISTS (
                SELECT 1 FROM public.horse_runs hr
                WHERE hr.horse_name=x.v->>'horse_name'
                  AND hr.race_date<r.race_date AND hr.finish IS NOT NULL
              )
          ) zero_history_count
   FROM jsonb_array_elements(
     CASE WHEN jsonb_typeof(r.field_payload->'runners')='array' THEN r.field_payload->'runners' ELSE '[]'::jsonb END
   ) x(v)
 ) h ON TRUE
 WHERE r.race_date=p_race_date
 ORDER BY r.post_time,r.track,r.race_no;
$function$


REVOKE ALL ON FUNCTION public.lab_race_readiness_audit_v1(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_race_readiness_audit_v1(date) TO service_role;
