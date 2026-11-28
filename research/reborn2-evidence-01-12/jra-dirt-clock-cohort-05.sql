-- REBORN2 item 05: Tokyo dirt 1400m example, official course route has no turf rail variant.
-- Read-only research benchmark; earlier race dates only, archive checked before target cutoff.
-- Raw class names do not certify age/sex eligibility, weight or track variant. Candidate, not grade.
WITH t AS (
 SELECT source_checked_at AS cutoff FROM public.jra_live_races WHERE race_date='2026-11-23' AND track='東京' AND race_no=12
), c AS (
 SELECT r.id,r.race_date,r.race_no,r.field_size,r.source_ref,r.source_checked_at
 FROM public.jra_lab_races r CROSS JOIN t
 WHERE r.track='東京' AND r.surface='ダート' AND r.distance=1400 AND r.going='良' AND r.class_name='1勝クラス'
 AND r.turn='左' AND r.race_date>=DATE '2024-06-07' AND r.race_date<DATE '2026-06-07'
 AND r.full_field AND r.archive_complete AND r.source_ref IS NOT NULL AND r.source_checked_at<=t.cutoff
), f AS (
 SELECT c.id,c.race_date,c.race_no,c.field_size,c.source_ref,c.source_checked_at,h.horse_no,h.finish,
 CASE WHEN h.time_raw~'^[0-9]+:[0-5][0-9][.][0-9]$' THEN split_part(h.time_raw,':',1)::numeric*60+split_part(h.time_raw,':',2)::numeric END AS sec
 FROM c JOIN public.jra_lab_runs h ON h.race_id=c.id WHERE h.record_role='full_runner' AND h.source_kind='jra_public_reference'
), g AS (
 SELECT id,race_date,race_no,source_ref,source_checked_at,count(*) AS n,percentile_cont(0.5) within group(order by sec) AS field_median,min(sec) FILTER(WHERE finish=1) AS winner_clock
 FROM f GROUP BY id,race_date,race_no,source_ref,source_checked_at,field_size
 HAVING count(*)=field_size AND count(DISTINCT horse_no)=field_size AND count(DISTINCT finish)=field_size AND min(finish)=1 AND max(finish)=field_size AND count(sec)=field_size AND count(*) FILTER(WHERE finish=1 AND sec>0)=1 AND min(sec)>0 AND min(sec)=min(sec) FILTER(WHERE finish=1)
)
SELECT race_date,race_no,source_ref,source_checked_at,n,field_median,winner_clock FROM g ORDER BY race_date,race_no;