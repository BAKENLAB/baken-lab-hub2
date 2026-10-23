-- BAKEN LAB JRA RESEARCH: 2025-learned additive residual, 2026 time holdout
--
-- NO data mutation, model promotion, target-race feature leakage, or odds.
-- Training: 2025 archive; validation: 2026-01-01 to 2026-09-13.
-- Baseline proxy: stored BASE_CORE_0.1 training table reconstructed from
-- as-of eight-run timeline (last four input). Not official saved FROZEN.
-- This exact candidate and damping cap must be frozen BEFORE inspecting
-- 2026 holdout results. A failed experiment is still a valid conclusion.
WITH dataset AS MATERIALIZED (
 SELECT f.*,r.field_size
 FROM private.jra_research_asof_features_v1(
   DATE '2025-01-01', DATE '2026-09-13') f
 JOIN public.jra_lab_races r ON r.id=f.race_id
 WHERE f.base_rate IS NOT NULL
), trained AS (
 SELECT segment,
   floor(base_rate*5)::integer AS rate_group,
   signal, COUNT(*) n,
   SUM(target_top3::integer) target_3,
   avg(base_rate) average_prior,
   (SUM(target_top3::integer)::numeric/COUNT(*)) observed
 FROM dataset d
 CROSS JOIN LATERAL (VALUES
  ('CLOSE_4TO6',d.near_close46),
  ('NEAR_PODIUM',d.recent_near_top3),
  ('SAMECLASS_CLOSE',d.recent_sameclass_close),
  ('OLDER_COURSE_PODIUM',d.old_same_track_top3),
  ('FAST_CLOSE',d.recent_3f_close)
 ) AS signal_table(signal,active)
 WHERE d.race_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
   AND signal_table.active
 GROUP BY 1,2,3
), coefficients AS (
 SELECT segment,rate_group,signal,n,
   GREATEST(-0.055,LEAST(0.055,
     n::numeric/(n+150.0)*(observed-average_prior)
   )) AS uplift
 FROM trained
), candidates AS MATERIALIZED (
 SELECT d.*,
   GREATEST(0.01,LEAST(0.95,d.base_rate+
      GREATEST(-0.10,LEAST(0.10,0.60*COALESCE(extra.adjustment,0)))
   )) AS experimental_rate
 FROM dataset d
 LEFT JOIN LATERAL (
  SELECT SUM(c.uplift) AS adjustment
  FROM (VALUES
    ('CLOSE_4TO6',d.near_close46),
    ('NEAR_PODIUM',d.recent_near_top3),
    ('SAMECLASS_CLOSE',d.recent_sameclass_close),
    ('OLDER_COURSE_PODIUM',d.old_same_track_top3),
    ('FAST_CLOSE',d.recent_3f_close)
  ) AS s(signal,active)
  JOIN coefficients c
    ON c.segment=d.segment
   AND c.rate_group=floor(d.base_rate*5)::integer
   AND c.signal=s.signal
  WHERE s.active
 ) extra ON TRUE
 WHERE d.race_date BETWEEN DATE '2026-01-01' AND DATE '2026-09-13'
), complete_races AS (
 SELECT race_id,COUNT(*) AS evaluated,
  COUNT(*) FILTER(WHERE base_rate IS NOT NULL) rated,
  MAX(field_size) field_size,
  COUNT(DISTINCT horse_no) unique_horses
 FROM candidates GROUP BY race_id
 HAVING COUNT(*)=MAX(field_size)
  AND COUNT(*)=COUNT(DISTINCT horse_no)
  AND COUNT(*)>=6
), ranked AS (
 SELECT c.*,
  row_number() OVER(PARTITION BY c.race_id ORDER BY
    c.base_rate DESC,c.mean_gap4 ASC NULLS LAST,c.horse_no) AS prior_rank,
  row_number() OVER(PARTITION BY c.race_id ORDER BY
    c.experimental_rate DESC,c.base_rate DESC,c.mean_gap4 ASC NULLS LAST,c.horse_no) AS revised_rank
 FROM candidates c JOIN complete_races r ON r.race_id=c.race_id
), per_race AS (
 SELECT race_id,MIN(race_date) race_date,MIN(track) track,
  MIN(race_no) race_no,MIN(segment) segment,MIN(surface) surface,
  COUNT(*) n,
  COUNT(*) FILTER(WHERE target_top3 AND prior_rank<=5) baseline_top5_top3,
  COUNT(*) FILTER(WHERE target_top3 AND revised_rank<=5) revised_top5_top3,
  COUNT(*) FILTER(WHERE target_top3 AND revised_rank<=5 AND prior_rank>5) newly_caught,
  COUNT(*) FILTER(WHERE target_top3 AND revised_rank>5 AND prior_rank<=5) lost_existing,
  COUNT(*) FILTER(WHERE prior_rank<=5 AND revised_rank>5) moved_out,
  COUNT(*) FILTER(WHERE prior_rank>5 AND revised_rank<=5) moved_in
 FROM ranked GROUP BY race_id
)
SELECT 'OVERALL_2026' AS population,COUNT(*) AS races,
 SUM(n) AS runners,
 SUM(baseline_top5_top3) AS baseline_podium_hits,
 SUM(revised_top5_top3) AS revised_podium_hits,
 SUM(newly_caught) AS gained_horses,
 SUM(lost_existing) AS lost_horses,
 SUM(moved_in) AS promoted_across_top5,
 COUNT(*) FILTER(WHERE revised_top5_top3>baseline_top5_top3) races_net_gain,
 COUNT(*) FILTER(WHERE revised_top5_top3<baseline_top5_top3) races_net_loss
FROM per_race
UNION ALL
SELECT 'JAN_APR_2026',COUNT(*),SUM(n),SUM(baseline_top5_top3),
 SUM(revised_top5_top3),SUM(newly_caught),SUM(lost_existing),SUM(moved_in),
 COUNT(*) FILTER(WHERE revised_top5_top3>baseline_top5_top3),
 COUNT(*) FILTER(WHERE revised_top5_top3<baseline_top5_top3)
 FROM per_race WHERE race_date<DATE '2026-05-01'
UNION ALL
SELECT 'MAY_SEP_2026',COUNT(*),SUM(n),SUM(baseline_top5_top3),
 SUM(revised_top5_top3),SUM(newly_caught),SUM(lost_existing),SUM(moved_in),
 COUNT(*) FILTER(WHERE revised_top5_top3>baseline_top5_top3),
 COUNT(*) FILTER(WHERE revised_top5_top3<baseline_top5_top3)
 FROM per_race WHERE race_date>=DATE '2026-05-01';
