-- Read-only, historical candidate coverage, not identity proof or verified scoring inputs.
-- Exclude target outcomes, market and legacy ranks; count archive time coverage separately.
with f as (
 select r.race_date,r.track,r.race_no,r.post_time,r.field_size,r.source_checked_at,h.horse_no,h.horse_name,substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$') as candidate_id
 from public.jra_live_races r join public.jra_live_runners h on h.live_race_id=r.id
 where r.race_date=date '2026-11-23' and r.track='東京' and r.race_no=12
), a as (
 select f.horse_no as current_no,r.id,r.race_date,r.track,r.race_no,r.source_ref,r.source_checked_at,
 h.horse_no,h.finish,h.time_raw,h.final3f,h.corner_positions,r.halon_times,
 r.distance,r.going,r.surface,r.class_name,
 count(*) over(partition by f.horse_no,r.race_date,r.track,r.race_no) as key_n
 from f join public.jra_lab_runs h on h.horse_name=f.horse_name
 and substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$')=f.candidate_id
 join public.jra_lab_races r on r.id=h.race_id and r.race_date<f.race_date
 where h.record_role='full_runner' and h.source_kind='jra_public_reference' and r.full_field is true and r.source_ref is not null
), counts as (
 select current_no,count(*) as candidate_rows,count(*) filter(where key_n=1) as unique_rows,
 count(*) filter(where key_n=1 and finish>0 and time_raw ~ '^[0-9]+:[0-5][0-9][.][0-9]$') as clocks,
 count(*) filter(where key_n=1 and finish>0 and final3f>0) as final3fs,
 count(*) filter(where key_n=1 and nullif(trim(corner_positions),'') is not null) as corners,
 count(*) filter(where key_n=1 and nullif(trim(halon_times),'') is not null) as race_laps,
 count(*) filter(where key_n=1 and distance>0 and surface is not null and going is not null and class_name is not null) as conditions,
 count(*) filter(where key_n=1 and source_checked_at is not null and source_checked_at < (date '2026-11-23'::timestamp at time zone 'Asia/Tokyo')) as checked_before_day
 from a group by current_no
)
select f.horse_no,f.horse_name,f.candidate_id,f.field_size,f.post_time,f.source_checked_at,
 coalesce(c.candidate_rows,0) as candidate_rows,coalesce(c.unique_rows,0) as unique_rows,
 coalesce(c.clocks,0) as clocks,coalesce(c.final3fs,0) as final3fs,coalesce(c.corners,0) as corners,
 coalesce(c.race_laps,0) as race_laps,coalesce(c.conditions,0) as conditions,
 coalesce(c.checked_before_day,0) as checked_before_day,
 'CANDIDATE_ONLY' as status
 from f left join counts c on c.current_no=f.horse_no order by f.horse_no;