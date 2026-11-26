-- Read-only race-level laps plus exact-ID runner corners. No market or target results.
WITH b AS (-- Read-only historical archive expansion; no market/target result/legacy score.
-- A matched archive row is a research witness, not a fresh official replay.
WITH target AS (
 SELECT id,race_date,track,race_no,source_checked_at,(race_date::text||' '||replace(replace(post_time,'時',':'),'分','')||':00+09')::timestamptz AS post_at
 FROM public.jra_live_races WHERE race_date='2026-11-23' AND track='東京' AND race_no=12
), roster AS (
 SELECT t.*,h.horse_no AS current_no,h.horse_name,h.horse_ref,h.source_checked_at AS runner_checked,
 substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$') AS horse_id
 FROM target t JOIN public.jra_live_runners h ON h.live_race_id=t.id
 WHERE t.source_checked_at<t.post_at AND h.source_checked_at<t.post_at
), candidates AS (
 SELECT f.current_no,f.horse_id,f.horse_ref,f.runner_checked,f.post_at,r.id AS prior_id,r.race_date,r.track,r.race_no,r.surface,r.distance,r.going,r.class_name,r.course_layout,r.turn,r.field_size,r.archive_complete,r.source_ref,r.source_checked_at,
 h.horse_no AS prior_no,h.horse_ref AS prior_horse_ref,h.finish,h.time_raw,h.final3f,h.margin,
 count(*) over(partition by f.current_no,r.race_date,r.track,r.race_no) AS duplicate_n
 FROM roster f JOIN public.jra_lab_runs h ON h.horse_name=f.horse_name AND substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$')=f.horse_id
 JOIN public.jra_lab_races r ON h.race_id=r.id AND r.race_date<f.race_date
 WHERE r.full_field AND h.record_role='full_runner' AND h.source_kind='jra_public_reference' AND r.source_ref IS NOT NULL AND r.source_checked_at<=f.runner_checked
), f AS (
 SELECT h.race_id,h.horse_no,h.finish,h.final3f,
 CASE WHEN h.time_raw~'^[0-9]+:[0-5][0-9][.][0-9]$' THEN split_part(h.time_raw,':',1)::numeric*60+split_part(h.time_raw,':',2)::numeric END AS sec
 FROM (SELECT DISTINCT prior_id FROM candidates) p JOIN public.jra_lab_runs h ON h.race_id=p.prior_id WHERE h.record_role='full_runner' AND h.source_kind='jra_public_reference'
), ordered AS (
 SELECT f.*,lag(sec) OVER(PARTITION BY race_id ORDER BY finish,horse_no) AS previous_clock FROM f
), quality AS (
 SELECT race_id,count(*) AS n,count(DISTINCT horse_no) AS unique_n,count(DISTINCT finish) AS distinct_finish,min(finish) AS min_finish,max(finish) AS max_finish,count(sec) AS clock_n,count(*) FILTER(WHERE sec<=0 OR sec<previous_clock) AS bad_clock_n,min(sec) FILTER(WHERE finish=1) AS winner_clock,
 count(*) FILTER(WHERE final3f>0 AND final3f<sec) AS f3_n,percentile_cont(.5) within group(order by sec) AS clock_median,percentile_cont(.5) within group(order by final3f) AS f3_median FROM ordered GROUP BY race_id
)
SELECT c.current_no,c.horse_id,c.horse_ref,c.prior_horse_ref,c.runner_checked,c.post_at,c.race_date,c.track,c.race_no,c.surface,c.distance,c.going,c.class_name,c.course_layout,c.turn,c.field_size,c.archive_complete,c.source_ref,c.source_checked_at,c.prior_no,c.finish,c.time_raw,c.final3f,c.margin,c.duplicate_n,q.n,q.unique_n,q.distinct_finish,q.min_finish,q.max_finish,q.clock_n,q.bad_clock_n,q.winner_clock,q.f3_n,q.clock_median,q.f3_median,
 (SELECT min(z.sec) FROM f z WHERE z.race_id=c.prior_id AND z.finish=c.finish+1) AS next_clock,
 (SELECT count(*) FROM f z WHERE z.race_id=c.prior_id AND z.final3f<c.final3f)+1 AS f3_rank
 FROM candidates c JOIN quality q ON q.race_id=c.prior_id ORDER BY c.current_no,c.race_date DESC,c.race_no)
SELECT b.current_no,b.horse_id,b.horse_ref,b.prior_horse_ref,b.runner_checked,b.post_at,b.race_date,b.track,b.race_no,b.surface,b.distance,b.going,b.class_name,b.field_size,b.source_ref,b.source_checked_at,b.prior_no,b.finish,b.final3f,b.time_raw,b.duplicate_n,b.n,b.unique_n,b.distinct_finish,b.min_finish,b.max_finish,b.clock_n,b.bad_clock_n,b.winner_clock,b.f3_n,b.f3_median,b.f3_rank,r.halon_times,r.race_final3f,h.corner_positions,h.early_pos,h.final_turn_pos
FROM b JOIN public.jra_lab_races r ON r.source_ref=b.source_ref AND r.race_date=b.race_date AND r.track=b.track AND r.race_no=b.race_no
JOIN public.jra_lab_runs h ON h.race_id=r.id AND h.horse_no=b.prior_no AND h.horse_ref=b.prior_horse_ref AND h.record_role='full_runner' AND h.source_kind='jra_public_reference'
ORDER BY b.current_no,b.race_date DESC,b.race_no;