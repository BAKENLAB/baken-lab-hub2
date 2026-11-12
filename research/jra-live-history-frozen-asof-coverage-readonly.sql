-- JRA historic live-runner snapshot as-of FROZEN evidence coverage.
-- READ ONLY. This query does not mutate FROZEN, CLAIM, ranks or SQL schemas.
-- IMPORTANT: source_checked_at is the LAST REPORTED fetch timestamp on an
-- editable live row, not a sealed immutable pre-CLAIM evidence copy.
-- This report does NOT certify the original HTML bytes, historic source URL,
-- full race lap extraction, or that the ranker used any corner/3F data.
-- No result fields enter this source-availability audit.
WITH frozen AS (
 SELECT p.race_date,p.track,p.race_no,p.frozen_at,p.post_time,
  o.field_payload->'runners' AS official_field,
  o.field_payload->'official_status_verification' AS official_proof,
  j.id live_race_id
 FROM public.official_predictions p
 JOIN public.official_races o USING(race_date,track,race_no,circuit)
 JOIN public.jra_live_races j ON j.race_date=p.race_date
  AND j.track=p.track AND j.race_no=p.race_no
 WHERE p.circuit='JRA' AND p.status='FROZEN'
  AND p.race_date IN ('2026-11-07','2026-11-08')
), runner_rows AS (
 SELECT f.race_date,f.track,f.race_no,f.frozen_at,f.post_time,
  jsonb_array_length(f.official_field) official_count,
  (f.official_proof->>'verified')::boolean official_verified,
  (f.official_proof->>'html_sha256') official_digest,
  l.horse_no,l.horse_name,l.source_checked_at,
  EXISTS(SELECT 1 FROM jsonb_array_elements(f.official_field) h
   WHERE (h->>'horse_no')::integer=l.horse_no
    AND h->>'horse_name'=l.horse_name
    AND h->>'horse_ref'=l.horse_ref
    AND h->>'status'='ACTIVE') AS exact_official_identity,
  EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(l.past_runs,'[]'::jsonb)) h
   WHERE jsonb_typeof(h->'corner_positions')='array'
    AND jsonb_array_length(h->'corner_positions')>0) AS has_nonempty_corners,
  EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(l.past_runs,'[]'::jsonb)) h
   WHERE nullif(h->>'source_ref','') IS NOT NULL) AS has_historic_result_url
 FROM frozen f JOIN public.jra_live_runners l ON l.live_race_id=f.live_race_id
), by_race AS (
 SELECT race_date,track,race_no,max(official_count) AS official_count,
  count(*) AS live_runner_count,
  count(*) FILTER(WHERE exact_official_identity) AS exact_identity_count,
  count(*) FILTER(WHERE source_checked_at<=frozen_at) AS last_checked_pre_frozen,
  count(*) FILTER(WHERE source_checked_at>frozen_at) AS last_checked_post_frozen,
  count(*) FILTER(WHERE source_checked_at<=frozen_at
   AND has_nonempty_corners AND has_historic_result_url
   AND exact_official_identity) AS asof_with_corners_and_url,
  bool_and(official_verified IS TRUE AND official_digest ~ '^[a-f0-9]{64}$')
   AS official_field_verified
 FROM runner_rows GROUP BY race_date,track,race_no
)
SELECT *,CASE
 WHEN NOT official_field_verified THEN 'OFFICIAL_ROSTER_UNVERIFIED'
 WHEN live_runner_count<>official_count OR exact_identity_count<>official_count
  THEN 'INCOMPLETE_OR_MISMATCHED_FIELD'
 WHEN last_checked_pre_frozen<>official_count THEN 'LIVE_ROW_NOT_SEALED_BEFORE_FROZEN'
 ELSE 'FULL_FIELD_LAST_CHECKED_BEFORE_FROZEN_NOT_CERTIFIED'
 END AS retrospective_source_status
FROM by_race ORDER BY race_date,track,race_no;