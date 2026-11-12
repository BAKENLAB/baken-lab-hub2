-- LOCAL official corner pre-CLAIM operational readiness (READ ONLY).
-- Never invokes CLAIM, official fetches, save, Cron, or any write operation.
-- Run at any time; zero race rows return a visible NO_OFFICIAL_RACES_YET.
-- Eligibility is a diagnostic, NOT an authorization grant. The live official
-- card, horse identity, independent pre-race clock, and service user gate must
-- still be checked by lab_preclaim_official_corners at invocation time.
WITH clock AS (
 SELECT clock_timestamp() AS now_utc,
  (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date AS jst_day
), eligible AS (
 SELECT r.race_date,r.track,r.race_no,r.race_name,r.post_time,r.field_status,
  r.prediction_status,
  CASE WHEN jsonb_typeof(r.field_payload->'runners')='array'
   THEN jsonb_array_length(r.field_payload->'runners') ELSE 0 END roster_size,
  (SELECT count(*)::integer
   FROM private.lab_preclaim_evidence_snapshots_v1 s
   WHERE s.circuit='LOCAL' AND s.race_date=r.race_date
    AND s.track=r.track AND s.race_no=r.race_no
    AND s.source_kind='LOCAL_OFFICIAL_CORNERS'
    AND s.source_status IN ('PARTIAL','READY')
    AND s.captured_at < s.official_post_time
    AND s.as_of <= s.captured_at
    AND s.official_post_time=r.post_time
  ) AS prior_snapshots
 FROM public.official_races r CROSS JOIN clock
 WHERE r.circuit='LOCAL' AND r.race_date=clock.jst_day
), report AS (
 SELECT 'RACE'::text AS kind,race_date,track,race_no,race_name,
  post_time AT TIME ZONE 'Asia/Tokyo' AS post_time_jst,
  field_status,prediction_status,roster_size,prior_snapshots,
  CASE
   WHEN prediction_status='FROZEN' THEN 'FROZEN_NO_ACTION'
   WHEN post_time<=(SELECT now_utc FROM clock) THEN 'PAST_POST_FORBIDDEN'
   WHEN prediction_status NOT IN ('PENDING','RETRY') THEN 'PREDICTION_STATUS_NOT_ELIGIBLE'
   WHEN field_status IS DISTINCT FROM 'READY' THEN 'OFFICIAL_ROSTER_NOT_READY'
   WHEN roster_size=0 THEN 'OFFICIAL_ROSTER_EMPTY'
   WHEN race_name ~ '新馬|初出走|メイクデビュー' THEN 'EXCLUDED_DEBUT_NO_PAST_RESULTS'
   WHEN prior_snapshots>0 THEN 'PRECLAIM_SNAPSHOT_ALREADY_PRESENT'
   WHEN post_time<=(SELECT now_utc FROM clock)+INTERVAL '10 minutes' THEN 'DEADLINE_TOO_CLOSE'
   ELSE 'POSSIBLE_EXPLICIT_PRECLAIM_CANDIDATE'
  END AS diagnostic_state
 FROM eligible
)
SELECT kind,race_date,track,race_no,race_name,post_time_jst,field_status,
 prediction_status,roster_size,prior_snapshots,diagnostic_state
FROM report
UNION ALL
SELECT 'DAY_EMPTY',(SELECT jst_day FROM clock),NULL::text,NULL::integer,
 NULL::text,
 NULL::timestamp,NULL::text,NULL::text,0,0,'NO_OFFICIAL_RACES_YET'
WHERE NOT EXISTS (SELECT 1 FROM report)
ORDER BY kind,post_time_jst NULLS FIRST,track,race_no;
