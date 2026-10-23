-- Exactly locked 2025 coefficients; no retraining using 2026 target outcomes.
-- All target feature fields strictly predate each race. All-runners-only
-- cohorts ensure comparable TOP5, with incomplete races skipped.
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
), dataset AS MATERIALIZED (
SELECT f.*,r.field_size
FROM private.jra_research_asof_features_v1(
  DATE '2026-01-01',DATE '2026-09-13') f
JOIN public.jra_lab_races r ON r.id=f.race_id
WHERE f.base_rate IS NOT NULL
), candidates AS MATERIALIZED (
SELECT d.*,
 GREATEST(0.01,LEAST(0.95,d.base_rate+
   GREATEST(-0.10,LEAST(0.10,0.60*COALESCE(adj.uplift_sum,0)))
 )) new_rate
FROM dataset d
LEFT JOIN LATERAL (
 SELECT SUM(c.uplift) uplift_sum FROM (VALUES
  ('CLOSE_4TO6',d.near_close46),
  ('NEAR_PODIUM',d.recent_near_top3),
  ('SAMECLASS_CLOSE',d.recent_sameclass_close),
  ('OLDER_COURSE_PODIUM',d.old_same_track_top3),
  ('FAST_CLOSE',d.recent_3f_close)
 ) s(signal,active)
 JOIN coefficients c ON c.segment=d.segment AND
   c.rate_group=floor(d.base_rate*5)::integer AND c.signal=s.signal
 WHERE s.active
) adj ON TRUE
), eligible AS (
SELECT race_id FROM candidates GROUP BY race_id
HAVING COUNT(*)=MAX(field_size)
 AND COUNT(*)=COUNT(DISTINCT horse_no)
 AND COUNT(*)>=6
), ranked AS (
SELECT d.*,
 row_number() OVER(PARTITION BY race_id ORDER BY
  base_rate DESC,mean_gap4 ASC NULLS LAST,horse_no) old_rank,
 row_number() OVER(PARTITION BY race_id ORDER BY
  new_rate DESC,base_rate DESC,mean_gap4 ASC NULLS LAST,horse_no) new_rank
FROM candidates d JOIN eligible e USING(race_id)
), per_race AS (
SELECT race_id,MIN(race_date) race_date,MIN(segment) segment,COUNT(*) runners,
 COUNT(*) FILTER(WHERE target_top3 AND old_rank<=5) old_hits,
 COUNT(*) FILTER(WHERE target_top3 AND new_rank<=5) new_hits,
 COUNT(*) FILTER(WHERE target_top3 AND new_rank<=5 AND old_rank>5) gained,
 COUNT(*) FILTER(WHERE target_top3 AND new_rank>5 AND old_rank<=5) lost,
 COUNT(*) FILTER(WHERE new_rank<=5 AND old_rank>5) promoted
FROM ranked GROUP BY race_id
)
SELECT 'ALL_2026' comparison_window,COUNT(*) races,SUM(runners) runners,
 SUM(old_hits) old_hits,SUM(new_hits) new_hits,
 SUM(gained) gained,SUM(lost) lost,SUM(promoted) promoted,
 COUNT(*) FILTER(WHERE new_hits>old_hits) positive_races,
 COUNT(*) FILTER(WHERE new_hits<old_hits) negative_races
FROM per_race
UNION ALL SELECT 'JAN_APR',COUNT(*),SUM(runners),
 SUM(old_hits),SUM(new_hits),SUM(gained),SUM(lost),SUM(promoted),
 COUNT(*) FILTER(WHERE new_hits>old_hits),
 COUNT(*) FILTER(WHERE new_hits<old_hits)
FROM per_race WHERE race_date<DATE '2026-05-01'
UNION ALL SELECT 'MAY_SEP',COUNT(*),SUM(runners),
 SUM(old_hits),SUM(new_hits),SUM(gained),SUM(lost),SUM(promoted),
 COUNT(*) FILTER(WHERE new_hits>old_hits),
 COUNT(*) FILTER(WHERE new_hits<old_hits)
FROM per_race WHERE race_date>=DATE '2026-05-01';
