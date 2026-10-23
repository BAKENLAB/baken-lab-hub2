-- LAB REBORN 0.5 | strict pre-target content signals.
-- This query is READ-ONLY and does not reference target race's own finish,
-- target market data, official LAB ranks/scores, or post-target outcomes as features.
-- All candidate signals consume ONLY history rows dated < target date.
-- Replace <START_DATE>, <END_DATE>; optionally filter results at end.
WITH hist_source AS MATERIALIZED (
  SELECT
    r.id rid, r.race_date, r.track, r.race_no,r.surface,r.distance,r.field_size,
    x.horse_no,x.horse_name,x.finish,x.final3f_rank,x.final_turn_pos,x.early_pos,
    substring(x.horse_ref FROM '([0-9]{10})/') horse_code,
    CASE WHEN x.time_raw ~ '^[0-9]+:[0-9]{2}[.][0-9]$'
      THEN split_part(x.time_raw,':',1)::numeric*60+split_part(x.time_raw,':',2)::numeric
    END secs,
    CASE WHEN r.distance BETWEEN 1200 AND 1400 AND r.halon_times ~
      '^[0-9]+([.][0-9]+)?([ ]*-[ ]*[0-9]+([.][0-9]+)?){5,}$'
      THEN regexp_split_to_array(r.halon_times,'[ ]*-[ ]*')::numeric[]
    END laps
  FROM public.jra_lab_races r JOIN public.jra_lab_runs x
   ON x.race_id=r.id AND x.record_role='full_runner'
  WHERE r.race_date>=DATE '2023-01-01'
    AND r.race_date<=DATE '<END_DATE>'
    AND r.surface IN ('芝','ダート')
    AND COALESCE(r.race_type,'平地')<>'障害'
    AND x.horse_ref IS NOT NULL AND x.horse_no IS NOT NULL
    AND x.finish IS NOT NULL
), hist_races AS MATERIALIZED (
  SELECT h.*,
   MIN(CASE WHEN finish=1 THEN secs END) OVER(PARTITION BY rid) win_secs,
   CASE WHEN array_length(laps,1)>=6 THEN
       (laps[array_length(laps,1)-2]+laps[array_length(laps,1)-1]+laps[array_length(laps,1)])-
       (laps[1]+laps[2]+laps[3])
   END as second_half_slowdown
  FROM hist_source h
), hist_events AS MATERIALIZED (
  SELECT h.*,
    CASE WHEN h.secs IS NOT NULL AND h.win_secs IS NOT NULL THEN GREATEST(0,h.secs-h.win_secs) END gap,
    CASE WHEN second_half_slowdown>=1.5 THEN TRUE
         WHEN second_half_slowdown IS NOT NULL THEN FALSE
    END hot_front,
    CASE WHEN second_half_slowdown IS NOT NULL THEN TRUE ELSE FALSE END measurable_pace
  FROM hist_races h
), hist_sequence AS MATERIALIZED (
  SELECT e.*,
    jsonb_agg(jsonb_build_object(
      'date',e.race_date,'track',e.track,'surface',e.surface,'distance',e.distance,
      'finish',e.finish,'gap',e.gap,'final_turn_pos',e.final_turn_pos,
      'early_pos',e.early_pos,'final3f_rank',e.final3f_rank,
      'field_size',e.field_size,'hot_front',e.hot_front,
      'measurable_pace',e.measurable_pace,
      'pace_slowdown',e.second_half_slowdown
    )) OVER(PARTITION BY e.horse_code ORDER BY e.race_date,e.track,e.race_no
      ROWS BETWEEN 8 PRECEDING AND 1 PRECEDING) past8
  FROM hist_events e
  WHERE horse_code IS NOT NULL
), content AS (
  SELECT e.rid race_id,e.race_date,e.track,e.race_no,
   e.horse_no,e.horse_name,e.surface,e.distance,
   COALESCE(EXISTS(
     SELECT 1 FROM jsonb_array_elements(e.past8) h
     WHERE (h->>'date')::date<e.race_date
      AND h->>'surface'=e.surface
      AND ABS((h->>'distance')::integer-e.distance)<=200
      AND (h->>'gap')::numeric<=1.0
      AND (h->>'finish')::integer BETWEEN 2 AND 7
      AND (h->>'final_turn_pos') IS NOT NULL
      AND (h->>'final_turn_pos')::integer-(h->>'finish')::integer>=3
      AND (h->>'final3f_rank') IS NOT NULL
      AND (h->>'final3f_rank')::integer<=5),FALSE) AS late_position_gain,
   COALESCE(EXISTS(
     SELECT 1 FROM jsonb_array_elements(e.past8) h
     WHERE (h->>'date')::date<e.race_date
      AND h->>'surface'=e.surface
      AND ABS((h->>'distance')::integer-e.distance)<=200
      AND (h->>'gap')::numeric<=0.7
      AND (h->>'finish')::integer<=5
      AND (h->>'early_pos') IS NOT NULL
      AND (h->>'early_pos')::integer<=3
      AND h->>'hot_front'='true'),FALSE) AS hot_front_survivor,
   COALESCE(EXISTS(
     SELECT 1 FROM jsonb_array_elements(e.past8) h
     WHERE (h->>'date')::date<e.race_date
      AND h->>'surface'=e.surface
      AND ABS((h->>'distance')::integer-e.distance)<=200
      AND (h->>'gap')::numeric<=0.7
      AND (h->>'finish')::integer BETWEEN 4 AND 8
      AND (h->>'final_turn_pos') IS NOT NULL
      AND (h->>'final_turn_pos')::integer>=8
      AND (h->>'final3f_rank') IS NOT NULL
      AND (h->>'final3f_rank')::integer<=3),FALSE) AS overlooked_closer,
   COALESCE(EXISTS(
     SELECT 1 FROM jsonb_array_elements(e.past8) h
     WHERE (h->>'date')::date<e.race_date
       AND h->>'surface'=e.surface
       AND ABS((h->>'distance')::integer-e.distance)<=200
       AND h->>'measurable_pace'='true'),FALSE) AS any_verified_pace
  FROM hist_sequence e
  WHERE e.race_date BETWEEN DATE '<START_DATE>' AND DATE '<END_DATE>'
)
SELECT f.segment,f.surface,c.late_position_gain,c.hot_front_survivor,
c.overlooked_closer,c.any_verified_pace, f.target_top3,
 f.race_date,f.race_id,f.horse_no,f.horse_name
FROM content c
JOIN private.jra_research_asof_features_v1(DATE '<START_DATE>',DATE '<END_DATE>') f
 ON f.race_id=c.race_id AND f.horse_no=c.horse_no;
