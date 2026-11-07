-- Research only: SELECT-only diagnostic, no table writes, no FROZEN modification.
-- Source timestamp after FROZEN is NOT admissible as before-race evidence.
SELECT r.track,r.race_no,(p.frozen_at AT TIME ZONE 'Asia/Tokyo') frozen_jst,
 r.field_payload->'race'->>'going' pred_going,z.result->'metadata'->>'going' actual_going,
 r.field_payload->'race'->>'weather' pred_weather,z.result->'metadata'->>'weather' actual_weather
FROM public.official_races r
JOIN public.official_predictions p USING(race_date,circuit,track,race_no)
JOIN public.official_results z USING(race_date,circuit,track,race_no)
WHERE r.race_date='2026-11-07' AND r.circuit='JRA' AND p.status='FROZEN'
ORDER BY r.track,r.race_no;

-- As-of-FROZEN live data cross-check; never use live_checked_at > frozen_at for scoring.
SELECT p.track,p.race_no,(p.frozen_at AT TIME ZONE 'Asia/Tokyo') frozen_jst,
 (l.source_checked_at AT TIME ZONE 'Asia/Tokyo') live_checked_jst,
 (l.source_checked_at<=p.frozen_at) existed_before_freeze,
 o.field_payload->'race'->>'going' frozen_going,l.going live_going,
 o.field_payload->'race'->>'weather' frozen_weather,l.weather live_weather
FROM public.official_predictions p
JOIN public.official_races o USING(race_date,circuit,track,race_no)
JOIN public.jra_live_races l ON (l.race_date,l.track,l.race_no)=(p.race_date,p.track,p.race_no)
WHERE p.race_date='2026-11-07' AND p.circuit='JRA'
ORDER BY p.track,p.race_no;

-- Official top three, immutable ranking, and EYE.
WITH x AS (SELECT p.circuit,p.track,p.race_no,p.payload,z.result
 FROM public.official_predictions p
 JOIN public.official_results z USING(race_date,circuit,track,race_no)
 WHERE p.race_date='2026-11-07' AND p.status='FROZEN')
SELECT x.circuit,x.track,x.race_no,(f->>'finish')::int finish,
 f->>'horse_name' horse_name,
 (SELECT (a->>'rank')::int FROM jsonb_array_elements(x.payload->'runners') a WHERE a->>'horse_no'=f->>'horse_no') hub_rank,
 (f->>'horse_no'=x.payload->'eye'->>'horse_no') is_eye
FROM x CROSS JOIN LATERAL jsonb_array_elements(x.result->'finishers') f
WHERE f->>'finish' IN ('1','2','3')
ORDER BY x.circuit,x.track,x.race_no,finish;

-- Separate historical protocol versions; do not mix JRA0.3 with 0.4.
WITH x AS (SELECT p.race_date,p.circuit,p.protocol_version,p.payload,z.result
 FROM public.official_predictions p JOIN public.official_races r USING(race_date,circuit,track,race_no)
 JOIN public.official_results z USING(race_date,circuit,track,race_no)
 WHERE p.race_date BETWEEN '2026-10-18' AND '2026-11-07'
   AND p.status='FROZEN' AND r.result_status='READY')
SELECT circuit,protocol_version,
 CASE WHEN race_date='2026-11-07' THEN 'CURRENT' ELSE 'PREVIOUS' END period,
 COUNT(*) races,
 SUM((SELECT COUNT(*) FROM jsonb_array_elements(result->'finishers') f WHERE f->>'finish'='1'
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'top5') a WHERE a->>'horse_no'=f->>'horse_no'))) winner_top5
FROM x GROUP BY circuit,protocol_version,period
ORDER BY circuit,protocol_version,period;
