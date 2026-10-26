-- Classify 2 recorded coverage-only races explicitly in all-slate audit.
-- This is a read-only monitor update and does not change prediction status.
CREATE OR REPLACE FUNCTION private.jra_card_coverage_audit_v1(p_date date)
 RETURNS TABLE(race_date date, track text, race_no integer, scheduled_at timestamp with time zone, race_name text, race_type text, field_status text, prediction_status text, job_status text, official_proof_verified boolean, state text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
WITH all_races AS (
  SELECT l.race_date, l.track, l.race_no::integer race_no,
    (l.race_date::timestamp
     + make_interval(hours => split_part(l.post_time,'時',1)::integer,
                     mins => split_part(split_part(l.post_time,'時',2),'分',1)::integer))
       AT TIME ZONE 'Asia/Tokyo' AS scheduled_at,
    l.race_name, l.race_type
  FROM public.jra_live_races l
  WHERE l.race_date=p_date
),
cards AS (
  SELECT a.*,
    o.field_status AS field_status,
    o.prediction_status AS prediction_status,
    o.source AS official_source,
    coalesce((o.field_payload #>> '{official_status_verification,verified}')::boolean,false)
      AS official_proof_verified,
    j.job_status AS job_status,
    (p.race_date IS NOT NULL) AS is_saved
  FROM all_races a
  LEFT JOIN public.official_races o
    ON (o.race_date,o.track,o.race_no,o.circuit)
       =(a.race_date,a.track,a.race_no,'JRA')
  LEFT JOIN public.jra_prediction_jobs j
    ON (j.race_date,j.track,j.race_no)
       =(a.race_date,a.track,a.race_no)
  LEFT JOIN public.official_predictions p
    ON (p.race_date,p.track,p.race_no,p.circuit)
       =(a.race_date,a.track,a.race_no,'JRA')
)
SELECT c.race_date, c.track, c.race_no, c.scheduled_at,
  c.race_name,c.race_type,c.field_status,c.prediction_status,c.job_status,
  c.official_proof_verified,
  CASE
    WHEN c.official_source='JRA_OFFICIAL_COVERAGE_ONLY_V1'
      AND c.field_status='PENDING' AND c.prediction_status='SKIPPED'
      THEN CASE WHEN c.race_type='障害' THEN 'COVERAGE_ONLY_OBSTACLE'
                ELSE 'COVERAGE_ONLY_NEWCOMER_SCRATCH' END
    WHEN c.race_type='障害' THEN 'EXCLUDED_OBSTACLE'
    WHEN c.is_saved THEN 'FROZEN_SAVED'
    WHEN c.job_status='DONE' THEN 'INCONSISTENT_DONE_NOT_FROZEN'
    WHEN c.field_status IS NULL OR c.field_status NOT IN ('BASIC_READY','READY')
      THEN CASE WHEN c.scheduled_at<=clock_timestamp()
        THEN 'DEADLINE_PASSED_OFFICIAL_NOT_READY'
        ELSE 'OFFICIAL_NOT_READY' END
    WHEN c.official_source='JRA_OFFICIAL_VERIFIED_GATE_V1'
      AND NOT c.official_proof_verified THEN 'VERIFIED_GATE_PROOF_MISSING'
    WHEN c.job_status='CLAIMED' THEN 'CLAIMED_NOT_SAVED'
    WHEN c.job_status IN ('DEAD','ERROR') THEN 'JOB_FAILED'
    WHEN c.scheduled_at<=clock_timestamp() THEN
      CASE WHEN c.job_status='QUEUED' THEN 'QUEUE_NOT_RUN_AFTER_DEADLINE'
           ELSE 'DEADLINE_PASSED_UNSAVED' END
    WHEN c.job_status IN ('QUEUED','RETRY') THEN 'READY_QUEUED'
    ELSE 'READY_AWAITING_CLAIM_WINDOW'
  END AS state
FROM cards c
ORDER BY c.scheduled_at,c.track,c.race_no;
$function$
