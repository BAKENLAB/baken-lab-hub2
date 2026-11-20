-- READ ONLY; at most5 target races. Inputs contain no target outcomes/markets.
with params as materialized (
 select * from jsonb_to_recordset({{PARAMETERS_JSON}}::jsonb)
 as p(target_date date,target_track text,target_no int,target_horse_no int,target_horse_name text,target_horse_id text,target_post timestamptz,target_frozen timestamptz,original_checked timestamptz,original_updated timestamptz,priors jsonb)
), live_match as materialized (
 select p.*,lr.id live_runner_id,lr.past_runs live_past,
 jsonb_build_object('draw',lr.draw,'sex_age',lr.sex_age,'weight_carried',lr.weight_carried,'body_weight',lr.body_weight,'body_weight_diff',lr.body_weight_diff,'equipment',lr.equipment,'jockey',lr.jockey,'trainer',lr.trainer) live_attributes
 from params p left join public.jra_live_races l on (l.race_date,l.track,l.race_no)=(p.target_date,p.target_track,p.target_no)
 left join public.jra_live_runners lr on lr.live_race_id=l.id and lr.horse_no=p.target_horse_no and lr.horse_name=p.target_horse_name
 and substring(lr.horse_ref from 'pw01dud[0-9]{2}([0-9]{10})/')=p.target_horse_id
 and lr.source_checked_at=p.original_checked and lr.updated_at=p.original_updated
), inputs as materialized (
 select p.*,q.value->'baseline' prior,(q.value->>'index')::int prior_index,q.value->>'cname' prior_cname,
 (select jsonb_agg(h) from jsonb_array_elements(coalesce(p.live_past,'[]'::jsonb)) h where
  (select jsonb_object_agg(k,h->k) from jsonb_object_keys(q.value->'baseline') k)=q.value->'baseline') raw_matches
 from live_match p cross join lateral jsonb_array_elements(p.priors) q(value)
)
select i.target_date,i.target_track,i.target_no,i.target_horse_no,i.target_horse_id,i.prior_index,
 i.live_runner_id is not null as baseline_live_version_matched,i.live_attributes,
 card.data as card_attributes,card.field_fetched_at,
 case when jsonb_array_length(i.raw_matches)=1 then (i.raw_matches->0->>'horse_no')::int end expected_prior_no,
 case when jsonb_array_length(i.raw_matches)=1 then i.raw_matches->0->>'race_class_detail' end prior_class_detail,
 coalesce(m.candidates,'[]'::jsonb) candidates
from inputs i
left join lateral (
 select jsonb_build_object('horse_no',x->'horse_no','horse_name',x->'horse_name','horse_ref',x->'horse_ref','draw',x->'draw','sex_age',x->'sex_age','weight_carried',x->'weight_carried','body_weight',x->'body_weight','body_weight_diff',x->'body_weight_diff','equipment',x->'equipment','jockey',x->'jockey','trainer',x->'trainer','going',r.field_payload->'race'->'going','weather',r.field_payload->'race'->'weather','layout',r.field_payload->'race'->'course_layout') data,r.field_fetched_at
 from public.official_races r cross join lateral jsonb_array_elements(r.field_payload->'runners') x
 where (r.race_date,r.track,r.race_no,r.circuit)=(i.target_date,i.target_track,i.target_no,'JRA') and (x->>'horse_no')::int=i.target_horse_no
 and x->>'horse_name'=i.target_horse_name and substring(x->>'horse_ref' from 'pw01dud[0-9]{2}([0-9]{10})/')=i.target_horse_id and r.field_fetched_at<i.target_post
) card on true
left join lateral (
 select jsonb_agg(jsonb_build_object(
  'race_id',ar.id,'race_date',ar.race_date,'track',ar.track,'race_no',ar.race_no,'race_type',ar.race_type,
  'surface',ar.surface,'distance',ar.distance,'going',ar.going,'weather',ar.weather,'class_name',ar.class_name,'field_size',ar.field_size,'layout',ar.course_layout,'halon_times',ar.halon_times,'source_ref',ar.source_ref,'source_kind',ar.source_kind,'source_checked_at',ar.source_checked_at,'created_at',ar.created_at,'updated_at',ar.updated_at,
  'full_field',ar.full_field,'archive_complete',ar.archive_complete,
  'run_id',s.id,'horse_no',s.horse_no,'horse_name',s.horse_name,'horse_ref',s.horse_ref,'finish',s.finish,'final3f',s.final3f,'final3f_rank',s.final3f_rank,'corners',s.corner_positions,'source_runner_ref',s.source_ref,
  'weight_carried',s.weight_carried,'body_weight',s.body_weight,'body_weight_diff',s.body_weight_diff,'equipment',s.equipment,'sex_age',s.sex_age,
  'field_rows',fld.n,'field_final3f_count',fld.timed,'calculated_final3f_rank',fld.last_rank,
  'horse_runs_race_types',hr.types
 )) candidates
 from public.jra_lab_races ar join public.jra_lab_runs s on s.race_id=ar.id and s.record_role='full_runner'
 left join lateral (select count(*) n,count(x.final3f) timed,1+count(*) filter(where x.final3f<s.final3f) last_rank from public.jra_lab_runs x where x.race_id=ar.id and x.record_role='full_runner') fld on true
 left join lateral (select jsonb_agg(distinct x.race_type) filter(where x.race_type is not null) types from public.horse_runs x
  where (x.race_date,x.track,x.race_no,x.horse_no)=(ar.race_date,ar.track,ar.race_no,s.horse_no) and x.horse_name=s.horse_name and x.surface=ar.surface and x.distance=ar.distance and x.finish=s.finish) hr on true
 where ar.race_date=(i.prior->>'race_date')::date and ar.track=i.prior->>'track'
 and ar.surface=i.prior->>'surface' and ar.distance=(i.prior->>'distance')::int and ar.race_date<i.target_date
 and regexp_replace(ar.source_ref,'^.*[?]CNAME=','')=i.prior_cname
 and substring(s.horse_ref from 'pw01dud[0-9]{2}([0-9]{10})/')=i.target_horse_id
) m on true
order by i.target_date,i.target_track,i.target_no,i.target_horse_no,i.prior_index;
