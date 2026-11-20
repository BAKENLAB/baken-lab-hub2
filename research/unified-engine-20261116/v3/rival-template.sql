-- READ ONLY. Direct opponents in an identity-matched prior, then their first
-- verified archived FLAT followup BEFORE the target. No target results/markets.
with p as (select * from jsonb_to_recordset({{PARAMETERS_JSON}}::jsonb)
 as p(race_key text,horse_no int,horse_id text,prior_index int,prior_id uuid,target_date date,target_post timestamptz))
select p.race_key,p.horse_no,p.prior_index,
 coalesce(jsonb_agg(jsonb_build_object('opponent_id',substring(o.horse_ref from 'pw01dud[0-9]{2}([0-9]{10})/'),'prior_run_id',o.id,'prior_horse_no',o.horse_no,'horse_name',o.horse_name,'followup',f.data)) filter(where o.id is not null),'[]'::jsonb) opponents
from p
join public.jra_lab_races a on a.id=p.prior_id and a.race_date<p.target_date
join public.jra_lab_runs o on o.race_id=a.id and o.record_role='full_runner'
 and substring(o.horse_ref from 'pw01dud[0-9]{2}([0-9]{10})/')<>p.horse_id
left join lateral (
 select jsonb_build_object('race_id',b.id,'run_id',s.id,'race_date',b.race_date,'track',b.track,'race_no',b.race_no,'surface',b.surface,'distance',b.distance,'race_type',b.race_type,'finish',s.finish,'field_size',b.field_size,'source_ref',b.source_ref,'source_checked_at',b.source_checked_at,'created_at',b.created_at,'updated_at',b.updated_at) data
 from public.jra_lab_runs s join public.jra_lab_races b on b.id=s.race_id
 where s.horse_ref=o.horse_ref and substring(s.horse_ref from 'pw01dud[0-9]{2}([0-9]{10})/')=substring(o.horse_ref from 'pw01dud[0-9]{2}([0-9]{10})/')
 and s.horse_name=o.horse_name and s.record_role='full_runner' and b.race_type='平地'
 and b.race_date>a.race_date and b.race_date<p.target_date and b.source_checked_at<p.target_post and b.created_at<p.target_post and b.updated_at<p.target_post
 order by b.race_date,b.track,b.race_no,b.id,s.id limit 1
) f on true
group by p.race_key,p.horse_no,p.prior_index
order by p.race_key,p.horse_no,p.prior_index;
