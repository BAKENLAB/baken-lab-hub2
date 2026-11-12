-- BAKEN LAB / official pre-race corner availability vs paired rank outcomes.
-- READ-ONLY audit. Not an ability-score input or a source of future race results.
-- A matching snapshot proves ONLY availability before the sealed draft:
-- it does NOT prove the shadow rank algorithm actually used corner positions.
-- That distinction is tracked separately by corner_rank_counterfactual.
-- Never count an unpaired or unverified official result as a successful trial.
WITH paired AS (
 SELECT circuit,race_date,track,race_no,
  audit_status,baseline_top3_count,shadow_top3_count,
  newly_captured,lost_captured,shadow_changed_top5
 FROM private.lab_rank_shadow_paired_audit_v1
), monitored AS (
 SELECT s.circuit,s.race_date,s.track,s.race_no,
  s.captured_at,s.post_time,s.proposal_model,s.proposal_status,
  s.draft_order,s.proposed_order,
  COALESCE(src.eligible_count,0) matching_preclaim_snapshots,
  p.audit_status,p.baseline_top3_count,p.shadow_top3_count,
  p.newly_captured,p.lost_captured,p.shadow_changed_top5
 FROM private.lab_rank_shadow_preflight_v1 s
 LEFT JOIN paired p USING (circuit,race_date,track,race_no)
 LEFT JOIN LATERAL (
  SELECT count(*) AS eligible_count
  FROM private.lab_preclaim_evidence_snapshots_v1 e
  WHERE e.circuit=s.circuit AND e.race_date=s.race_date
    AND e.track=s.track AND e.race_no=s.race_no
    AND e.source_kind='LOCAL_OFFICIAL_CORNERS'
    AND e.source_status IN ('READY','PARTIAL')
    AND e.official_post_time=s.post_time
    AND e.as_of<=e.captured_at
    AND e.captured_at<=s.captured_at
    AND e.captured_at<e.official_post_time
 ) src ON true
 WHERE s.race_date>=((now() AT TIME ZONE 'Asia/Tokyo')::date-30)
)
SELECT circuit,race_date,track,race_no,proposal_model,proposal_status,
 CASE WHEN circuit='JRA' THEN 'JRA_PRECLAIM_SOURCE_NOT_COVERED_BY_LOCAL_AUDIT'
   WHEN matching_preclaim_snapshots=0 THEN
     'NO_VERIFIED_PRECLAIM_SNAPSHOT_BEFORE_RANK_CAPTURE'
   ELSE 'PRECLAIM_AVAILABLE_USE_NOT_PROVEN'
 END AS preclaim_audit_status,
 matching_preclaim_snapshots,
 COALESCE(audit_status,'NOT_YET_PAIRED') result_pair_status,
 shadow_changed_top5,newly_captured,lost_captured,
 (captured_at<post_time) prepost_capture_confirmed
FROM monitored
ORDER BY race_date DESC,circuit,track,race_no;
