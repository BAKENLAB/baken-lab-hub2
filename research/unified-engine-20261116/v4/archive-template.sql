-- SELECT ONLY. One cohort batch <=5R. No target result, odds or popularity.
with p as (select * from jsonb_to_recordset({{PARAMETERS_JSON}}::jsonb)
 as p(race_key text,horse_id text,horse_no int,horse_name text,target_date date,post_time timestamptz)), matched as (
 select p.*,a.id race_id,s.id run_id,a.race_date,a.track,a.race_no,a.surface,a.distance,a.race_type,a.class_name,a.field_size,a.going,a.weather,a.course_layout,a.halon_times,a.full_field,a.source_ref,a.source_checked_at,a.created_at,a.updated_at,
 s.horse_name archive_horse_name,s.horse_ref,s.horse_no prior_horse_no,s.finish,s.final3f,s.final3f_rank,s.corner_positions,s.weight_carried,s.body_weight,s.body_weight_diff,s.sex_age,s.equipment,
 row_number() over(partition by p.race_key,p.horse_no order by a.race_date desc,a.race_no desc,a.id,s.id) selection_no
 from p join public.jra_lab_runs s on substring(s.horse_ref from 'pw01dud[0-9]{2}([0-9]{10})/')=p.horse_id and s.horse_name=p.horse_name and s.record_role='full_runner'
 join public.jra_lab_races a on a.id=s.race_id and a.race_type='平地' and a.race_date<p.target_date and a.race_date>=p.target_date-540
 and a.source_checked_at<p.post_time and a.created_at<p.post_time and a.updated_at<p.post_time
 where s.finish between 1 and a.field_size
)
select m.*,f.field_rows,f.timed_rows,f.calculated_final3f_rank
from matched m
left join lateral (select count(*) field_rows,count(x.final3f) timed_rows,1+count(*) filter(where x.final3f<m.final3f) calculated_final3f_rank from public.jra_lab_runs x where x.race_id=m.race_id and x.record_role='full_runner') f on true
where selection_no<=5 order by race_key,horse_no,selection_no;
