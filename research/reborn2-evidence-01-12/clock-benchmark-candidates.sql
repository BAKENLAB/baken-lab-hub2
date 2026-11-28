-- REBORN 2 item 05: research-only coarse benchmark candidates.
-- Fixed demonstration cutoff and courses; no target race results, market, scores or writes.
-- LOCAL archive has no ingestion timestamp or normalized class: never a production benchmark.
WITH raw AS (
 SELECT 'JRA' AS circuit,r.race_key AS race_key,r.race_date,r.track,r.surface,r.distance,r.going,
 COALESCE(NULLIF(r.course_layout,''),'LAYOUT_UNKNOWN') AS layout_key,
 COALESCE(NULLIF(r.class_name,''),'CLASS_UNKNOWN') AS class_key,
 r.field_size::int AS field_size,h.horse_no,h.finish,
 CASE WHEN h.finish>0 AND h.time_raw ~ '^[0-9]+:[0-5][0-9][.][0-9]$'
 THEN split_part(h.time_raw,':',1)::numeric*60+split_part(h.time_raw,':',2)::numeric END AS seconds
 FROM public.jra_lab_races r JOIN public.jra_lab_runs h ON h.race_id=r.id
 WHERE r.track='中山' AND r.surface='芝' AND r.distance=2500 AND r.going='稍重'
 AND r.race_date<DATE '2026-11-26' AND r.source_checked_at<'2026-11-26T00:00:00+09:00'::timestamptz
 AND r.full_field IS TRUE AND r.source_ref IS NOT NULL AND h.record_role='full_runner' AND h.source_kind='jra_public_reference'
 UNION ALL
 SELECT 'LOCAL',h.race_id,h.race_date,h.track,h.surface,h.distance,h.going,
 'LAYOUT_UNKNOWN','CLASS_UNNORMALIZED',h.field_size::int,h.horse_no,h.finish,
 CASE WHEN h.finish>0 AND h.time_raw ~ '^[0-9]{1,2}[0-5][0-9][0-9]$'
 THEN left(h.time_raw,length(h.time_raw)-3)::numeric*60+right(h.time_raw,3)::numeric/10 END
 FROM public.horse_runs h
 WHERE h.track='船橋' AND h.surface='ダート' AND h.distance=1600 AND h.going='良'
 AND h.race_date<DATE '2026-11-26'
), race_clock AS (
 SELECT circuit,race_key,race_date,track,surface,distance,going,layout_key,class_key,
 min(seconds) FILTER(WHERE finish=1) AS winning_seconds,
 count(*) AS n,count(DISTINCT horse_no) AS uniq_n,count(DISTINCT field_size) AS count_kinds,
 max(field_size) AS declared_n,count(*) FILTER(WHERE finish=1) AS wins,
 count(*) FILTER(WHERE finish>0 AND seconds IS NULL) AS missing_times
 FROM raw GROUP BY 1,2,3,4,5,6,7,8,9
), good AS (
 SELECT * FROM race_clock WHERE n=uniq_n AND n=declared_n AND count_kinds=1 AND wins=1 AND missing_times=0 AND winning_seconds>0
)
SELECT circuit,track,surface,distance,going,layout_key,class_key,count(*) AS races,
 min(race_date)::text AS first_race,max(race_date)::text AS last_race,
 round(percentile_cont(.25) within group(order by winning_seconds)::numeric,2) AS q25_seconds,
 round(percentile_cont(.5) within group(order by winning_seconds)::numeric,2) AS median_seconds,
 round(percentile_cont(.75) within group(order by winning_seconds)::numeric,2) AS q75_seconds,
 'RESEARCH_CANDIDATE_NO_GRADING' AS status
FROM good GROUP BY 1,2,3,4,5,6,7 ORDER BY 1,8 DESC,7;