-- Live pre-race JRA trained model score, read-only, strictly research.
-- Coefficients from immutable GitHub training fixture (2025 ONLY).
-- No target results, odds, popularity, wagers, JRA FROZEN writes or EYE changes.
CREATE OR REPLACE FUNCTION private.jra_live_locked_2025_score_packet_v1(
 p_date date,p_track text,p_race_no integer
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,private
AS $f$
WITH coefficients(segment,rate_group,signal,uplift) AS (
 VALUES
('CLASS1',0,'CLOSE_4TO6',0.03551),
('CLASS1',0,'FAST_CLOSE',0.00824),
('CLASS1',0,'NEAR_PODIUM',0.01202),
('CLASS1',0,'OLDER_COURSE_PODIUM',0.05500),
('CLASS1',0,'SAMECLASS_CLOSE',0.02168),
('CLASS1',1,'CLOSE_4TO6',0.00765),
('CLASS1',1,'FAST_CLOSE',0.00562),
('CLASS1',1,'NEAR_PODIUM',0.01017),
('CLASS1',1,'OLDER_COURSE_PODIUM',0.03993),
('CLASS1',1,'SAMECLASS_CLOSE',0.02408),
('CLASS1',2,'CLOSE_4TO6',0.03011),
('CLASS1',2,'FAST_CLOSE',0.01024),
('CLASS1',2,'NEAR_PODIUM',-0.00634),
('CLASS1',2,'OLDER_COURSE_PODIUM',0.02327),
('CLASS1',2,'SAMECLASS_CLOSE',0.01842),
('CLASS2_3',0,'CLOSE_4TO6',0.02461),
('CLASS2_3',0,'FAST_CLOSE',0.00326),
('CLASS2_3',0,'NEAR_PODIUM',-0.00017),
('CLASS2_3',0,'OLDER_COURSE_PODIUM',0.03936),
('CLASS2_3',0,'SAMECLASS_CLOSE',0.00699),
('CLASS2_3',1,'CLOSE_4TO6',0.01571),
('CLASS2_3',1,'FAST_CLOSE',0.00459),
('CLASS2_3',1,'NEAR_PODIUM',0.00469),
('CLASS2_3',1,'OLDER_COURSE_PODIUM',0.00993),
('CLASS2_3',1,'SAMECLASS_CLOSE',0.00611),
('CLASS2_3',2,'CLOSE_4TO6',-0.00851),
('CLASS2_3',2,'FAST_CLOSE',-0.00721),
('CLASS2_3',2,'NEAR_PODIUM',-0.00546),
('CLASS2_3',2,'OLDER_COURSE_PODIUM',-0.00197),
('CLASS2_3',2,'SAMECLASS_CLOSE',0.00415),
('MAIDEN',0,'CLOSE_4TO6',0.05500),
('MAIDEN',0,'FAST_CLOSE',0.05500),
('MAIDEN',0,'OLDER_COURSE_PODIUM',0.01166),
('MAIDEN',0,'SAMECLASS_CLOSE',0.01718),
('MAIDEN',1,'CLOSE_4TO6',0.01570),
('MAIDEN',1,'FAST_CLOSE',0.01681),
('MAIDEN',1,'NEAR_PODIUM',0.01243),
('MAIDEN',1,'OLDER_COURSE_PODIUM',0.02689),
('MAIDEN',1,'SAMECLASS_CLOSE',-0.00066),
('MAIDEN',2,'CLOSE_4TO6',-0.03892),
('MAIDEN',2,'FAST_CLOSE',-0.00004),
('MAIDEN',2,'NEAR_PODIUM',0.01141),
('MAIDEN',2,'OLDER_COURSE_PODIUM',-0.01374),
('MAIDEN',2,'SAMECLASS_CLOSE',0.00207),
('MAIDEN',3,'CLOSE_4TO6',-0.01523),
('MAIDEN',3,'FAST_CLOSE',-0.00763),
('MAIDEN',3,'NEAR_PODIUM',-0.00359),
('MAIDEN',3,'OLDER_COURSE_PODIUM',0.00208),
('MAIDEN',3,'SAMECLASS_CLOSE',-0.00285),
('OPEN_GRADED',0,'CLOSE_4TO6',0.02573),
('OPEN_GRADED',0,'FAST_CLOSE',0.03101),
('OPEN_GRADED',0,'NEAR_PODIUM',0.00020),
('OPEN_GRADED',0,'OLDER_COURSE_PODIUM',0.03652),
('OPEN_GRADED',0,'SAMECLASS_CLOSE',0.00639),
('OPEN_GRADED',1,'CLOSE_4TO6',0.00051),
('OPEN_GRADED',1,'FAST_CLOSE',-0.02588),
('OPEN_GRADED',1,'NEAR_PODIUM',0.00046),
('OPEN_GRADED',1,'OLDER_COURSE_PODIUM',0.01639),
('OPEN_GRADED',1,'SAMECLASS_CLOSE',0.00066),
('OPEN_GRADED',2,'NEAR_PODIUM',0.00795),
('OPEN_GRADED',2,'OLDER_COURSE_PODIUM',0.02749),
('OPEN_GRADED',2,'SAMECLASS_CLOSE',0.00316)
), packet AS (
 SELECT private.jra_live_locked_2025_feature_packet_v1(
  p_date,p_track,p_race_no
 ) AS v
), listed AS (
 SELECT b.v->>'status' status,
 j.value AS source, (j.value->>'base_rate')::numeric AS old_rate,
 j.value->>'segment' AS segment,
 (j.value->>'horse_no')::integer AS horse_no,
 j.value->>'horse_name' AS horse_name,
 (j.value->>'base_rank')::integer AS original_rank,
 (j.value->>'mean_gap4')::numeric AS gap
 FROM packet b CROSS JOIN LATERAL jsonb_array_elements(b.v->'runners') j
), scored AS (
 SELECT a.*,
   COALESCE(adj.uplift_sum,0) AS raw_signal_sum,
   GREATEST(-0.10,LEAST(0.10,0.60*COALESCE(adj.uplift_sum,0))) AS correction,
   GREATEST(0.01,LEAST(0.95,a.old_rate+
     GREATEST(-0.10,LEAST(0.10,0.60*COALESCE(adj.uplift_sum,0))))) AS new_rate
 FROM listed a
 LEFT JOIN LATERAL (
 SELECT sum(c.uplift) uplift_sum
 FROM (VALUES
  ('CLOSE_4TO6',(a.source->>'near_close46')::boolean),
  ('NEAR_PODIUM',(a.source->>'recent_near_top3')::boolean),
  ('SAMECLASS_CLOSE',(a.source->>'recent_sameclass_close')::boolean),
  ('OLDER_COURSE_PODIUM',(a.source->>'old_same_track_top3')::boolean),
  ('FAST_CLOSE',(a.source->>'recent_3f_close')::boolean)
 ) active(signal,yes)
 JOIN coefficients c ON c.segment=a.segment AND
  c.rate_group=floor(a.old_rate*5)::integer AND c.signal=active.signal
 WHERE active.yes
 ) adj ON TRUE
), ranked AS (
 SELECT s.*,row_number() OVER(ORDER BY s.new_rate DESC,
   s.old_rate DESC,s.gap ASC NULLS LAST,s.horse_no) AS trial_rank
 FROM scored s
)
SELECT jsonb_build_object(
 'status',CASE WHEN (SELECT v->>'status' FROM packet)<>'READY_FOR_RESEARCH_SHADOW'
  THEN 'SKIP_NOT_PRESTART_COMPLETE'
  ELSE 'RESEARCH_SCORE_READY' END,
 'input_status',(SELECT v->>'status' FROM packet),
 'model','JRA_ASOF_2025_RESIDUAL_V01',
 'score_label','RESEARCH_100_UNCALIBRATED',
 'as_of',p_date,'track',p_track,'race_no',p_race_no,
 'no_official_prediction_write',true,
 'no_eye_change',true,'no_bets',true,
 'compare_only',true,
 'runners',CASE WHEN (SELECT v->>'status' FROM packet)<>'READY_FOR_RESEARCH_SHADOW'
  THEN '[]'::jsonb ELSE COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
   'horse_no',horse_no,'horse_name',horse_name,
   'base_rank',original_rank,'research_rank',trial_rank,
   'base_rate',round(old_rate,6),
   'research_score_100',round(new_rate*100,2),
   'base_score_100',round(old_rate*100,2),
   'learned_delta_100',round((new_rate-old_rate)*100,2),
   'evidence_flags',jsonb_build_object(
    'close46',source->'near_close46',
    'near_podium',source->'recent_near_top3',
    'same_class_close',source->'recent_sameclass_close',
    'older_course',source->'old_same_track_top3',
    'fast_close',source->'recent_3f_close',
    'fast_close_unknown',source->'fast3f_history_unknown'
   )
  ) ORDER BY trial_rank) FROM ranked
 ),'[]'::jsonb) END
);
$f$;
REVOKE ALL ON FUNCTION private.jra_live_locked_2025_score_packet_v1(date,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_live_locked_2025_score_packet_v1(date,text,integer) FROM anon,authenticated;
