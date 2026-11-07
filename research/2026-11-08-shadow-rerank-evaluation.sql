-- 2026-11-08 BAKEN LAB shadow hypothesis audit
-- READ ONLY. All outcome fields used ONLY to compute evaluation metrics.
-- NO production rank changes or FROZEN updates. Do not use for pre-race predictions.
-- JRA0.4, 10/24-11/7. Safety: canceled and unranked runners omitted.
-- Missing reason text means ineligible for relief (do NOT infer missing evidence).

WITH x AS(
 SELECT p.race_date,p.track,p.race_no,p.payload,z.result
 FROM public.official_predictions p
 JOIN public.official_races o USING(race_date,circuit,track,race_no)
 JOIN public.official_results z USING(race_date,circuit,track,race_no)
 WHERE p.circuit='JRA' AND p.race_date BETWEEN '2026-10-24' AND '2026-11-07'
  AND p.protocol_version='JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023'
  AND p.status='FROZEN' AND o.result_status='READY'
),r AS(
 SELECT x.race_date,x.track,x.race_no,a->>'horse_no' horse_no,
  (a->>'rank')::int orig_rank,(a->>'score')::int score,
  COALESCE(a->>'reason','')~'(昇級初戦|昇級未知|初挑戦|初条件|初走|未経験|未出走|距離延長|距離短縮|長期休養|半年ぶり|休養明け|未知|現級初戦|クラス差)' uncertain,
  COALESCE(a->>'reason','')~'(勝ち|勝利|1着|2着|3着|小差|接戦|連対|好走|馬券圏)' positive,
  (a->>'horse_no')=(x.payload->'eye'->>'horse_no') eye,
  EXISTS(SELECT 1 FROM jsonb_array_elements(x.result->'finishers') f
     WHERE f->>'finish'='1' AND f->>'horse_no'=a->>'horse_no') won,
  EXISTS(SELECT 1 FROM jsonb_array_elements(x.result->'finishers') f
     WHERE f->>'finish' IN ('1','2','3') AND f->>'horse_no'=a->>'horse_no') podium
 FROM x CROSS JOIN LATERAL jsonb_array_elements(x.payload->'runners') a
 WHERE a->>'status' IS DISTINCT FROM 'CANCELLED'
   AND a->>'rank' IS NOT NULL AND a->>'score' IS NOT NULL
),m AS(
 SELECT * FROM (VALUES
  ('BASE',0,'none'),('RELIEF4',4,'relief'),('RELIEF6',6,'relief'),
  ('RELIEF10',10,'relief'),('EYE4',4,'eye'),('EYE6',6,'eye'),('EYE10',10,'eye')
 ) t(mode,boost,rule)
),extra AS(
 SELECT m.mode,r.*,
  CASE WHEN m.rule='relief' AND orig_rank BETWEEN 6 AND 12
     AND score>=70 AND uncertain AND positive THEN m.boost
   WHEN m.rule='eye' AND eye AND orig_rank>5 THEN m.boost ELSE 0 END bonus
 FROM r CROSS JOIN m
),y AS(
 SELECT *,ROW_NUMBER() OVER(
  PARTITION BY mode,race_date,track,race_no
  ORDER BY score+bonus DESC NULLS LAST,orig_rank ASC
 ) new_rank FROM extra
)
SELECT mode, CASE WHEN race_date='2026-11-07' THEN 'CURRENT' ELSE 'PRIOR' END period,
 COUNT(DISTINCT(race_date,track,race_no)) races,
 SUM((won AND orig_rank<=5)::int) old_wins,
 SUM((won AND new_rank<=5)::int) shadow_wins,
 SUM((podium AND orig_rank<=5)::int) old_podium,
 SUM((podium AND new_rank<=5)::int) shadow_podium,
 SUM((won AND orig_rank>5 AND new_rank<=5)::int) gained_wins,
 SUM((won AND orig_rank<=5 AND new_rank>5)::int) lost_wins,
 SUM((podium AND orig_rank>5 AND new_rank<=5)::int) gained_podium,
 SUM((podium AND orig_rank<=5 AND new_rank>5)::int) lost_podium,
 SUM((orig_rank<=5 AND new_rank>5)::int) pushed_out,
 SUM((orig_rank>5 AND new_rank<=5)::int) promoted
FROM y GROUP BY mode,period ORDER BY period,mode;

-- LOCAL1.6 EYE actual independent current factor audit.
-- Only complete official TOP3 result sets, not incomplete 1-/2-finisher results.
WITH r AS(
 SELECT p.race_date,p.track,p.race_no,p.payload,z.result
 FROM public.official_predictions p
 JOIN public.official_races o USING(race_date,circuit,track,race_no)
 JOIN public.official_results z USING(race_date,circuit,track,race_no)
 WHERE p.circuit='LOCAL' AND p.race_date BETWEEN '2026-10-18' AND '2026-11-07'
 AND p.protocol_version='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'
 AND p.status='FROZEN' AND o.result_status='READY'
),m AS(
 SELECT r.race_date,r.track,r.race_no,r.payload,r.result,c->>'horse_no' horse_no,
  (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(c->'positive_factors','[]'::jsonb)) f
     WHERE f->>'current_relevance'='true') current_true,
  (SELECT COUNT(DISTINCT f->>'category') FROM jsonb_array_elements(COALESCE(c->'positive_factors','[]'::jsonb)) f
     WHERE f->>'current_relevance'='true') true_categories,
  (r.payload->'eye'->>'horse_no')=c->>'horse_no' selected,
  EXISTS(SELECT 1 FROM jsonb_array_elements(r.result->'finishers') f
     WHERE f->>'finish' IN('1','2','3') AND f->>'horse_no'=c->>'horse_no') placed
 FROM r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.payload->'audit'->'eye_positive_factor_audit','[]'::jsonb)) c
 WHERE (SELECT COUNT(*) FROM jsonb_array_elements(r.result->'finishers') f
    WHERE f->>'finish' IN ('1','2','3'))=3
)
SELECT CASE WHEN race_date='2026-11-07' THEN 'CURRENT' ELSE 'PRIOR' END period,
 COUNT(*) selected_eyes, SUM(placed::int) eye_podium,
 COUNT(*) FILTER(WHERE current_true>=2 AND true_categories>=2) passes_independent_factors,
 COUNT(*) FILTER(WHERE current_true<2 OR true_categories<2) below_factor_gate
FROM m WHERE selected GROUP BY period ORDER BY period;

-- LOCAL TOP5 / rank6 / EYE: add-one-horse coverage ONLY, not profitability or policy adoption.
WITH r AS(
 SELECT p.race_date,p.track,p.race_no,p.payload,z.result
 FROM public.official_predictions p JOIN public.official_races o USING(race_date,circuit,track,race_no)
 JOIN public.official_results z USING(race_date,circuit,track,race_no)
 WHERE p.circuit='LOCAL' AND p.race_date BETWEEN '2026-10-18' AND '2026-11-07'
   AND p.protocol_version='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'
   AND p.status='FROZEN' AND o.result_status='READY'
),k AS(
 SELECT r.race_date,r.track,r.race_no,
  (SELECT COUNT(*) FROM jsonb_array_elements(result->'finishers') f
     WHERE f->>'finish' IN ('1','2','3')) n3,
  (SELECT COUNT(*) FROM jsonb_array_elements(result->'finishers') f
     WHERE f->>'finish' IN ('1','2','3') AND EXISTS(
      SELECT 1 FROM jsonb_array_elements(payload->'runners') a
      WHERE a->>'horse_no'=f->>'horse_no' AND (a->>'rank')::int<=5)) top5_n,
  (SELECT COUNT(*) FROM jsonb_array_elements(result->'finishers') f
     WHERE f->>'finish' IN ('1','2','3') AND EXISTS(
      SELECT 1 FROM jsonb_array_elements(payload->'runners') a
      WHERE a->>'horse_no'=f->>'horse_no' AND a->>'rank'='6')) sixth_n,
  (SELECT COUNT(*) FROM jsonb_array_elements(result->'finishers') f
     WHERE f->>'finish' IN ('1','2','3') AND f->>'horse_no'=payload->'eye'->>'horse_no') eye_n
 FROM r
)
SELECT CASE WHEN race_date='2026-11-07' THEN 'CURRENT' ELSE 'PRIOR' END period,
 COUNT(*) races,SUM(top5_n) top5_podium,SUM(sixth_n) extra_rank6,SUM(eye_n) extra_eye,
 COUNT(*) FILTER(WHERE top5_n=3) full_top5,
 COUNT(*) FILTER(WHERE top5_n+sixth_n=3) full_top6,
 COUNT(*) FILTER(WHERE top5_n+eye_n=3) full_top5_eye
FROM k WHERE n3=3 GROUP BY period ORDER BY period;