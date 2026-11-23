-- Research-only, SELECT-only inspection of already FROZEN JRA predictions.
-- Does NOT create CLAIMs, alter FROZEN, score horses or certify official source authenticity.
-- Note: full_depth_source_review.ok is a DECLARED check, not genuine issuer proof.
WITH frozen AS (
  SELECT p.race_date, p.track, p.race_no, p.frozen_at,
    p.payload, p.payload->'audit' AS audit
  FROM public.official_predictions p
  WHERE p.circuit='JRA' AND p.status='FROZEN'
    AND p.race_date=DATE '2026-11-23'
), counts AS (
  SELECT f.*,
    CASE WHEN jsonb_typeof(f.payload->'runners')='array'
      THEN jsonb_array_length(f.payload->'runners') ELSE 0 END AS field_count,
    CASE WHEN jsonb_typeof(f.audit->'runner_history_checked')='array'
      THEN jsonb_array_length(f.audit->'runner_history_checked') ELSE 0 END AS review_count,
    CASE WHEN jsonb_typeof(f.payload->'top5')='array'
      THEN jsonb_array_length(f.payload->'top5') ELSE 0 END AS top5_count
  FROM frozen f
)
SELECT race_date, track, race_no, frozen_at, field_count, review_count,
  field_count > 0 AND review_count=field_count AS per_runner_review_count_matches,
  top5_count=5 AS top5_shape_reported,
  (COALESCE(NULLIF(trim(audit->>'score_method'),''),'') <> '') AS score_method_declared,
  (audit->'full_depth_comparison')='true'::jsonb AS former_depth_claim_present,
  (audit->'full_depth_source_review'->>'ok')='true' AS new_depth_claim_present,
  (audit ? 'official_archive_pace_detail_matches') AS archive_lap_detail_field_present,
  (audit ? 'eye_review') AS eye_review_field_present,
  (audit->'evidence_rank_bridge'->>'status') AS eval_bridge_status,
  (payload->'eye') IS NOT NULL AND (payload->'eye') <> 'null'::jsonb AS eye_selected,
  CASE WHEN COALESCE(NULLIF(trim(audit->>'score_method'),''),'')=''
    THEN 'SCORE_METHOD_MISSING'
    WHEN field_count=0 OR review_count<>field_count
    THEN 'RUNNER_HISTORY_AUDIT_COUNT_MISMATCH'
    WHEN (audit->'full_depth_comparison') IS DISTINCT FROM 'true'::jsonb
    THEN 'LEGACY_DEPTH_CLAIM_MISSING'
    ELSE 'DECLARED_AUDIT_PRESENT_NOT_AUTHENTICITY_PROOF'
  END AS declared_quality_gate
FROM counts ORDER BY frozen_at, track, race_no;
