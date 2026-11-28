-- REBORN 2 detailed JRA research reader. Explicit historical target; no target results, market or old scores.
-- Registration token is a candidate identity; this SELECT never grants scoring eligibility.
WITH target AS (
 SELECT r.id,r.race_date,r.track,r.race_no,r.source_checked_at AS card_checked_at
 FROM public.jra_live_races r WHERE r.race_date=DATE '2026-11-23' AND r.track='東京' AND r.race_no=12
), roster AS (
 SELECT t.*,h.horse_no AS current_no,h.horse_name,
 substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$') AS id_candidate
 FROM target t JOIN public.jra_live_runners h ON h.live_race_id=t.id
), candidates AS (
 SELECT f.current_no,f.horse_name,f.id_candidate,r.id AS race_id,r.race_date,r.track,r.race_no,
 r.surface,r.distance,r.going,r.class_name,r.halon_times,r.source_ref,r.source_checked_at,h.horse_no AS prior_no,
 h.finish,h.time_raw,h.final3f,h.corner_positions,
 count(*) over(partition by f.current_no,r.race_date,r.track,r.race_no) AS duplicate_n
 FROM roster f JOIN public.jra_lab_runs h ON h.horse_name=f.horse_name
 AND substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$')=f.id_candidate
 JOIN public.jra_lab_races r ON h.race_id=r.id AND r.race_date<f.race_date
 WHERE r.full_field IS TRUE AND h.record_role='full_runner' AND h.source_kind='jra_public_reference'
 AND r.source_ref IS NOT NULL AND r.source_checked_at<=f.card_checked_at
), ids AS (SELECT DISTINCT race_id FROM candidates WHERE duplicate_n=1),
 full_result AS (
 SELECT h.race_id,h.horse_no,h.finish,
 CASE WHEN h.finish>0 AND h.time_raw ~ '^[0-9]+:[0-5][0-9][.][0-9]$'
 THEN split_part(h.time_raw,':',1)::numeric*60+split_part(h.time_raw,':',2)::numeric END AS seconds
 FROM ids JOIN public.jra_lab_runs h USING(race_id)
 WHERE h.record_role='full_runner' AND h.source_kind='jra_public_reference'
), quality AS (
 SELECT f.race_id,count(*) AS n,count(distinct horse_no) AS unique_n,
 count(*) FILTER(WHERE finish=1) AS winners,min(seconds) FILTER(WHERE finish=1) AS winner_seconds,
 count(*) FILTER(WHERE finish>0 AND seconds IS NULL) AS missing_times
 FROM full_result f GROUP BY f.race_id
), chosen AS (
 SELECT c.*, row_number() over(partition by current_no order by race_date desc,track,race_no desc) AS sequence
 FROM candidates c WHERE duplicate_n=1
)
SELECT c.current_no,c.horse_name,c.race_date,c.track,c.race_no,c.prior_no,c.source_ref,c.source_checked_at,
 q.winner_seconds AS lap_winner_seconds,c.finish,f.seconds AS elapsed_seconds,c.final3f,c.corner_positions,c.halon_times,c.distance,c.surface,c.going,c.class_name,
 CASE WHEN q.n=q.unique_n AND q.n=r.field_size AND q.winners=1 AND q.missing_times=0 AND f.seconds>=q.winner_seconds
 THEN f.seconds-q.winner_seconds END AS gap_winner,
 CASE WHEN q.n=q.unique_n AND q.n=r.field_size AND q.winners=1 AND q.missing_times=0 AND n.next_n=1 AND n.next_seconds>=f.seconds
 THEN n.next_seconds-f.seconds END AS gap_next,
 'CANDIDATE_ONLY' AS identity_status
FROM chosen c JOIN public.jra_lab_races r ON c.race_id=r.id
JOIN quality q ON q.race_id=c.race_id JOIN full_result f ON f.race_id=c.race_id AND f.horse_no=c.prior_no
LEFT JOIN LATERAL (SELECT count(*) AS next_n,min(z.seconds) AS next_seconds FROM full_result z WHERE z.race_id=c.race_id AND z.finish=(SELECT min(y.finish) FROM full_result y WHERE y.race_id=c.race_id AND y.finish>c.finish)) n ON true
ORDER BY c.current_no,c.sequence;
