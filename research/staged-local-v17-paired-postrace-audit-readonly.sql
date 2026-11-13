-- READ ONLY / STAGED. Requires optional pre-FROZEN LOCAL1.7 table
-- from staged-local-v17-independent-shadow-storage-v1.sql.
-- Actual results are joined ONLY AFTER post_time; never part of pre-race scoring.
-- A valid paired row must match the exact original immutable source seal,
-- the unchanged official FROZEN draft and three distinct official finishers.
WITH originals AS (
 SELECT v.*,p.draft_order,p.field_athletes AS official_field,
        p.capture_sha256 AS parent_digest
 FROM private.lab_v17_independent_preflight_v1 v
 LEFT JOIN private.lab_rank_shadow_preflight_v1 p
  ON (p.circuit,p.race_date,p.track,p.race_no)=
     (v.circuit,v.race_date,v.track,v.race_no)
    AND p.job_id=v.job_id AND p.capture_sha256=v.original_capture_sha256
), joined AS (
 SELECT v.*,f.status AS official_prediction_status,f.frozen_at,
  saved.saved_order,
  res.settled_at AS official_result_settled_at,
  res.source AS official_result_source,
  podium.top3 AS official_top3,
  podium.finish_n AS top3_finish_positions,
  podium.horse_n AS top3_distinct_horses
 FROM originals v
 LEFT JOIN public.official_predictions f
   ON (f.circuit,f.race_date,f.track,f.race_no)=
     (v.circuit,v.race_date,v.track,v.race_no)
 LEFT JOIN LATERAL (
   SELECT jsonb_agg((h->>'horse_no')::integer
     ORDER BY (h->>'rank')::integer) AS saved_order
   FROM jsonb_array_elements(
     CASE WHEN jsonb_typeof(f.payload->'runners')='array'
       THEN f.payload->'runners' ELSE '[]'::jsonb END) h
   WHERE h->>'status'='ACTIVE'
     AND (h->>'horse_no') ~ '^[0-9]{1,2}$'
     AND (h->>'rank') ~ '^[0-9]{1,2}$'
 ) saved ON true
 LEFT JOIN public.official_results res
  ON (res.circuit,res.race_date,res.track,res.race_no)=
     (v.circuit,v.race_date,v.track,v.race_no)
 LEFT JOIN LATERAL (
   SELECT jsonb_agg((h->>'horse_no')::integer
     ORDER BY (h->>'finish')::integer) AS top3,
     count(DISTINCT (h->>'finish')::integer) AS finish_n,
     count(DISTINCT (h->>'horse_no')::integer) AS horse_n
   FROM jsonb_array_elements(
     CASE WHEN jsonb_typeof(res.result->'finishers')='array'
       THEN res.result->'finishers' ELSE '[]'::jsonb END) h
   WHERE (h->>'finish') ~ '^[123]$'
     AND (h->>'horse_no') ~ '^[0-9]{1,2}$'
 ) podium ON true
), strict AS (
 SELECT j.*,CASE
  WHEN j.parent_digest IS NULL OR j.captured_at>=j.post_time
    OR j.parent_digest IS DISTINCT FROM j.original_capture_sha256
       THEN 'INVALID_PARENT_OR_CLOCK'
  WHEN j.official_prediction_status IS DISTINCT FROM 'FROZEN'
    OR j.frozen_at<j.captured_at OR j.frozen_at>=j.post_time
    OR j.saved_order IS DISTINCT FROM j.draft_order
       THEN 'NOT_MATCHED_TO_ORIGINAL_FROZEN'
  WHEN j.status='ABSTAINED' THEN 'RESEARCH_ABSTAINED'
  WHEN j.official_result_settled_at IS NULL
    OR j.official_result_settled_at<j.post_time
    OR j.top3_finish_positions<>3 OR j.top3_distinct_horses<>3
    -- Three distinct positions/horses are insufficient if the official
    -- JSON has duplicate rows or an outsider absent from the sealed field.
    OR jsonb_array_length(j.official_top3)<>3
    OR EXISTS(
      SELECT 1 FROM jsonb_array_elements(j.official_top3) x
      WHERE NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(j.draft_order) b
        WHERE b.value=x.value))
       THEN 'WAITING_VERIFIED_PODIUM'
  ELSE 'PAIRED' END AS audit_status
 FROM joined j
)
SELECT circuit,race_date,track,race_no,model,status AS research_status,
 audit_status,captured_at,frozen_at,post_time,
 abstention_reason,baseline_top5,shadow_top5,official_top3,
 CASE WHEN audit_status='PAIRED' THEN (
   SELECT count(*) FROM jsonb_array_elements(official_top3) p
   WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(baseline_top5) b
                  WHERE b.value=p.value)
 ) END AS baseline_top3_captured,
 CASE WHEN audit_status='PAIRED' THEN (
   SELECT count(*) FROM jsonb_array_elements(official_top3) p
   WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(shadow_top5) b
                  WHERE b.value=p.value)
 ) END AS shadow_top3_captured,
 CASE WHEN audit_status='PAIRED' THEN (
   SELECT count(*) FROM jsonb_array_elements(official_top3) p
   WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(shadow_top5) n
                  WHERE n.value=p.value)
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(baseline_top5) b
                  WHERE b.value=p.value)
 ) END AS newly_captured,
 CASE WHEN audit_status='PAIRED' THEN (
   SELECT count(*) FROM jsonb_array_elements(official_top3) p
   WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(baseline_top5) b
                  WHERE b.value=p.value)
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(shadow_top5) n
                  WHERE n.value=p.value)
 ) END AS lost_captured,
 CASE WHEN audit_status='PAIRED' THEN
   EXISTS(SELECT 1 FROM jsonb_array_elements(baseline_top5) b
     WHERE b.value=official_top3->0) END AS winner_in_baseline_top5,
 CASE WHEN audit_status='PAIRED' THEN
   EXISTS(SELECT 1 FROM jsonb_array_elements(shadow_top5) b
     WHERE b.value=official_top3->0) END AS winner_in_shadow_top5
FROM strict ORDER BY race_date,track,race_no;
