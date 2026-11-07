-- Pre-claim readiness monitor. SELECT only: NO CLAIM, SAVE, UPDATE, Cron, or gateway bypass.
-- This is a diagnostic priority list, NOT authorization to make a prediction.
-- Run BEFORE races start to identify missing official roster and unprepared jobs.
WITH clock AS (SELECT clock_timestamp() AS now_utc,
 (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date AS jst_date),
 races AS (
 SELECT o.race_date,o.circuit,o.track,o.race_no,o.post_time,
 o.field_status,o.prediction_status,
 COALESCE(o.field_payload->'data_quality'->>'field_complete','false') AS field_complete,
 CASE WHEN o.circuit='JRA' THEN j.job_status ELSE l.job_status END AS job_status,
 CASE WHEN o.circuit='JRA' THEN j.last_error ELSE l.last_error END AS last_error,
 CASE WHEN o.circuit='JRA' THEN j.lease_until ELSE l.lease_until END AS lease_until
 FROM public.official_races o
 LEFT JOIN public.jra_prediction_jobs j
   ON o.circuit='JRA' AND (j.race_date,j.track,j.race_no)=(o.race_date,o.track,o.race_no)
 LEFT JOIN public.lab_prediction_jobs l
   ON o.circuit='LOCAL' AND (l.race_date,l.track,l.race_no)=(o.race_date,o.track,o.race_no)
 WHERE o.race_date=(SELECT jst_date FROM clock)
)
SELECT race_date,circuit,track,race_no,
 post_time AT TIME ZONE 'Asia/Tokyo' AS post_time_jst,
 field_status,field_complete,prediction_status,
 job_status,lease_until,last_error,
 CASE
  WHEN prediction_status='FROZEN' THEN 'FROZEN_NO_ACTION'
  WHEN post_time<=(SELECT now_utc FROM clock) THEN 'PAST_POST_NO_SAVE'
  WHEN field_complete<>'true' OR field_status NOT IN ('READY','VERIFIED') THEN 'CORE_ROSTER_VERIFY'
  WHEN job_status='CLAIMED' THEN 'CLAIM_LEASE_CHECK_ONLY'
  WHEN job_status IS NULL THEN 'NO_JOB_CHECK_SCHEDULER'
  WHEN job_status='DEAD' THEN 'DEAD_NO_RESEND'
  WHEN post_time<=(SELECT now_utc FROM clock)+INTERVAL '10 minutes' THEN 'CLAIM_WINDOW_URGENT'
  WHEN post_time<=(SELECT now_utc FROM clock)+INTERVAL '90 minutes' THEN 'PREFETCH_OPTIONAL_EVIDENCE'
  ELSE 'SCHEDULE_PREFETCH'
 END AS diagnostic_only_state
FROM races ORDER BY post_time,circuit,track,race_no;
