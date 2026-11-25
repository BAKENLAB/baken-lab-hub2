-- REBORN 2 read-only evidence prototype; explicit historical fixture race keys.
-- No market, old ranks, target results, writes or CLAIM.
WITH requested(circuit,race_date,track,race_no) AS (
 VALUES ('JRA',DATE '2025-03-29','中山',11),('LOCAL',DATE '2025-12-08','船橋',11)
), raw AS (
 SELECT 'JRA' AS circuit,r.race_date,r.track,r.race_no,r.race_key AS race_ref,
 r.source_ref AS official_ref,r.source_kind,r.full_field AS declared_full_field,
 r.field_size,r.surface,r.distance,r.going,r.class_name,h.horse_no,h.horse_name,h.horse_ref,
 h.finish,h.time_raw,h.margin AS margin_raw,h.final3f,h.early_pos,h.final_turn_pos,
 h.corner_positions,r.halon_times AS race_laps
 FROM public.jra_lab_races r JOIN public.jra_lab_runs h ON h.race_id=r.id
 JOIN requested q ON q.circuit='JRA' AND (q.race_date,q.track,q.race_no)=(r.race_date,r.track,r.race_no)
 WHERE r.race_date<DATE '2026-11-26'
 UNION ALL
 SELECT 'LOCAL',h.race_date,h.track,h.race_no,h.race_id,NULL::text,
 'LOCAL_ARCHIVE_IDENTITY_RECHECK_REQUIRED',NULL::boolean,h.field_size,h.surface,h.distance,h.going,
 NULL::text,h.horse_no,h.horse_name,NULL::text,h.finish,h.time_raw,h.margin,h.final3f,h.early_pos,h.final_turn_pos,
 NULL::text,NULL::text
 FROM public.horse_runs h JOIN requested q ON q.circuit='LOCAL' AND (q.race_date,q.track,q.race_no)=(h.race_date,h.track,h.race_no)
 WHERE h.race_date<DATE '2026-11-26' AND h.track<>'帯広ば'
), normalized AS (
 SELECT raw.*,
 CASE WHEN finish>0 AND time_raw ~ '^[0-9]+:[0-5][0-9][.][0-9]$'
 THEN split_part(time_raw,':',1)::numeric*60+split_part(time_raw,':',2)::numeric
 WHEN circuit='LOCAL' AND finish>0 AND time_raw ~ '^[0-9]+[0-5][0-9][0-9]$' AND length(time_raw) BETWEEN 4 AND 5
 THEN left(time_raw,length(time_raw)-3)::numeric*60+right(time_raw,3)::numeric/10
 ELSE NULL END AS elapsed_seconds,
 CASE WHEN finish=1 OR margin_raw ~ '^[0-9]{3}[(][+-]?[0-9]+[)]$' THEN NULL ELSE nullif(margin_raw,'') END AS margin_literal_untyped,
 CASE WHEN finish>0 AND final3f>0 THEN final3f ELSE NULL END AS usable_final3f
 FROM raw
), quality AS (
 SELECT circuit,race_ref,count(*) AS row_count,count(DISTINCT horse_no) AS unique_horses,
 max(field_size) AS field_size,count(DISTINCT field_size) AS field_size_versions,
 count(*) FILTER(WHERE finish=1) AS winners,
 min(elapsed_seconds) FILTER(WHERE finish=1) AS winner_seconds
 FROM normalized GROUP BY circuit,race_ref
)
SELECT n.circuit,n.race_date,n.track,n.race_no,n.race_ref,n.official_ref,n.source_kind,n.horse_ref,
 n.horse_no,n.horse_name,n.finish,n.surface,n.distance,n.going,n.class_name,n.elapsed_seconds,
 n.margin_literal_untyped,n.usable_final3f,n.early_pos,n.final_turn_pos,n.corner_positions,n.race_laps,
 q.row_count,q.unique_horses,q.field_size,
 CASE WHEN q.winners=1 AND q.unique_horses=q.row_count AND q.field_size=q.row_count AND q.field_size_versions=1
 AND q.winner_seconds IS NOT NULL AND n.elapsed_seconds>=q.winner_seconds AND n.finish>0
 THEN n.elapsed_seconds-q.winner_seconds END AS rounded_clock_gap_to_winner_s,
 CASE WHEN q.unique_horses=q.row_count AND q.field_size=q.row_count AND q.field_size_versions=1
 AND n.finish>0 AND n.elapsed_seconds IS NOT NULL AND nextf.n=1 AND nextf.seconds>=n.elapsed_seconds
 THEN nextf.seconds-n.elapsed_seconds END AS rounded_clock_gap_to_next_finisher_s,
 CASE WHEN n.circuit='LOCAL' THEN 'ARCHIVE_CANDIDATE_NEEDS_OFFICIAL_IDENTITY'
 WHEN n.declared_full_field IS TRUE AND n.official_ref IS NOT NULL THEN 'JRA_ARCHIVE_CANDIDATE'
 ELSE 'PARTIAL_ARCHIVE_CANDIDATE' END AS evidence_status
FROM normalized n JOIN quality q USING(circuit,race_ref)
LEFT JOIN LATERAL (
 SELECT count(*) AS n,min(m.elapsed_seconds) AS seconds FROM normalized m
 WHERE m.circuit=n.circuit AND m.race_ref=n.race_ref AND m.finish>n.finish
 AND m.finish=(SELECT min(z.finish) FROM normalized z WHERE z.circuit=n.circuit AND z.race_ref=n.race_ref AND z.finish>n.finish)
) nextf ON TRUE
ORDER BY n.circuit,n.race_date,n.track,n.race_no,n.finish NULLS LAST,n.horse_no;
