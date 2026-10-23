-- LAB REBORN v06: pre-target recent historical race clock packet.
-- Inputs: <TARGET_DATE>, <TARGET_TRACK>, <TARGET_RACE_NO>.
-- Read only. Historical previous starts strictly < target date.
-- Canonical 10-digit JRA horse code matches live vs archived URLs.
WITH target AS (
 SELECT r.race_date,r.track,r.race_no,r.race_name,
  x.horse_no,x.horse_name,x.horse_ref,
  substring(x.horse_ref FROM '([0-9]{10})/') horse_code
 FROM public.jra_live_races r JOIN public.jra_live_runners x
  ON x.live_race_id=r.id
 WHERE r.race_date=DATE '<TARGET_DATE>'
  AND r.track='<TARGET_TRACK>' AND r.race_no=<TARGET_RACE_NO>
), enriched AS (
 SELECT t.*,COALESCE(h.prior_runs,'[]'::jsonb) history
 FROM target t
 LEFT JOIN LATERAL (
  SELECT jsonb_agg(
   jsonb_build_object(
    'date',historical.race_date,'track',historical.track,
    'race_ref',historical.race_key,
    'surface',historical.surface,'distance',historical.distance,
    'going',historical.going,'segment',
       private.jra_model_segment(historical.class_name,historical.race_name),
    'horse_ref',historical.horse_ref,
    'finish',historical.finish,'runner_time',historical.time_raw,
    'winner_time',historical.winner_time,
    'halon_times',historical.halon_times,
    'final3f',historical.final3f,
    'early_pos',historical.early_pos,
    'final_turn_pos',historical.final_turn_pos
   ) ORDER BY historical.race_date DESC,historical.track,historical.race_no DESC
  ) prior_runs
  FROM (
    SELECT r.race_date,r.track,r.race_no,r.race_key,r.surface,
      r.distance,r.going,r.class_name,r.race_name,r.halon_times,
      x.horse_ref,x.finish,x.time_raw,x.final3f,x.early_pos,x.final_turn_pos,
      winner.time_raw winner_time
    FROM public.jra_lab_runs x
    JOIN public.jra_lab_races r ON r.id=x.race_id
    -- Dead heats can have two finish=1 records. A direct JOIN doubles
    -- every runner in that historical race; one winner clock per race only.
    LEFT JOIN LATERAL (
      SELECT MIN(w.time_raw) AS time_raw
      FROM public.jra_lab_runs w
      WHERE w.race_id=r.id AND w.record_role='full_runner'
        AND w.finish=1
    ) winner ON TRUE
    WHERE t.horse_code IS NOT NULL
      AND substring(x.horse_ref FROM '([0-9]{10})/')=t.horse_code
      AND x.record_role='full_runner' AND x.finish IS NOT NULL
      AND r.race_date<t.race_date AND r.race_date>=DATE '2023-01-01'
      AND r.surface IN('芝','ダート')
      AND COALESCE(r.race_type,'平地')<>'障害'
    ORDER BY r.race_date DESC,r.track,r.race_no DESC
    LIMIT 8
  ) historical
 ) h ON TRUE
)
SELECT race_date,track,race_no,race_name,
  COUNT(*) field_size,
  jsonb_agg(jsonb_build_object('horse_no',horse_no,'horse_name',horse_name,
     'horse_ref',horse_ref,'history',history) ORDER BY horse_no) runners
FROM enriched GROUP BY race_date,track,race_no,race_name;