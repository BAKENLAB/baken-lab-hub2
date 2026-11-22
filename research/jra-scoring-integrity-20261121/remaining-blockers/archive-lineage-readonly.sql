with target as (
select lr.id live_runner_id,lr.horse_no,lr.horse_name,lr.horse_ref,lr.source_checked_at,rr.race_date,rr.track,rr.race_no,rr.race_key,lr.past_runs
from public.jra_live_races rr join public.jra_live_runners lr on lr.live_race_id=rr.id
where rr.race_date='2026-11-21' and rr.track='京都' and rr.race_no=12 and lr.horse_no=1
)
select t.live_runner_id,t.horse_no,t.horse_name,private.jra_horse_key(t.horse_ref) horse_id,t.source_checked_at,
 t.race_date target_date,t.track target_track,t.race_no target_race_no,h.*,
 (select coalesce(jsonb_agg(jsonb_build_object('run_id',x.id,'race_id',a.id,'horse_id',private.jra_horse_key(x.horse_ref),'horse_name',x.horse_name,'source_ref',a.source_ref,'source_checked_at',a.source_checked_at)), '[]'::jsonb)
 from public.jra_lab_runs x join public.jra_lab_races a on a.id=x.race_id
 where a.race_date=h.prior_date and a.track=h.prior_track and a.surface=h.prior_surface and a.distance=h.prior_distance and x.finish is not distinct from h.finish
 and x.record_role='full_runner' and x.horse_name=t.horse_name
 and private.jra_horse_key(x.horse_ref) is not null and private.jra_horse_key(t.horse_ref) is not null and private.jra_horse_key(x.horse_ref)=private.jra_horse_key(t.horse_ref)) exact_archive_candidates,
 (select coalesce(jsonb_agg(jsonb_build_object('evidence_id',e.id,'fetched_at',e.fetched_at,'html_sha256',e.html_sha256,'source_url',e.source_url,'hash_domain','DECODED_HTML_UTF8')), '[]'::jsonb) from public.jra_html_evidence e where e.race_key=t.race_key) target_card_metadata_only
from target t cross join lateral private.jra_merged_flat_history_v2(t.horse_name,t.horse_ref,t.race_date,t.past_runs,4) h order by h.rn;
