BEGIN READ ONLY;
WITH t AS (
 SELECT id,race_date,source_checked_at,updated_at,(race_date::text||' '||replace(replace(post_time,'時',':'),'分','')||':00+09')::timestamptz post_at FROM public.jra_live_races WHERE race_date='2026-11-23' AND track='東京' AND race_no=12
), c AS (
 SELECT h.horse_no AS no,h.horse_name,substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$') hid,h.source_checked_at cutoff,j,ord,
 substring(j->>'source_ref' from '([0-9]{2})[0-9]{8}/[0-9A-F]{2}$')::int prior_rno
 FROM t JOIN public.jra_live_runners h ON h.live_race_id=t.id CROSS JOIN LATERAL jsonb_array_elements(h.past_runs) WITH ORDINALITY p(j,ord)
 WHERE t.updated_at<t.post_at AND h.updated_at<t.post_at AND h.source_checked_at<t.post_at AND j->>'race_date'<t.race_date::text
), r AS (
 SELECT c.*, a.n AS race_count,a.pre_n,a.exact_ref_n,a.candidates,
 l.n AS local_name_no_n,l.candidates AS local_candidates
 FROM c LEFT JOIN LATERAL (
 SELECT count(*) n,count(*) FILTER(WHERE r.source_checked_at<=c.cutoff AND r.updated_at<=c.cutoff) pre_n,
 count(*) FILTER(WHERE r.source_ref=substring(c.j->>'source_ref' from 'CNAME=(.*)$')) exact_ref_n,
 coalesce(jsonb_agg(jsonb_build_object('race_id',r.id,'race_source_ref',r.source_ref,'same_source_ref',r.source_ref=substring(c.j->>'source_ref' from 'CNAME=(.*)$'),'full_field',r.full_field,'source_checked_at',r.source_checked_at,'updated_at',r.updated_at,'rows',p.rows) ORDER BY r.id),'[]'::jsonb) candidates
 FROM public.jra_lab_races r LEFT JOIN LATERAL (
 SELECT coalesce(jsonb_agg(jsonb_build_object('row_id',h.id,'no',h.horse_no,'id_match',coalesce(substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$')=c.hid,false),'name_match',h.horse_name=c.horse_name,'no_match',h.horse_no::text=c.j->>'horse_no','finish_match',coalesce(h.finish::text=c.j->>'finish',false),'clock_match',coalesce(h.time_raw=c.j->>'time_raw',false),'f3_match',coalesce(h.final3f::text=c.j->>'final3f',false),'has_native_ref',h.horse_ref IS NOT NULL,'updated_at',h.updated_at,'source_kind',h.source_kind,'record_role',h.record_role) ORDER BY h.id),'[]'::jsonb) rows
 FROM public.jra_lab_runs h WHERE h.race_id=r.id AND (h.horse_no::text=c.j->>'horse_no' OR h.horse_name=c.horse_name OR substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$')=c.hid)
 ) p ON true WHERE r.race_date::text=c.j->>'race_date' AND r.track=c.j->>'track' AND r.race_no=c.prior_rno
 ) a ON true LEFT JOIN LATERAL (
 SELECT count(*) n,coalesce(jsonb_agg(jsonb_build_object('archive_row_id',h.id,'race_no',h.race_no,'name_no_match',true,'finish_match',coalesce(h.finish::text=c.j->>'finish',false),'clock_raw_literal_match',coalesce(h.time_raw=c.j->>'time_raw',false),'native_id_and_capture_available',false)),'[]'::jsonb) candidates
 FROM public.horse_runs h WHERE c.no=3 AND c.prior_rno IS NULL AND h.race_date::text=c.j->>'race_date' AND h.track=c.j->>'track' AND h.horse_no::text=c.j->>'horse_no' AND h.horse_name=c.horse_name
 ) l ON true
)
SELECT no,hid,ord,cutoff,j->>'race_date' prior_date,j->>'track' prior_track,j->>'horse_no' prior_no,prior_rno,j->>'source_ref' prior_ref,j->>'finish' IS NOT NULL finish_present,j->>'time_raw' IS NOT NULL clock_present,race_count,pre_n,exact_ref_n,candidates,local_name_no_n,local_candidates FROM r ORDER BY no,ord;
ROLLBACK;
