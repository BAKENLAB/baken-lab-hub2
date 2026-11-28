-- Research only: verified identity witness keys, archive or prior settlement candidates,
-- full-field and clock checks before computing rounded time gaps. No target outcome, market, grades.
WITH snap AS (
 SELECT * FROM private.lab_preclaim_evidence_snapshots_v1 WHERE circuit='LOCAL'
 AND race_date=DATE '2026-11-22' AND track='佐賀' AND race_no=8 AND captured_at<official_post_time AND as_of<official_post_time
 ORDER BY captured_at DESC LIMIT 1
), e AS (
 SELECT s.as_of,j->>'horseNo' AS current_no,j->>'horseName' AS horse_name,j->>'pastHorseNo' AS prior_no,
 (j->'pastRace'->>'raceDate')::date AS prior_date,j->'pastRace'->>'track' AS prior_track,
 (j->'pastRace'->>'raceNo')::int AS prior_race_no
 FROM snap s CROSS JOIN LATERAL jsonb_array_elements(s.evidence->'packet'->'evidence') j
 WHERE j->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT' AND j->>'identityVerifiedBy'='OFFICIAL_HORSE_REF'
 AND j->'pastRace'->>'raceDate'<s.race_date::text AND (j->>'sourceCheckedAt')::timestamptz<=s.as_of
), prior_keys AS (SELECT DISTINCT prior_date,prior_track,prior_race_no FROM e),
 a AS (
 SELECT 'ARCHIVE_CANDIDATE' AS route,h.race_date AS d,h.track,h.race_no,h.horse_no,h.horse_name,h.finish,
 CASE WHEN h.finish>0 AND h.time_raw ~ '^[0-9]{1,2}[0-5][0-9][0-9]$'
 THEN left(h.time_raw,length(h.time_raw)-3)::numeric*60+right(h.time_raw,3)::numeric/10 END AS sec,
 h.field_size::int AS declared_count
 FROM prior_keys k JOIN public.horse_runs h ON h.race_date=k.prior_date AND h.track=k.prior_track AND h.race_no=k.prior_race_no
), b AS (
 SELECT 'SETTLEMENT_CANDIDATE' AS route,o.race_date AS d,o.track,o.race_no,
 (f->>'horse_no')::int AS horse_no,f->>'horse_name' AS horse_name,(f->>'finish')::int AS finish,
 CASE WHEN f->>'time' ~ '^[0-9]+:[0-5][0-9][.][0-9]$' THEN split_part(f->>'time',':',1)::numeric*60+split_part(f->>'time',':',2)::numeric END AS sec,
 CASE WHEN jsonb_typeof(r.field_payload->'runners')='array' AND r.field_fetched_at<=s.as_of
 THEN jsonb_array_length(r.field_payload->'runners') END AS declared_count
 FROM prior_keys k JOIN public.official_results o ON o.circuit='LOCAL' AND o.race_date=k.prior_date AND o.track=k.prior_track AND o.race_no=k.prior_race_no
 CROSS JOIN snap s JOIN public.official_races r ON r.circuit='LOCAL' AND r.race_date=o.race_date AND r.track=o.track AND r.race_no=o.race_no
 CROSS JOIN LATERAL jsonb_array_elements(o.result->'finishers') f
 WHERE o.settled_at<=s.as_of AND f->>'finish' ~ '^[0-9]+$' AND f->>'horse_no' ~ '^[0-9]+$'
), all_rows AS (SELECT * FROM a UNION ALL SELECT * FROM b),
 quality AS (
 SELECT route,d,track,race_no,count(*) AS n,count(distinct horse_no) AS uniq_n,count(distinct declared_count) AS count_kinds,max(declared_count) AS expected,
 count(*) filter(where finish=1) AS winner_n,min(sec) filter(where finish=1) AS winner_sec,
 count(*) filter(where finish>0 and sec is null) AS missing
 FROM all_rows GROUP BY 1,2,3,4
)
SELECT e.current_no,e.prior_date,e.prior_track,e.prior_race_no,f.route,
 CASE WHEN q.n=q.uniq_n AND q.n=q.expected AND q.count_kinds=1 AND q.winner_n=1 AND q.missing=0 AND f.finish>0 AND f.sec>=q.winner_sec THEN f.sec-q.winner_sec END AS gap_winner,
 CASE WHEN q.n=q.uniq_n AND q.n=q.expected AND q.count_kinds=1 AND q.winner_n=1 AND q.missing=0 AND f.finish>0 AND f.sec>=q.winner_sec AND n.nn=1 AND n.ss>=f.sec THEN n.ss-f.sec END AS gap_next,
 'CANDIDATE_ONLY' AS status
FROM e JOIN all_rows f ON f.d=e.prior_date AND f.track=e.prior_track AND f.race_no=e.prior_race_no AND f.horse_no::text=e.prior_no AND f.horse_name=e.horse_name
JOIN quality q USING(route,d,track,race_no)
LEFT JOIN LATERAL (SELECT count(*) AS nn,min(z.sec) AS ss FROM all_rows z WHERE z.route=f.route AND z.d=f.d AND z.track=f.track AND z.race_no=f.race_no
 AND z.finish=(SELECT min(y.finish) FROM all_rows y WHERE y.route=f.route AND y.d=f.d AND y.track=f.track AND y.race_no=f.race_no AND y.finish>f.finish)) n ON true
ORDER BY e.current_no::int,e.prior_date DESC,f.route;