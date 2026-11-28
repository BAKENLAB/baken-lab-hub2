-- Read-only LOCAL packet candidate: never substitute unverified clocks for official witness.
WITH snap AS (
 SELECT * FROM private.lab_preclaim_evidence_snapshots_v1
 WHERE circuit='LOCAL' AND race_date=DATE '2026-11-22' AND track='佐賀' AND race_no=8
 AND captured_at<official_post_time AND as_of<official_post_time
 ORDER BY captured_at DESC LIMIT 1
), e AS (
 SELECT s.id,s.race_date AS target_date,s.as_of,j,
 j->>'horseNo' AS current_no,j->>'horseName' AS horse_name,j->>'pastHorseNo' AS prior_no,
 j->'pastRace'->>'raceDate' AS prior_date,j->'pastRace'->>'track' AS prior_track,
 j->'pastRace'->>'raceNo' AS prior_race_no,
 count(*) over(partition by j->>'horseNo',j->'pastRace',j->>'pastHorseNo') AS duplicate_n
 FROM snap s CROSS JOIN LATERAL jsonb_array_elements(s.evidence->'packet'->'evidence') j
 WHERE j->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT' AND j->>'identityVerifiedBy'='OFFICIAL_HORSE_REF'
 AND j->'pastRace'->>'raceDate'<s.race_date::text AND (j->>'sourceCheckedAt')::timestamptz<=s.as_of
), l AS (
 SELECT s.id,j FROM snap s CROSS JOIN LATERAL jsonb_array_elements(s.evidence->'packet'->'officialRaceLaps') j
 WHERE j->>'status'='VERIFIED_RACE_LEVEL_LAPS' AND j->>'finish_time_reconciled'='true'
 AND j->>'individual_horse_sectionals'='false' AND j->'pastRace'->>'raceDate'<s.race_date::text
 AND (j->>'sourceCheckedAt')::timestamptz<=s.as_of
)
SELECT e.current_no,e.horse_name,e.prior_no,e.prior_date,e.prior_track,e.prior_race_no,
 e.j->>'sourceRef' AS corner_source_ref,e.j->>'sourceCheckedAt' AS corner_checked_at,
 e.j->>'horseRef' AS horse_ref,e.j->'corners' AS corners,
 CASE WHEN la.n=1 THEN la.packet END AS verified_race_lap_candidate,
 CASE WHEN a.n=1 THEN a.packet END AS historical_archive_candidate,
 CASE WHEN b.n=1 THEN b.packet END AS settlement_candidate,
 'PARTIAL_RESEARCH_ONLY' AS status
FROM e
LEFT JOIN LATERAL (SELECT count(*) AS n,(jsonb_agg(l.j)->0) AS packet FROM l WHERE l.id=e.id AND l.j->'pastRace'=e.j->'pastRace') la ON TRUE
LEFT JOIN LATERAL (
 SELECT count(*) AS n,(jsonb_agg(jsonb_build_object(
 'finish',h.finish,'time_raw',h.time_raw,'final3f',h.final3f,'distance',h.distance,'surface',h.surface,'going',h.going,'race_name',h.race_name,
 'source_status','ARCHIVE_ASOF_UNVERIFIED'))->0) AS packet
 FROM public.horse_runs h WHERE h.race_date::text=e.prior_date AND h.track=e.prior_track AND h.race_no::text=e.prior_race_no
 AND h.horse_no::text=e.prior_no AND h.horse_name=e.horse_name
) a ON TRUE
LEFT JOIN LATERAL (
 SELECT count(*) AS n,(jsonb_agg(jsonb_build_object(
 'finish',f->>'finish','time_raw',f->>'time','settled_at',o.settled_at,'source',o.source,
 'source_status','SETTLEMENT_DETAIL_RECHECK_REQUIRED'))->0) AS packet
 FROM public.official_results o CROSS JOIN LATERAL jsonb_array_elements(o.result->'finishers') f
 WHERE o.circuit='LOCAL' AND o.race_date::text=e.prior_date AND o.track=e.prior_track AND o.race_no::text=e.prior_race_no
 AND o.settled_at<=e.as_of AND f->>'horse_no'=e.prior_no AND f->>'horse_name'=e.horse_name
) b ON TRUE
WHERE e.duplicate_n=1 ORDER BY e.current_no::int,e.prior_date DESC,e.prior_track,e.prior_race_no;
