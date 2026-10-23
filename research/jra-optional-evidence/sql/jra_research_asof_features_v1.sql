-- JRA LAB RESEARCH: strictly prior-race as-of history.
-- Read-only STABLE SECURITY INVOKER. No writes/official prediction influence.
-- 2023+ history, 2025 train and 2026 chronological validation.
-- Window frame PRECEDING ONE explicitly excludes current finish from features.
CREATE OR REPLACE FUNCTION private.jra_research_asof_features_v1(
 p_from date DEFAULT DATE '2025-01-01',
 p_to date DEFAULT DATE '2026-09-13'
)
RETURNS TABLE(
 race_date date, track text, race_no int, race_id uuid, horse_no int,
 horse_name text, surface text, distance int, segment text,
 target_top3 boolean, n4 int, podium4 int, mean_gap4 numeric, 
 near_close46 boolean, recent_sameclass_close boolean,
 recent_near_top3 boolean, old_same_track_top3 boolean,
 recent_3f_close boolean, recent_consistent boolean,
 base_rate numeric, base_rank int
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,private
AS $fn$
WITH raw AS (
 SELECT r.id rid,r.race_date,r.track,r.race_no,r.surface,r.distance,
  r.class_name,private.jra_model_segment(r.class_name,r.race_name) seg,
  private.jra_class_level(r.class_name) class_level,
  x.horse_no,x.horse_name,x.finish,x.final3f_rank,
  substring(x.horse_ref FROM '([0-9]{10})/') horse_code,
  CASE WHEN x.time_raw ~ '^[0-9]+:[0-9]{2}[.][0-9]$'
    THEN split_part(x.time_raw,':',1)::numeric*60
      + split_part(x.time_raw,':',2)::numeric END seconds
 FROM public.jra_lab_races r JOIN public.jra_lab_runs x
 ON x.race_id=r.id AND x.record_role='full_runner'
 WHERE r.race_date BETWEEN DATE '2023-01-01' AND p_to
   AND COALESCE(r.race_type,'平地') <> '障害'
   AND r.surface IN ('芝','ダート') AND x.horse_ref IS NOT NULL
   AND x.finish IS NOT NULL AND x.horse_no IS NOT NULL
),
timed AS (
 SELECT raw.*,
  max(CASE WHEN finish=1 THEN seconds END) OVER(PARTITION BY rid) winner_seconds
 FROM raw
),
events AS (
 SELECT timed.*,
  CASE WHEN seconds IS NOT NULL AND winner_seconds IS NOT NULL
    THEN greatest(0,seconds-winner_seconds) END gap_seconds
 FROM timed
),
sequence AS (
 SELECT e.*,
  jsonb_agg(jsonb_build_object(
   'date',e.race_date,'track',e.track,'surface',e.surface,
   'distance',e.distance,'class_level',e.class_level,
   'finish',e.finish,'gap',e.gap_seconds,
   'final3f_rank',e.final3f_rank
  )) OVER(PARTITION BY e.horse_code
    ORDER BY e.race_date,e.track,e.race_no
    ROWS BETWEEN 8 PRECEDING AND 1 PRECEDING) history8
 FROM events e WHERE e.horse_code IS NOT NULL
),
history_flags AS (
 SELECT s.*,
  COALESCE((
    SELECT count(*)::integer
    FROM jsonb_array_elements(s.history8) WITH ORDINALITY h(v,ord)
    WHERE ord>GREATEST(0,jsonb_array_length(s.history8)-4)
     AND (v->>'date')::date<s.race_date
  ),0)::integer n_recent,
  COALESCE((
    SELECT count(*)::integer
    FROM jsonb_array_elements(s.history8) WITH ORDINALITY h(v,ord)
    WHERE ord>GREATEST(0,jsonb_array_length(s.history8)-4)
     AND (v->>'date')::date<s.race_date AND (v->>'finish')::integer<=3
  ),0)::integer top3_recent,
  (SELECT avg((v->>'gap')::numeric)
    FROM jsonb_array_elements(s.history8) WITH ORDINALITY h(v,ord)
    WHERE ord>GREATEST(0,jsonb_array_length(s.history8)-4)
      AND (v->>'date')::date<s.race_date AND (v->>'gap') IS NOT NULL
  ) avg_gap,
  EXISTS(
   SELECT 1 FROM jsonb_array_elements(s.history8) WITH ORDINALITY h(v,ord)
   WHERE ord>GREATEST(0,jsonb_array_length(s.history8)-4)
    AND (v->>'date')::date<s.race_date
    AND v->>'surface'=s.surface AND abs((v->>'distance')::integer-s.distance)<=200
    AND (v->>'finish')::integer BETWEEN 4 AND 6 AND (v->>'gap')::numeric BETWEEN 0 AND 0.5
  ) has_close46,
  EXISTS(
   SELECT 1 FROM jsonb_array_elements(s.history8) WITH ORDINALITY h(v,ord)
   WHERE ord>GREATEST(0,jsonb_array_length(s.history8)-4)
    AND (v->>'date')::date<s.race_date
    AND (v->>'class_level')::integer=s.class_level
    AND (v->>'gap')::numeric BETWEEN 0 AND 1.0
  ) has_class_close,
  EXISTS(
   SELECT 1 FROM jsonb_array_elements(s.history8) WITH ORDINALITY h(v,ord)
   WHERE ord>GREATEST(0,jsonb_array_length(s.history8)-4)
    AND (v->>'date')::date<s.race_date
    AND v->>'surface'=s.surface AND abs((v->>'distance')::integer-s.distance)<=200
    AND (v->>'finish')::integer<=3
  ) has_near_top3,
  EXISTS(
   SELECT 1 FROM jsonb_array_elements(s.history8) WITH ORDINALITY h(v,ord)
   WHERE ord<=GREATEST(0,jsonb_array_length(s.history8)-4)
    AND (v->>'date')::date<s.race_date
    AND v->>'surface'=s.surface AND v->>'track'=s.track
    AND abs((v->>'distance')::integer-s.distance)<=400
    AND (v->>'finish')::integer<=3
  ) has_older_top3,
  EXISTS(
   SELECT 1 FROM jsonb_array_elements(s.history8) WITH ORDINALITY h(v,ord)
   WHERE ord>GREATEST(0,jsonb_array_length(s.history8)-4)
    AND (v->>'date')::date<s.race_date
    AND v->>'surface'=s.surface AND abs((v->>'distance')::integer-s.distance)<=200
    AND (v->>'finish')::integer BETWEEN 4 AND 10
    AND (v->>'final3f_rank')::integer<=3 AND (v->>'gap')::numeric BETWEEN 0 AND 0.5
  ) has_fast_close,
  (SELECT COUNT(*) FROM jsonb_array_elements(s.history8) WITH ORDINALITY h(v,ord)
   WHERE ord>GREATEST(0,jsonb_array_length(s.history8)-4)
    AND (v->>'date')::date<s.race_date
    AND v->>'surface'=s.surface AND abs((v->>'distance')::integer-s.distance)<=200
    AND (v->>'finish')::integer<=3
  )>=2 has_repeatable
 FROM sequence s
 WHERE s.race_date BETWEEN p_from AND p_to
  AND s.seg IN ('MAIDEN','CLASS1','CLASS2_3','OPEN_GRADED')
),
scored AS (
 SELECT f.*,
  CASE WHEN f.avg_gap IS NULL THEN NULL
   WHEN f.avg_gap<=0.5 THEN 'M0_05'
   WHEN f.avg_gap<=1.0 THEN 'M06_10'
   WHEN f.avg_gap<=2.0 THEN 'M11_20'
   ELSE 'M20_PLUS' END margin_band
 FROM history_flags f
),
rated AS (
 SELECT f.*,
  CASE WHEN f.n_recent<1 OR f.avg_gap IS NULL THEN NULL
   WHEN ex.runners>=100 THEN ex.top3_rate
   ELSE fallback.top3_rate END estimated_rate
 FROM scored f
 LEFT JOIN private.jra_base_core_stats_v1 ex
  ON ex.segment=f.seg AND ex.recent_top3_count4=f.top3_recent
  AND ex.margin_band=f.margin_band
  AND ex.training_from=DATE '2025-01-01' AND ex.training_to=DATE '2025-12-31'
 LEFT JOIN private.jra_base_core_fallback_stats_v1 fallback
  ON fallback.segment=f.seg AND fallback.recent_top3_count4=f.top3_recent
  AND fallback.training_from=DATE '2025-01-01' AND fallback.training_to=DATE '2025-12-31'
),
ranked AS (
 SELECT rated.*,
  CASE WHEN estimated_rate IS NULL THEN NULL ELSE
   ROW_NUMBER() OVER(PARTITION BY rid
    ORDER BY estimated_rate DESC NULLS LAST,avg_gap ASC NULLS LAST,horse_no) END approximate_base_rank
 FROM rated
)
SELECT
 ranked.race_date,ranked.track,ranked.race_no::integer,ranked.rid,ranked.horse_no::integer,
 ranked.horse_name,ranked.surface,ranked.distance,ranked.seg,
 (ranked.finish BETWEEN 1 AND 3) AS target_top3,
 ranked.n_recent,ranked.top3_recent,round(ranked.avg_gap,3),
 ranked.has_close46,ranked.has_class_close,ranked.has_near_top3,
 ranked.has_older_top3,ranked.has_fast_close,ranked.has_repeatable,
 round(ranked.estimated_rate,6),ranked.approximate_base_rank::integer
FROM ranked;
$fn$;
REVOKE ALL ON FUNCTION private.jra_research_asof_features_v1(date,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.jra_research_asof_features_v1(date,date) FROM anon,authenticated;
