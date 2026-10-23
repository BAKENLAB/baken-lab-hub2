-- JRA research: exact LIVE five flags for locked 2025 learner.
-- READ-ONLY, no official scores/FROZEN/Cron changes.
-- Signals mirror private.jra_research_asof_features_v1:
-- most recent 4 as-of races and older ordinal 5–8 exactly.
CREATE OR REPLACE FUNCTION private.jra_live_locked_2025_feature_packet_v1(
 p_date date,p_track text,p_race_no integer
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,private
AS $fn$
WITH race AS (
 SELECT r.*,private.jra_class_level(r.class_name) target_level
 FROM public.jra_live_races r
 WHERE r.race_date=p_date AND r.track=p_track AND r.race_no=p_race_no
  AND coalesce(r.race_type,'') <> '障害'
 LIMIT 1
), detailed AS (
 SELECT private.jra_optional_content_evidence_v3(
  p_date,p_track,p_race_no
 ) AS data
 WHERE EXISTS(SELECT 1 FROM race)
), raw AS (
 SELECT rr.race_date,rr.track,rr.race_no,rr.post_time,rr.field_size,
  rr.source_checked_at AS race_source_checked_at,
  rr.surface,rr.distance,rr.target_level,
  lr.horse_no::integer AS horse_no,lr.horse_name,
  lr.horse_ref,lr.source_checked_at AS runner_source_checked_at,
  b.segment,b.base_rate,b.base_rank,
  b.recent_n4,b.recent_top3_count4,b.recent_avg_margin4,
  h.n8,h.basic_4_of_8,
  h.close46,h.near_podium,h.same_class_close,
  h.older_course_podium,h.fast_close_source_candidate,
  d.evidence
 FROM race rr
 JOIN public.jra_live_runners lr ON lr.live_race_id=rr.id
 LEFT JOIN LATERAL public.jra_live_base_candidate_v1(
   p_date,p_track,p_race_no
 ) b ON b.live_runner_id=lr.id
 LEFT JOIN LATERAL (
 SELECT COUNT(*)::integer n8,
  COUNT(*) FILTER(WHERE x.rn<=4)::integer basic_4_of_8,
  COALESCE(BOOL_OR(x.rn<=4
    AND x.prior_date<p_date
    AND x.prior_surface=rr.surface
    AND abs(x.prior_distance-rr.distance)<=200
    AND x.finish BETWEEN 4 AND 6
    AND x.margin_to_winner BETWEEN 0 AND 0.5),false) AS close46,
  COALESCE(BOOL_OR(x.rn<=4
    AND x.prior_date<p_date
    AND x.prior_surface=rr.surface
    AND abs(x.prior_distance-rr.distance)<=200
    AND x.finish BETWEEN 1 AND 3),false) AS near_podium,
  COALESCE(BOOL_OR(x.rn<=4
    AND x.prior_date<p_date
    AND private.jra_class_level(x.prior_class)=rr.target_level
    AND x.margin_to_winner BETWEEN 0 AND 1.0),false) AS same_class_close,
  COALESCE(BOOL_OR(x.rn BETWEEN 5 AND 8
    AND x.prior_date<p_date
    AND x.prior_track=rr.track
    AND x.prior_surface=rr.surface
    AND abs(x.prior_distance-rr.distance)<=400
    AND x.finish BETWEEN 1 AND 3),false) AS older_course_podium,
  COALESCE(BOOL_OR(x.rn<=4
    AND x.prior_date<p_date
    AND x.prior_surface=rr.surface
    AND abs(x.prior_distance-rr.distance)<=200
    AND x.finish BETWEEN 4 AND 10
    AND x.margin_to_winner BETWEEN 0 AND 0.5),false) AS fast_close_source_candidate
 FROM private.jra_merged_flat_history_v2(
  lr.horse_name,lr.horse_ref,p_date,lr.past_runs,8
 ) x
 ) h ON TRUE
 LEFT JOIN LATERAL (
  SELECT e.value AS evidence
  FROM detailed d CROSS JOIN LATERAL jsonb_array_elements(d.data) e
  WHERE e.value->>'horse_no'=lr.horse_no::text
   AND e.value->>'horse_name'=lr.horse_name
  LIMIT 1
 ) d ON TRUE
), flags AS (
 SELECT r.*,
  EXISTS(
    SELECT 1 FROM jsonb_array_elements(
     coalesce(r.evidence->'history','[]'::jsonb)
    ) j
    WHERE j->>'prior_surface'=r.surface
      AND (j->>'prior_date')::date<r.race_date
      AND abs((j->>'prior_distance')::integer-r.distance)<=200
      AND (j->>'finish')::integer BETWEEN 4 AND 10
      AND (j->>'margin_to_winner')::numeric BETWEEN 0 AND 0.5
      AND (j->>'final3f_rank')::integer BETWEEN 1 AND 3
  ) fast_close,
  (r.fast_close_source_candidate AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(
      coalesce(r.evidence->'history','[]'::jsonb)
    ) j
    WHERE j->>'prior_surface'=r.surface
      AND (j->>'prior_date')::date<r.race_date
      AND abs((j->>'prior_distance')::integer-r.distance)<=200
      AND (j->>'finish')::integer BETWEEN 4 AND 10
      AND (j->>'margin_to_winner')::numeric BETWEEN 0 AND 0.5
      AND j->>'final3f_rank' IS NOT NULL
  )) AS fast3f_history_unknown,
  (r.race_source_checked_at AT TIME ZONE 'Asia/Tokyo' <=
    (r.race_date::timestamp+r.post_time::time)) AS race_snapshot_before_post,
  (r.runner_source_checked_at AT TIME ZONE 'Asia/Tokyo' <=
    (r.race_date::timestamp+r.post_time::time)) AS runner_snapshot_before_post
 FROM raw r
), results AS (
 SELECT f.*,
  GREATEST(0.01,LEAST(0.95,f.base_rate))::numeric AS score_proxy
 FROM flags f
), summary AS (
 SELECT COUNT(*)::integer n,
  COUNT(DISTINCT horse_no)::integer unique_horses,
  MAX(field_size)::integer expected,
  COUNT(*) FILTER(WHERE base_rate IS NULL OR base_rank IS NULL)::integer no_baseline,
  COUNT(*) FILTER(WHERE horse_ref IS NULL
    OR private.jra_horse_key(horse_ref) IS NULL)::integer unverified_identity,
  COUNT(*) FILTER(WHERE race_snapshot_before_post IS NOT TRUE
    OR runner_snapshot_before_post IS NOT TRUE)::integer unverified_snapshot,
  COUNT(*) FILTER(WHERE fast3f_history_unknown)::integer missing_fast3f_rank
 FROM results
)
SELECT jsonb_build_object(
 'status',CASE
  WHEN NOT EXISTS(SELECT 1 FROM race) THEN 'NO_RACE'
  WHEN (SELECT n FROM summary)<>(SELECT expected FROM summary)
    OR (SELECT n FROM summary)<>(SELECT unique_horses FROM summary)
    THEN 'PARTIAL_OR_DUPLICATE_ROSTER'
  WHEN (SELECT unverified_identity FROM summary)>0 THEN 'IDENTITY_UNVERIFIED'
  WHEN (SELECT unverified_snapshot FROM summary)>0 THEN 'NOT_PROVABLY_PRESTART_SNAPSHOT'
  WHEN (SELECT no_baseline FROM summary)>0 THEN 'BASE_CORE_UNAVAILABLE_FOR_ALL'
  ELSE 'READY_FOR_RESEARCH_SHADOW' END,
 'race_date',p_date,'track',p_track,'race_no',p_race_no,
 'expected',(SELECT expected FROM summary),
 'count',(SELECT n FROM summary),
 'missing_fast3f_rank',(SELECT missing_fast3f_rank FROM summary),
 'source_cutoff','before target race post_time JST',
 'older_history_policy','ordinal races 5 through 8; do not use approximate older-any flag',
 'saved_predictions_changed',false,'source','LIVE_AND_HISTORICAL_ASOF',
 'runners',COALESCE((
 SELECT jsonb_agg(jsonb_build_object(
  'race_date',f.race_date,'track',f.track,'race_no',f.race_no,
  'horse_no',f.horse_no,'horse_name',f.horse_name,
  'segment',f.segment,'base_rate',f.base_rate,
  'base_rank',f.base_rank,'n4',f.recent_n4,'n8',f.n8,
  'near_close46',f.close46,
  'recent_near_top3',f.near_podium,
  'recent_sameclass_close',f.same_class_close,
  'old_same_track_top3',f.older_course_podium,
  'recent_3f_close',f.fast_close,
  'fast3f_history_unknown',f.fast3f_history_unknown,
  'mean_gap4',f.recent_avg_margin4,
  'snapshot_before_post',f.runner_snapshot_before_post
 ) ORDER BY f.horse_no) FROM results f
 ),'[]'::jsonb)
);
$fn$;
REVOKE ALL ON FUNCTION private.jra_live_locked_2025_feature_packet_v1(date,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_live_locked_2025_feature_packet_v1(date,text,integer) FROM anon,authenticated;
