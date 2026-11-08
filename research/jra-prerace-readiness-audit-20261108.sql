-- BAKEN LAB / 2026-11-08 JRA PRE-CLAIM READINESS AUDIT
-- Read-only. NEVER creates official rows, runs a publisher, starts CLAIM or saves.
-- Important: jra_live_races is merely a candidate source. Its runner counts do
-- not constitute JRA_OFFICIAL_VERIFIED_GATE_V1 or BASIC_READY.
WITH live AS(
 SELECT r.race_date,r.track,r.race_no,r.race_type,r.surface,
   r.post_time,r.field_size,r.source_checked_at,
   (substring(r.post_time from '([0-9]{1,2})時')::integer*60
     +substring(r.post_time from '([0-9]{2})分')::integer) AS post_minute,
   count(hr.horse_no)::integer AS live_runners,
   count(distinct hr.horse_no)::integer AS unique_horse_nos,
   count(*) filter (where hr.horse_no IS NULL OR
     coalesce(hr.horse_name,'')='' OR coalesce(hr.horse_ref,'')='')::integer
      AS missing_identity
 FROM public.jra_live_races r
 LEFT JOIN public.jra_live_runners hr ON hr.live_race_id=r.id
 WHERE r.race_date=(now() at time zone 'Asia/Tokyo')::date
 GROUP BY r.id
),
rows AS(
 SELECT l.*,o.field_status,o.source AS official_source,
    o.prediction_status,
    o.field_payload#>>'{official_status_verification,html_sha256}' AS official_digest,
    j.job_status,
    (p.race_date IS NOT NULL) AS already_saved,
    CASE
      WHEN p.race_date IS NOT NULL THEN 'FROZEN_ALREADY'
      WHEN l.race_type='障害' OR l.surface NOT IN ('芝','ダート')
        THEN 'EXCLUDED_NOT_FLAT'
      WHEN o.field_status IN ('READY','BASIC_READY') AND
        o.source='JRA_OFFICIAL_VERIFIED_GATE_V1' AND
        o.field_payload#>>'{official_status_verification,html_sha256}' ~ '^[a-f0-9]{64}$'
        THEN 'OFFICIALLY_VERIFIED_READY'
      WHEN o.field_status IN ('READY','BASIC_READY')
        THEN 'UNVERIFIED_READY_LABEL'
      WHEN l.live_runners<>l.field_size OR
           l.unique_horse_nos<>l.live_runners OR l.missing_identity>0
        THEN 'CANDIDATE_FIELD_CONFLICT'
      ELSE 'FRESH_OFFICIAL_CARD_REQUIRED'
    END AS official_preflight
 FROM live l
 LEFT JOIN public.official_races o
  ON (o.race_date,o.track,o.race_no,o.circuit)=(l.race_date,l.track,l.race_no,'JRA')
 LEFT JOIN public.jra_prediction_jobs j
  ON (j.race_date,j.track,j.race_no)=(l.race_date,l.track,l.race_no)
 LEFT JOIN public.official_predictions p
  ON (p.race_date,p.track,p.race_no)=(l.race_date,l.track,l.race_no)
)
SELECT race_date,track,race_no,post_time,race_type,live_runners,field_size,
       unique_horse_nos,missing_identity,field_status,official_source,
       official_preflight,job_status,already_saved
FROM rows ORDER BY post_minute,track,race_no;
