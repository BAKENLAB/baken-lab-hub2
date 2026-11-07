-- FOUR AXES READ-ONLY: no database mutation or FROZEN edits.
-- All races restricted to 2026-11-07 for initial feasibility; expand to untouched dates for validation.
-- Source checked timestamps may be post-FROZEN. Never call that information an actual FROZEN input.

-- A. JRA previous-race passing order matched against historical lap archive.
WITH live AS (
 SELECT p.track,p.race_no,lr.horse_no,lr.horse_name,pr
 FROM public.official_predictions p
 JOIN public.jra_live_races l ON l.race_date=p.race_date AND l.track=p.track AND l.race_no=p.race_no
 JOIN public.jra_live_runners lr ON lr.live_race_id=l.id AND EXISTS(
  SELECT 1 FROM jsonb_array_elements(p.payload->'runners') a
  WHERE a->>'horse_no'=lr.horse_no::text AND a->>'status'='ACTIVE')
 CROSS JOIN LATERAL jsonb_array_elements(lr.past_runs) pr
 WHERE p.race_date='2026-11-07' AND p.circuit='JRA' AND p.status='FROZEN'
), matches AS (
 SELECT live.*,
 (SELECT r.id FROM public.jra_lab_races r JOIN public.jra_lab_runs run ON run.race_id=r.id
  WHERE r.race_date=(live.pr->>'race_date')::date AND r.track=live.pr->>'track'
  AND r.distance=(live.pr->>'distance')::int AND r.surface=live.pr->>'surface'
  AND run.horse_name=live.horse_name LIMIT 1) archived_id
 FROM live
)
SELECT track,COUNT(*) prior_runs,
 COUNT(*) FILTER(WHERE pr->>'early_pos' IS NOT NULL) with_early_corner,
 COUNT(*) FILTER(WHERE archived_id IS NOT NULL) archive_match,
 COUNT(*) FILTER(WHERE EXISTS(
  SELECT 1 FROM public.jra_lab_races r
  WHERE r.id=archived_id AND NULLIF(r.halon_times,'') IS NOT NULL)) archived_lap_match
FROM matches GROUP BY track ORDER BY track;

-- B. LOCAL historical corner data coverage; historical archive ends on 2026-08-31.
WITH frozen AS (
 SELECT p.track,p.race_no,a->>'horse_name' name
 FROM public.official_predictions p CROSS JOIN LATERAL jsonb_array_elements(p.payload->'runners') a
 WHERE p.race_date='2026-11-07' AND p.circuit='LOCAL' AND p.status='FROZEN'
 AND a->>'rank' IS NOT NULL
)
SELECT f.track,COUNT(*) ranked_runners,
 COUNT(*) FILTER(WHERE EXISTS(
  SELECT 1 FROM public.horse_runs h WHERE h.horse_name=f.name AND h.race_date<'2026-11-07')) historical_runners,
 COUNT(*) FILTER(WHERE EXISTS(
  SELECT 1 FROM public.horse_runs h WHERE h.horse_name=f.name
  AND h.race_date<'2026-11-07' AND h.early_pos IS NOT NULL AND h.final_turn_pos IS NOT NULL)) with_corner_history
FROM frozen f GROUP BY f.track ORDER BY f.track;

-- C. JRA all-runner pace crowding: 2+ early<=3 prior runs on same surface at distance +/- 200m.
WITH races AS(
 SELECT p.track,p.race_no,z.result,(z.result->'metadata'->>'distance')::int dist,
 z.result->'metadata'->>'surface' surf
 FROM public.official_predictions p JOIN public.official_results z USING(race_date,circuit,track,race_no)
 WHERE p.race_date='2026-11-07' AND p.circuit='JRA' AND p.status='FROZEN'
), runners AS(
 SELECT r.track,r.race_no,r.dist,r.surf,lr.horse_no,lr.past_runs
 FROM races r JOIN public.jra_live_races l
 ON l.race_date='2026-11-07' AND l.track=r.track AND l.race_no=r.race_no
 JOIN public.jra_live_runners lr ON lr.live_race_id=l.id
), front AS(
 SELECT r.track,r.race_no,r.horse_no,
 (SELECT COUNT(*) FROM jsonb_array_elements(r.past_runs) x
  WHERE x->>'early_pos' IS NOT NULL AND x->>'surface'=r.surf
  AND (x->>'distance')::int BETWEEN r.dist-200 AND r.dist+200) relevant,
 (SELECT COUNT(*) FROM jsonb_array_elements(r.past_runs) x
  WHERE x->>'early_pos' IS NOT NULL AND x->>'surface'=r.surf
  AND (x->>'distance')::int BETWEEN r.dist-200 AND r.dist+200
  AND (x->>'early_pos')::int<=3) front_runs
 FROM runners r
), score AS(
 SELECT track,race_no,COUNT(*) FILTER(WHERE relevant>=2 AND front_runs>=2) n_front
 FROM front GROUP BY track,race_no
)
SELECT s.track,s.race_no,s.n_front,
 (SELECT COUNT(*) FROM jsonb_array_elements(p.payload->'runners') a
  WHERE a->>'rank' IS NOT NULL AND (a->>'rank')::int<=5
  AND EXISTS(SELECT 1 FROM jsonb_array_elements(z.result->'finishers') f
   WHERE f->>'finish'='1' AND f->>'horse_no'=a->>'horse_no')) winner_in_top5
FROM score s JOIN public.official_predictions p ON p.race_date='2026-11-07'
 AND p.circuit='JRA' AND p.track=s.track AND p.race_no=s.race_no
JOIN public.official_results z ON z.race_date=p.race_date AND z.circuit=p.circuit
 AND z.track=p.track AND z.race_no=p.race_no
ORDER BY s.track,s.race_no;
