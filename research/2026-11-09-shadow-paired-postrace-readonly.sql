-- BAKEN LAB: read-only prospective rank-pair audit. No postrace re-ranking.
-- Only source-sealed captures that EXACTLY match the subsequently saved
-- official FROZEN roster/rank are eligible for model performance metrics.
CREATE OR REPLACE VIEW private.lab_rank_shadow_paired_audit_v1
WITH (security_invoker = true) AS
WITH captures AS (
 SELECT s.*,
   encode(extensions.digest(convert_to(jsonb_build_object(
     'circuit',s.circuit,'race_date',s.race_date,'track',s.track,'race_no',s.race_no,
     'job_id',s.job_id,'field',s.field_athletes,'draft',s.draft_order,
     'proposed',s.proposed_order,'protocol',s.protocol_version,
     'model',s.proposal_model)::text,'UTF8'),'sha256'),'hex')=s.capture_sha256
     AS hash_verified
 FROM private.lab_rank_shadow_preflight_v1 s
), linked AS (
 SELECT s.*,
   p.id prediction_id,p.status prediction_status,
   p.protocol_version official_protocol,
   p.frozen_at official_frozen_at,
   p.post_time official_post_time,
   (SELECT jsonb_agg((h->>'horse_no')::int ORDER BY (h->>'rank')::int)
    FROM jsonb_array_elements(COALESCE(p.payload->'runners','[]'::jsonb)) h
    WHERE h->>'status'='ACTIVE' AND h->>'rank' ~ '^[0-9]{1,2}$'
      AND h->>'horse_no' ~ '^[0-9]{1,2}$') official_frozen_order,
   (SELECT jsonb_agg(jsonb_build_object('horse_no',h->'horse_no',
      'horse_name',h->>'horse_name') ORDER BY (h->>'horse_no')::int)
    FROM jsonb_array_elements(COALESCE(p.payload->'runners','[]'::jsonb)) h
    WHERE h->>'status'='ACTIVE' AND h->>'horse_no' ~ '^[0-9]{1,2}$')
      official_frozen_field,
   (SELECT jsonb_agg((h->>'horse_no')::int ORDER BY (h->>'finish')::int)
    FROM jsonb_array_elements(COALESCE(r.result->'finishers','[]'::jsonb)) h
    WHERE h->>'finish' ~ '^[123]$' AND h->>'horse_no' ~ '^[0-9]{1,2}$')
      official_podium
 FROM captures s
 LEFT JOIN public.official_predictions p ON (p.race_date,p.track,p.race_no,p.circuit)
   =(s.race_date,s.track,s.race_no,s.circuit)
 LEFT JOIN public.official_results r ON (r.race_date,r.track,r.race_no,r.circuit)
   =(s.race_date,s.track,s.race_no,s.circuit)
), classified AS (
 SELECT l.*,
  CASE
   WHEN NOT hash_verified THEN 'CAPTURE_HASH_INVALID'
   WHEN prediction_id IS NULL OR prediction_status<>'FROZEN' THEN 'WAITING_FROZEN'
   WHEN official_protocol IS DISTINCT FROM protocol_version THEN 'PROTOCOL_MISMATCH'
   WHEN official_frozen_at IS NULL OR official_frozen_at<captured_at
       OR official_frozen_at>=post_time-interval '3 minutes' THEN 'INVALID_FREEZE_TIMING'
   WHEN official_frozen_order IS DISTINCT FROM draft_order OR
        official_frozen_field IS DISTINCT FROM field_athletes THEN 'DRAFT_NOT_OFFICIAL_FROZEN'
   WHEN jsonb_typeof(official_podium)<>'array' OR
        jsonb_array_length(official_podium)<>3 OR
        (SELECT count(DISTINCT h.value) FROM jsonb_array_elements(official_podium) h)<>3 OR
        EXISTS (SELECT 1 FROM jsonb_array_elements(official_podium) h
                WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(draft_order) d
                  WHERE d.value=h.value)) THEN 'WAITING_VERIFIED_PODIUM'
   ELSE 'PAIRED'
  END audit_status
 FROM linked l
)
SELECT circuit,race_date,track,race_no,captured_at,official_frozen_at,post_time,
 protocol_version,proposal_model,proposal_status,capture_sha256,
 audit_status,draft_order,proposed_order,
 (SELECT jsonb_agg(x.value ORDER BY x.ord)
  FROM jsonb_array_elements(draft_order) WITH ORDINALITY x(value,ord) WHERE ord<=5) baseline_top5,
 (SELECT jsonb_agg(x.value ORDER BY x.ord)
  FROM jsonb_array_elements(proposed_order) WITH ORDINALITY x(value,ord) WHERE ord<=5) shadow_top5,
 CASE WHEN audit_status='PAIRED' THEN official_podium END official_podium,
 CASE WHEN audit_status='PAIRED' THEN
   (SELECT count(*) FROM jsonb_array_elements(official_podium) h
    WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(draft_order) WITH ORDINALITY d(value,ord)
      WHERE d.ord<=5 AND d.value=h.value)) END baseline_top3_count,
 CASE WHEN audit_status='PAIRED' THEN
   (SELECT count(*) FROM jsonb_array_elements(official_podium) h
    WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(proposed_order) WITH ORDINALITY d(value,ord)
      WHERE d.ord<=5 AND d.value=h.value)) END shadow_top3_count,
 CASE WHEN audit_status='PAIRED' THEN
   (SELECT count(*) FROM jsonb_array_elements(official_podium) h
    WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(draft_order) WITH ORDINALITY d(value,ord)
      WHERE d.ord<=5 AND d.value=h.value)
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(proposed_order) WITH ORDINALITY d(value,ord)
      WHERE d.ord<=5 AND d.value=h.value)) END newly_captured,
 CASE WHEN audit_status='PAIRED' THEN
   (SELECT count(*) FROM jsonb_array_elements(official_podium) h
    WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(draft_order) WITH ORDINALITY d(value,ord)
      WHERE d.ord<=5 AND d.value=h.value)
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(proposed_order) WITH ORDINALITY d(value,ord)
      WHERE d.ord<=5 AND d.value=h.value)) END lost_captured,
 CASE WHEN audit_status='PAIRED' THEN
   EXISTS (SELECT 1 FROM jsonb_array_elements(draft_order) WITH ORDINALITY d(value,ord)
      WHERE d.ord<=5 AND d.value=official_podium->0) END winner_in_baseline,
 CASE WHEN audit_status='PAIRED' THEN
   EXISTS (SELECT 1 FROM jsonb_array_elements(proposed_order) WITH ORDINALITY d(value,ord)
      WHERE d.ord<=5 AND d.value=official_podium->0) END winner_in_shadow
FROM classified;

REVOKE ALL ON private.lab_rank_shadow_paired_audit_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.lab_rank_shadow_paired_audit_v1 TO service_role;

CREATE OR REPLACE VIEW private.lab_rank_shadow_paired_summary_v1
WITH (security_invoker = true) AS
SELECT circuit,
 count(*) captured_races,
 count(*) FILTER(WHERE audit_status='PAIRED') valid_paired_races,
 count(*) FILTER(WHERE audit_status='DRAFT_NOT_OFFICIAL_FROZEN') changed_draft_excluded,
 count(*) FILTER(WHERE audit_status='WAITING_FROZEN') no_frozen_yet,
 count(*) FILTER(WHERE audit_status='WAITING_VERIFIED_PODIUM') waiting_result,
 sum(baseline_top3_count) FILTER(WHERE audit_status='PAIRED') baseline_podium_horses,
 sum(shadow_top3_count) FILTER(WHERE audit_status='PAIRED') proposed_podium_horses,
 sum(newly_captured) FILTER(WHERE audit_status='PAIRED') added_podium_horses,
 sum(lost_captured) FILTER(WHERE audit_status='PAIRED') lost_podium_horses,
 count(*) FILTER(WHERE audit_status='PAIRED' AND winner_in_baseline) baseline_winners_in_top5,
 count(*) FILTER(WHERE audit_status='PAIRED' AND winner_in_shadow) proposed_winners_in_top5
FROM private.lab_rank_shadow_paired_audit_v1
GROUP BY circuit;

REVOKE ALL ON private.lab_rank_shadow_paired_summary_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.lab_rank_shadow_paired_summary_v1 TO service_role;
