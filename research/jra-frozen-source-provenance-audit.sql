-- JRA historical source provenance audit. Read only. Does not alter FROZEN.
-- Identify archive material available BEFORE the original FROZEN as-of moment.
-- History from latest jra_live_runners snapshot is not assumed to have been available at FROZEN.
-- Archive name-only rows can inform additional fact checking but are unverified identity.
WITH frozen AS (
 SELECT p.track,p.race_no,p.frozen_at,l.id live_id
 FROM public.official_predictions p
 JOIN public.jra_live_races l
 ON (l.race_date,l.track,l.race_no)=(p.race_date,p.track,p.race_no)
 WHERE p.race_date='2026-11-07' AND p.circuit='JRA' AND p.status='FROZEN'
), live AS (
 SELECT f.*,lr.horse_no,lr.horse_name,lr.horse_ref,lr.source_checked_at
 FROM frozen f JOIN public.jra_live_runners lr ON lr.live_race_id=f.live_id
), provenance AS (
 SELECT live.*,
 EXISTS(
  SELECT 1 FROM public.jra_lab_runs x JOIN public.jra_lab_races ar ON ar.id=x.race_id
  WHERE x.horse_name=live.horse_name AND x.record_role='full_runner'
    AND x.horse_ref IS NOT NULL
    AND substring(x.horse_ref FROM '([0-9]{10})/')=
        substring(live.horse_ref FROM '([0-9]{10})/')
    AND ar.race_date<'2026-11-07'
    AND x.created_at<=live.frozen_at AND ar.created_at<=live.frozen_at
    AND ar.source_checked_at<=live.frozen_at
    AND ar.surface IN ('芝','ダート')
 ) has_verified_archive,
 EXISTS(
  SELECT 1 FROM public.jra_lab_runs x JOIN public.jra_lab_races ar ON ar.id=x.race_id
  WHERE x.horse_name=live.horse_name AND x.record_role='full_runner'
    AND x.horse_ref IS NULL
    AND ar.race_date<'2026-11-07'
    AND x.created_at<=live.frozen_at AND ar.created_at<=live.frozen_at
    AND ar.source_checked_at<=live.frozen_at
    AND ar.surface IN ('芝','ダート')
 ) has_name_only_archive
 FROM live
)
SELECT track,COUNT(DISTINCT race_no)::int races,COUNT(*)::int runners,
 COUNT(*) FILTER(WHERE source_checked_at>frozen_at)::int latest_live_after_frozen,
 COUNT(*) FILTER(WHERE source_checked_at<=frozen_at)::int latest_live_before_frozen,
 COUNT(*) FILTER(WHERE has_verified_archive)::int id_verified_history_runners,
 COUNT(*) FILTER(WHERE has_name_only_archive AND NOT has_verified_archive)::int
   name_only_history_runners,
 COUNT(*) FILTER(WHERE NOT has_verified_archive AND NOT has_name_only_archive)::int
   no_prefrozen_archive_runners
FROM provenance GROUP BY track
UNION ALL
SELECT '合計' AS track,COUNT(DISTINCT (track,race_no))::int races,
 COUNT(*)::int runners,
 COUNT(*) FILTER(WHERE source_checked_at>frozen_at)::int,
 COUNT(*) FILTER(WHERE source_checked_at<=frozen_at)::int,
 COUNT(*) FILTER(WHERE has_verified_archive)::int,
 COUNT(*) FILTER(WHERE has_name_only_archive AND NOT has_verified_archive)::int,
 COUNT(*) FILTER(WHERE NOT has_verified_archive AND NOT has_name_only_archive)::int
FROM provenance ORDER BY track;
