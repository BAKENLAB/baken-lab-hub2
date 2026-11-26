-- Read-only candidate discovery ONLY. URL-token format hypothesis; not identity proof. No scores/odds or target result. Dedup by exact official race identity before acceptance; URL equality alone not enough. No LIMIT 5.
WITH field AS (
 SELECT r.race_date,r.track,r.race_no,h.horse_no,h.horse_name,h.horse_ref,h.past_runs,
 substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$') AS candidate_id
 FROM public.jra_live_races r JOIN public.jra_live_runners h ON h.live_race_id=r.id
 WHERE r.race_date=DATE '2026-11-23' AND r.track='東京' AND r.race_no=12
), archive AS (
 SELECT f.horse_no AS current_no,r.race_date,r.track,r.race_no,h.horse_no AS previous_no,h.horse_ref,r.source_ref,
 h.finish,h.time_raw,h.final3f,h.corner_positions,r.halon_times
 FROM field f JOIN public.jra_lab_runs h ON h.horse_name=f.horse_name
 AND substring(h.horse_ref from '^/JRADB/accessU[.]html[?]CNAME=pw01dud[01]0([0-9]{10})/[0-9A-F]{2}$')=f.candidate_id
 JOIN public.jra_lab_races r ON r.id=h.race_id AND r.race_date<f.race_date
 WHERE h.record_role='full_runner' AND h.source_kind='jra_public_reference' AND r.full_field IS TRUE AND r.source_ref IS NOT NULL
), recent AS (
 SELECT f.horse_no AS current_no,j->>'race_date' AS race_date,j->>'track' AS track,j->>'source_ref' AS source_ref
 FROM field f CROSS JOIN LATERAL jsonb_array_elements(f.past_runs) j
 WHERE j->>'race_date' < f.race_date::text AND j->>'source_ref' IS NOT NULL
)
SELECT f.horse_no,f.horse_name,f.candidate_id,
 (SELECT count(*) FROM recent j WHERE j.current_no=f.horse_no) AS recent_n,
 (SELECT count(*) FROM archive a WHERE a.current_no=f.horse_no) AS archive_candidate_n,
 (SELECT count(*) FROM archive a WHERE a.current_no=f.horse_no AND NOT EXISTS(SELECT 1 FROM recent j WHERE j.current_no=a.current_no AND j.source_ref='/JRADB/accessS.html?CNAME='||a.source_ref)) AS additional_candidate_n,
 'CANDIDATE_ONLY_NEEDS_OFFICIAL_IDENTITY_AND_ASOF' AS status
FROM field f ORDER BY f.horse_no;