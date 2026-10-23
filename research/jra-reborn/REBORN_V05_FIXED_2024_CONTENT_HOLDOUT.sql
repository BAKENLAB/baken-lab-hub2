-- REBORN V04 INDEPENDENT 2024 LEARNER
-- Train weights are FROZEN LITERAL values from learned-2024-reborn-v04-coefficients.json
-- Date 2024 training; 2025, then 2026 holdout. No target outcome in features.
-- NO LAB base_rate, rank, odds, popularity, grade in candidate formula.
-- "old proxy" comparator uses 2025 BASE_CORE and is evaluation-only.
WITH cohorts(segment,surface,prior) AS (
VALUES
('CLASS1','ダート',0.225341),
('CLASS1','芝',0.235787),
('CLASS2_3','ダート',0.209894),
('CLASS2_3','芝',0.238982),
('MAIDEN','ダート',0.210716),
('MAIDEN','芝',0.208324),
('OPEN_GRADED','ダート',0.205714),
('OPEN_GRADED','芝',0.213178)
), weights(segment,surface,signal,coef) AS (
VALUES
('CLASS1','ダート','CLASS_CLOSE',0.060418),
('CLASS1','ダート','CLOSE46',0.038796),
('CLASS1','ダート','FAST_CLOSE',0.015157),
('CLASS1','ダート','H0',-0.022985),
('CLASS1','ダート','H1',-0.026390),
('CLASS1','ダート','H2',0.017361),
('CLASS1','ダート','H3',0.001697),
('CLASS1','ダート','MA',0.401061),
('CLASS1','ダート','MB',0.215711),
('CLASS1','ダート','MC',-0.252108),
('CLASS1','ダート','MD',-0.555027),
('CLASS1','ダート','MNONE',-0.078149),
('CLASS1','ダート','NEAR_PODIUM',0.095397),
('CLASS1','ダート','OLD_COURSE',0.037096),
('CLASS1','ダート','P0',-0.493546),
('CLASS1','ダート','P1',0.008090),
('CLASS1','ダート','P2',0.287185),
('CLASS1','ダート','P3',0.496495),
('CLASS1','ダート','REPEAT',0.111063),
('CLASS1','芝','CLASS_CLOSE',0.012095),
('CLASS1','芝','CLOSE46',0.043328),
('CLASS1','芝','FAST_CLOSE',0.013616),
('CLASS1','芝','H0',-0.031440),
('CLASS1','芝','H1',0.008804),
('CLASS1','芝','H2',0.017381),
('CLASS1','芝','H3',-0.001295),
('CLASS1','芝','MA',0.443989),
('CLASS1','芝','MB',-0.000419),
('CLASS1','芝','MC',-0.451375),
('CLASS1','芝','MD',-0.398564),
('CLASS1','芝','MNONE',-0.106898),
('CLASS1','芝','NEAR_PODIUM',0.105307),
('CLASS1','芝','OLD_COURSE',0.024101),
('CLASS1','芝','P0',-0.591838),
('CLASS1','芝','P1',0.065572),
('CLASS1','芝','P2',0.258948),
('CLASS1','芝','P3',0.463743),
('CLASS1','芝','REPEAT',0.114220),
('CLASS2_3','ダート','CLASS_CLOSE',0.007690),
('CLASS2_3','ダート','CLOSE46',0.018076),
('CLASS2_3','ダート','FAST_CLOSE',-0.001095),
('CLASS2_3','ダート','H0',-0.008357),
('CLASS2_3','ダート','H1',-0.003188),
('CLASS2_3','ダート','H2',-0.007469),
('CLASS2_3','ダート','H3',0.002427),
('CLASS2_3','ダート','MA',0.376594),
('CLASS2_3','ダート','MB',0.082734),
('CLASS2_3','ダート','MC',-0.369593),
('CLASS2_3','ダート','MD',-0.343493),
('CLASS2_3','ダート','MNONE',-0.028413),
('CLASS2_3','ダート','NEAR_PODIUM',0.068124),
('CLASS2_3','ダート','OLD_COURSE',0.025110),
('CLASS2_3','ダート','P0',-0.501102),
('CLASS2_3','ダート','P1',-0.154396),
('CLASS2_3','ダート','P2',0.248252),
('CLASS2_3','ダート','P3',0.431607),
('CLASS2_3','ダート','REPEAT',0.106464),
('CLASS2_3','芝','CLASS_CLOSE',-0.008812),
('CLASS2_3','芝','CLOSE46',0.014033),
('CLASS2_3','芝','FAST_CLOSE',0.003468),
('CLASS2_3','芝','H0',-0.002617),
('CLASS2_3','芝','H1',-0.000804),
('CLASS2_3','芝','H2',0.002953),
('CLASS2_3','芝','H3',-0.000192),
('CLASS2_3','芝','MA',0.331942),
('CLASS2_3','芝','MB',-0.119731),
('CLASS2_3','芝','MC',-0.479136),
('CLASS2_3','芝','MD',-0.136638),
('CLASS2_3','芝','MNONE',-0.008899),
('CLASS2_3','芝','NEAR_PODIUM',0.077705),
('CLASS2_3','芝','OLD_COURSE',0.034327),
('CLASS2_3','芝','P0',-0.521607),
('CLASS2_3','芝','P1',-0.079670),
('CLASS2_3','芝','P2',0.178248),
('CLASS2_3','芝','P3',0.467953),
('CLASS2_3','芝','REPEAT',0.090211),
('MAIDEN','ダート','CLASS_CLOSE',0.141429),
('MAIDEN','ダート','CLOSE46',0.093315),
('MAIDEN','ダート','FAST_CLOSE',0.028845),
('MAIDEN','ダート','H0',-0.121966),
('MAIDEN','ダート','H1',-0.032739),
('MAIDEN','ダート','H2',-0.018115),
('MAIDEN','ダート','H3',0.037151),
('MAIDEN','ダート','MA',0.513473),
('MAIDEN','ダート','MB',0.546801),
('MAIDEN','ダート','MC',0.032990),
('MAIDEN','ダート','MD',-0.645958),
('MAIDEN','ダート','MNONE',-0.414685),
('MAIDEN','ダート','NEAR_PODIUM',0.240073),
('MAIDEN','ダート','OLD_COURSE',0.029784),
('MAIDEN','ダート','P0',-0.463493),
('MAIDEN','ダート','P1',0.508056),
('MAIDEN','ダート','P2',0.635751),
('MAIDEN','ダート','P3',0.489107),
('MAIDEN','ダート','REPEAT',0.188144),
('MAIDEN','芝','CLASS_CLOSE',0.088631),
('MAIDEN','芝','CLOSE46',0.084064),
('MAIDEN','芝','FAST_CLOSE',0.041949),
('MAIDEN','芝','H0',-0.084687),
('MAIDEN','芝','H1',0.016461),
('MAIDEN','芝','H2',-0.000923),
('MAIDEN','芝','H3',0.004153),
('MAIDEN','芝','MA',0.708413),
('MAIDEN','芝','MB',0.235682),
('MAIDEN','芝','MC',-0.344572),
('MAIDEN','芝','MD',-0.848053),
('MAIDEN','芝','MNONE',-0.287936),
('MAIDEN','芝','NEAR_PODIUM',0.217735),
('MAIDEN','芝','OLD_COURSE',0.023226),
('MAIDEN','芝','P0',-0.464504),
('MAIDEN','芝','P1',0.454313),
('MAIDEN','芝','P2',0.529916),
('MAIDEN','芝','P3',0.405432),
('MAIDEN','芝','REPEAT',0.169715),
('OPEN_GRADED','ダート','CLASS_CLOSE',0.009156),
('OPEN_GRADED','ダート','CLOSE46',-0.006758),
('OPEN_GRADED','ダート','FAST_CLOSE',-0.010815),
('OPEN_GRADED','ダート','H0',-0.002543),
('OPEN_GRADED','ダート','H1',-0.005447),
('OPEN_GRADED','ダート','H2',0.003686),
('OPEN_GRADED','ダート','H3',0.002848),
('OPEN_GRADED','ダート','MA',0.216974),
('OPEN_GRADED','ダート','MB',-0.027242),
('OPEN_GRADED','ダート','MC',-0.242479),
('OPEN_GRADED','ダート','MD',-0.075942),
('OPEN_GRADED','ダート','MNONE',-0.008648),
('OPEN_GRADED','ダート','NEAR_PODIUM',0.057125),
('OPEN_GRADED','ダート','OLD_COURSE',0.017084),
('OPEN_GRADED','ダート','P0',-0.332065),
('OPEN_GRADED','ダート','P1',-0.100713),
('OPEN_GRADED','ダート','P2',0.094979),
('OPEN_GRADED','ダート','P3',0.217770),
('OPEN_GRADED','ダート','REPEAT',0.063408),
('OPEN_GRADED','芝','CLASS_CLOSE',-0.006230),
('OPEN_GRADED','芝','CLOSE46',0.006652),
('OPEN_GRADED','芝','FAST_CLOSE',-0.007506),
('OPEN_GRADED','芝','H0',-0.006116),
('OPEN_GRADED','芝','H1',0.036904),
('OPEN_GRADED','芝','H2',0.005971),
('OPEN_GRADED','芝','H3',-0.010115),
('OPEN_GRADED','芝','MA',0.224909),
('OPEN_GRADED','芝','MB',-0.269144),
('OPEN_GRADED','芝','MC',-0.219088),
('OPEN_GRADED','芝','MD',-0.044412),
('OPEN_GRADED','芝','MNONE',-0.020795),
('OPEN_GRADED','芝','NEAR_PODIUM',0.050523),
('OPEN_GRADED','芝','OLD_COURSE',0.007185),
('OPEN_GRADED','芝','P0',-0.466102),
('OPEN_GRADED','芝','P1',0.054559),
('OPEN_GRADED','芝','P2',0.016497),
('OPEN_GRADED','芝','P3',0.243126),
('OPEN_GRADED','芝','REPEAT',0.043741)
), d AS MATERIALIZED (
 SELECT f.*,r.field_size
 FROM private.jra_research_asof_features_v1(
   DATE '<START_DATE>',DATE '<END_DATE>') f
 JOIN public.jra_lab_races r ON r.id=f.race_id
 WHERE f.segment IN ('MAIDEN','CLASS1','CLASS2_3','OPEN_GRADED')
 AND f.surface IN ('芝','ダート')
), scored AS MATERIALIZED (
 SELECT d.*,
 COALESCE(s.raw_adjust,0) learned_offset,
 1/(1+EXP(-(LN(c.prior/(1-c.prior))+COALESCE(s.raw_adjust,0)))) research_rate
 FROM d JOIN cohorts c ON c.segment=d.segment AND c.surface=d.surface
 LEFT JOIN LATERAL (
   SELECT SUM(w.coef) AS raw_adjust
   FROM (VALUES
     ('P'||least(d.podium4,3)::text),
     ('H'||least(d.n4,3)::text),
     ('M'||(CASE WHEN d.mean_gap4 IS NULL THEN 'NONE'
       WHEN d.mean_gap4<=0.5 THEN 'A'
       WHEN d.mean_gap4<=1.0 THEN 'B'
       WHEN d.mean_gap4<=2.0 THEN 'C' ELSE 'D' END)),
     (CASE WHEN d.near_close46 THEN 'CLOSE46' END),
     (CASE WHEN d.recent_sameclass_close THEN 'CLASS_CLOSE' END),
     (CASE WHEN d.recent_near_top3 THEN 'NEAR_PODIUM' END),
     (CASE WHEN d.old_same_track_top3 THEN 'OLD_COURSE' END),
     (CASE WHEN d.recent_3f_close THEN 'FAST_CLOSE' END),
     (CASE WHEN d.recent_consistent THEN 'REPEAT' END)
   ) v(signal)
   JOIN weights w ON w.segment=d.segment AND w.surface=d.surface AND w.signal=v.signal
 ) s ON TRUE
),
 content_coeffs(segment,surface,signal,coef) AS (VALUES
('CLASS1','ダート','FRONT_HOT',-0.033151),
('CLASS1','ダート','HIDDEN_CLOSER',0.001812),
('CLASS1','ダート','LATE_GAIN',0.006496),
('CLASS1','芝','FRONT_HOT',0.022053),
('CLASS1','芝','HIDDEN_CLOSER',-0.010349),
('CLASS1','芝','LATE_GAIN',-0.003174),
('CLASS2_3','ダート','FRONT_HOT',-0.054988),
('CLASS2_3','ダート','HIDDEN_CLOSER',-0.035914),
('CLASS2_3','ダート','LATE_GAIN',-0.014764),
('CLASS2_3','芝','FRONT_HOT',-0.049595),
('CLASS2_3','芝','HIDDEN_CLOSER',-0.047424),
('CLASS2_3','芝','LATE_GAIN',-0.006619),
('MAIDEN','ダート','FRONT_HOT',-0.004663),
('MAIDEN','ダート','HIDDEN_CLOSER',-0.006909),
('MAIDEN','ダート','LATE_GAIN',-0.002892),
('MAIDEN','芝','FRONT_HOT',-0.031874),
('MAIDEN','芝','HIDDEN_CLOSER',0.019485),
('MAIDEN','芝','LATE_GAIN',-0.037389),
('OPEN_GRADED','ダート','FRONT_HOT',-0.002571),
('OPEN_GRADED','ダート','HIDDEN_CLOSER',-0.024408),
('OPEN_GRADED','ダート','LATE_GAIN',-0.000433),
('OPEN_GRADED','芝','FRONT_HOT',-0.000132),
('OPEN_GRADED','芝','HIDDEN_CLOSER',-0.032788),
('OPEN_GRADED','芝','LATE_GAIN',-0.018059)
 ),
 content_scored AS MATERIALIZED (
  SELECT s.*,
  (c.race_id IS NOT NULL) AS content_available,
  COALESCE(f.delta,0) AS content_delta,
  1/(1+EXP(-(LN(s.research_rate/(1-s.research_rate))+COALESCE(f.delta,0)))) AS reborn5_rate
  FROM scored s
  LEFT JOIN private.jra_reborn_v05_content_cache_20261024 c
    ON c.race_id=s.race_id AND c.horse_no=s.horse_no
   AND c.race_date=s.race_date AND c.segment=s.segment AND c.surface=s.surface
  LEFT JOIN LATERAL (
    SELECT SUM(cf.coef) delta
    FROM (VALUES
      ('LATE_GAIN',c.late_position_gain),
      ('FRONT_HOT',c.hot_front_survivor),
      ('HIDDEN_CLOSER',c.overlooked_closer)
    ) v(signal,active)
    JOIN content_coeffs cf ON cf.segment=s.segment AND cf.surface=s.surface
       AND cf.signal=v.signal
    WHERE v.active
  ) f ON TRUE
 ),
 eligible AS (
  SELECT race_id FROM content_scored
  GROUP BY race_id
  HAVING count(*)=max(field_size)
    AND count(*)=count(DISTINCT horse_no)
    AND min(field_size)>=6
    AND count(*) FILTER (WHERE base_rate IS NULL)=0
    AND bool_and(content_available)
 ),
 ranked AS (
  SELECT s.*,
  ROW_NUMBER() OVER(PARTITION BY s.race_id ORDER BY s.research_rate DESC,s.horse_no) AS reborn4_rank,
  ROW_NUMBER() OVER(PARTITION BY s.race_id ORDER BY s.reborn5_rate DESC,s.horse_no) AS reborn5_rank,
  ROW_NUMBER() OVER(PARTITION BY s.race_id ORDER BY s.base_rate DESC,s.mean_gap4 ASC NULLS LAST,s.horse_no) AS old_proxy_rank
  FROM content_scored s JOIN eligible e ON e.race_id=s.race_id
 ),
 per_race AS (
 SELECT race_id,min(race_date) race_date,min(surface) surface,
  min(segment) segment,count(*) runners,
  count(*) FILTER(WHERE target_top3 AND old_proxy_rank<=5) old_caught,
  count(*) FILTER(WHERE target_top3 AND reborn4_rank<=5) reborn4_caught,
  count(*) FILTER(WHERE target_top3 AND reborn5_rank<=5) reborn5_caught,
  count(*) FILTER(WHERE target_top3 AND reborn5_rank<=5 AND reborn4_rank>5) rescued_from_v4,
  count(*) FILTER(WHERE target_top3 AND reborn5_rank>5 AND reborn4_rank<=5) lost_from_v4,
  count(*) FILTER(WHERE target_top3 AND reborn5_rank<=5 AND old_proxy_rank>5) rescued_from_old,
  count(*) FILTER(WHERE target_top3 AND reborn5_rank>5 AND old_proxy_rank<=5) lost_from_old
 FROM ranked GROUP BY race_id
)
SELECT 'ALL' grp,'ALL' category,count(*) races,sum(runners) runners,
 sum(old_caught) old_proxy,sum(reborn4_caught) reborn4,sum(reborn5_caught) reborn5,
 sum(rescued_from_v4) rescued_v4,sum(lost_from_v4) lost_v4,
 sum(rescued_from_old) rescued_old,sum(lost_from_old) lost_old
FROM per_race
UNION ALL
SELECT 'SURFACE',surface,count(*),sum(runners),
 sum(old_caught),sum(reborn4_caught),sum(reborn5_caught),
 sum(rescued_from_v4),sum(lost_from_v4),
 sum(rescued_from_old),sum(lost_from_old)
FROM per_race GROUP BY surface
UNION ALL
SELECT 'SEGMENT',segment,count(*),sum(runners),
 sum(old_caught),sum(reborn4_caught),sum(reborn5_caught),
 sum(rescued_from_v4),sum(lost_from_v4),
 sum(rescued_from_old),sum(lost_from_old)
FROM per_race GROUP BY segment
ORDER BY grp,category;