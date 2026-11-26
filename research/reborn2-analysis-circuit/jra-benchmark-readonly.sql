-- Retrospective research only. The calendar split is not proof of historical publication.
WITH races AS MATERIALIZED (
 SELECT id,race_date,track,race_no,turn,surface,distance,going,class_name,course_layout,field_size,source_ref,
 jsonb_build_array(track,turn,surface,distance,going,class_name,course_layout) AS condition
 FROM public.jra_lab_races
 WHERE race_date>=DATE '2024-01-01' AND race_date<DATE '2026-09-01'
 AND full_field AND source_ref IS NOT NULL AND surface IN ('芝','ダート')
 AND distance>0 AND turn IS NOT NULL AND going IS NOT NULL AND class_name IS NOT NULL
), rows AS MATERIALIZED (
 SELECT r.*,h.horse_no,h.finish,h.final3f,
 CASE WHEN h.time_raw~'^[0-9]+:[0-5][0-9][.][0-9]$'
 THEN split_part(h.time_raw,':',1)::numeric*60+split_part(h.time_raw,':',2)::numeric END elapsed
 FROM races r JOIN public.jra_lab_runs h ON h.race_id=r.id
 WHERE h.record_role='full_runner' AND h.source_kind='jra_public_reference'
), complete AS (
 SELECT id FROM rows GROUP BY id,field_size
 HAVING count(*)=field_size AND count(distinct horse_no)=field_size
 AND count(distinct finish)=field_size AND min(finish)=1 AND max(finish)=field_size
 AND count(*) FILTER(WHERE elapsed>0 AND final3f>0 AND final3f<elapsed)=field_size
 AND array_agg(elapsed ORDER BY finish)=array_agg(elapsed ORDER BY elapsed)
), eligible AS MATERIALIZED (
 SELECT rows.* FROM rows JOIN complete USING(id)
), benchmark AS (
 SELECT condition,count(distinct id) races,count(*) runners,
 percentile_cont(ARRAY[.25,.5,.75]) WITHIN GROUP(ORDER BY elapsed) finisher_elapsed,
 percentile_cont(ARRAY[.25,.5,.75]) WITHIN GROUP(ORDER BY elapsed) FILTER(WHERE finish=1) winner_elapsed,
 percentile_cont(ARRAY[.25,.5,.75]) WITHIN GROUP(ORDER BY final3f) individual_final3f
 FROM eligible WHERE race_date<DATE '2026-07-01' GROUP BY condition
), holdout AS (
 SELECT e.*,e.elapsed-b.finisher_elapsed[2] elapsed_residual,e.final3f-b.individual_final3f[2] final3f_residual
 FROM eligible e JOIN benchmark b USING(condition)
 WHERE e.race_date>=DATE '2026-07-01'
), sample AS (
 SELECT race_date,track,race_no,count(*) runners,
 round(min(elapsed_residual)::numeric,3) min_elapsed_difference,
 round(max(elapsed_residual)::numeric,3) max_elapsed_difference,
 round(min(final3f_residual)::numeric,3) min_final3f_difference,
 round(max(final3f_residual)::numeric,3) max_final3f_difference
 FROM holdout GROUP BY race_date,track,race_no ORDER BY race_date,track,race_no LIMIT 6
)
SELECT (SELECT count(*) FROM benchmark) groups,
 (SELECT sum(races) FROM benchmark) baseline_races,(SELECT sum(runners) FROM benchmark) baseline_runners,
 (SELECT count(distinct id) FROM eligible WHERE race_date>=DATE '2026-07-01') eligible_holdout_races,
 (SELECT count(distinct id) FROM holdout) matched_holdout_races,(SELECT count(*) FROM holdout) matched_holdout_runners,
 (SELECT count(distinct track) FROM holdout) holdout_tracks,
 (SELECT jsonb_agg(to_jsonb(sample)) FROM sample) sample,
 false benchmark_admitted;
