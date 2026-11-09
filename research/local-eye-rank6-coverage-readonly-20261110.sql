-- BAKEN LAB / 2026-11-10 / verified retrospective LOCAL EYE diagnostic.
-- Compares actual pre-post FROZEN ranks 5,6 and official NAR result
-- with EYE choice and the PRE-RACE positive-factor audit.
-- STRICTLY post-race review; not a rank generator or production input.
-- The only payout value read is the WIN HORSE NUMBER to disambiguate a
-- duplicate raw finish=1. No odds or payout amount feeds ability.
WITH races AS (
 SELECT p.race_date,p.track,p.race_no,p.payload,
   NULLIF(p.payload->'eye'->>'horse_no','')::int AS eye_no,
   NULLIF(p.payload->'eye'->>'rank','')::int AS eye_rank,
   (SELECT (w->>'combination')::int
      FROM jsonb_array_elements(COALESCE(r.result->'payouts'->'win','[]'::jsonb)) w
      LIMIT 1) AS winner_no,
   (SELECT (f->>'horse_no')::int FROM jsonb_array_elements(
      COALESCE(r.result->'finishers','[]'::jsonb)) f WHERE f->>'finish'='2' LIMIT 1) AS second_no,
   (SELECT (f->>'horse_no')::int FROM jsonb_array_elements(
      COALESCE(r.result->'finishers','[]'::jsonb)) f WHERE f->>'finish'='3' LIMIT 1) AS third_no,
   (SELECT (h->>'horse_no')::int FROM jsonb_array_elements(p.payload->'runners') h
      WHERE h->>'rank'='5' LIMIT 1) AS rank5_no,
   (SELECT (h->>'horse_no')::int FROM jsonb_array_elements(p.payload->'runners') h
      WHERE h->>'rank'='6' LIMIT 1) AS rank6_no,
   r.result
 FROM public.official_predictions p
 JOIN public.official_results r USING(race_date,track,race_no,circuit)
 WHERE p.circuit='LOCAL'
 AND p.race_date BETWEEN DATE '2026-11-07' AND DATE '2026-11-09'
 AND p.status='FROZEN' AND p.frozen_at<p.post_time
 AND r.source='NAR_OFFICIAL_RACEMARK'
 AND r.settled_at>=p.post_time
 AND jsonb_array_length(COALESCE(r.result->'payouts'->'win','[]'::jsonb))=1
), valid AS (
 SELECT * FROM races b
 WHERE winner_no IS NOT NULL AND second_no IS NOT NULL AND third_no IS NOT NULL
 AND winner_no<>second_no AND winner_no<>third_no AND second_no<>third_no
 AND rank5_no IS NOT NULL AND rank6_no IS NOT NULL AND rank5_no<>rank6_no
 AND (SELECT count(*) FROM jsonb_array_elements(b.result->'finishers') f
    WHERE f->>'finish'='1' AND f->>'horse_no'=b.winner_no::text)=1
 AND (SELECT count(*) FROM jsonb_array_elements(b.result->'finishers') f
    WHERE f->>'finish'='2')=1
 AND (SELECT count(*) FROM jsonb_array_elements(b.result->'finishers') f
    WHERE f->>'finish'='3')=1
), metrics AS (
 SELECT b.*,
   rank5_no IN (winner_no,second_no,third_no) rank5_podium,
   rank6_no IN (winner_no,second_no,third_no) rank6_podium,
   eye_no IN (winner_no,second_no,third_no) eye_podium,
   (SELECT count(*) FROM jsonb_array_elements(
      b.payload->'audit'->'eye_candidate_audit') c) AS outsiders,
   (SELECT count(*) FROM jsonb_array_elements(
      b.payload->'audit'->'eye_positive_factor_audit') f
      WHERE jsonb_array_length(COALESCE(f->'positive_factors','[]'::jsonb))=0
   ) AS zero_factor_horses,
   (SELECT count(*) FROM jsonb_array_elements(
      b.payload->'audit'->'eye_candidate_audit') c
      WHERE EXISTS(SELECT 1 FROM jsonb_each(c->'review_checks') checks
        WHERE checks.value->>'status'='CHECKED')
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
        b.payload->'audit'->'eye_positive_factor_audit') f
        WHERE f->>'horse_no'=c->>'horse_no' AND
        jsonb_array_length(COALESCE(f->'positive_factors','[]'::jsonb))>0)
   ) AS checked_but_zero
 FROM valid b
)
SELECT
 CASE WHEN GROUPING(race_date)=1 THEN 'ALL_DATES' ELSE race_date::text END date_scope,
 CASE WHEN GROUPING(track)=1 THEN 'ALL_TRACKS' ELSE track END track_scope,
 count(*) races,
 count(*) FILTER(WHERE rank5_podium) rank5_podium,
 count(*) FILTER(WHERE rank6_podium) rank6_podium,
 count(*) FILTER(WHERE rank6_no=winner_no) rank6_winners,
 count(*) FILTER(WHERE eye_no IS NOT NULL) eye_selected,
 count(*) FILTER(WHERE eye_no IS NOT NULL AND eye_podium) eye_podium,
 count(*) FILTER(WHERE eye_rank=6) eye_rank6,
 count(*) FILTER(WHERE eye_rank=7) eye_rank7,
 count(*) FILTER(WHERE eye_rank>=8) eye_rank8plus,
 count(*) FILTER(WHERE rank6_podium AND eye_no=rank6_no) rank6_podium_rescued_eye,
 count(*) FILTER(WHERE rank6_podium AND eye_no IS DISTINCT FROM rank6_no) rank6_podium_not_eye,
 sum(outsiders) outsiders,
 sum(zero_factor_horses) zero_factor_horses,
 sum(checked_but_zero) checked_but_zero
FROM metrics
GROUP BY GROUPING SETS ((race_date,track),(race_date),())
ORDER BY GROUPING(race_date) DESC,race_date NULLS FIRST,
         GROUPING(track) DESC,track NULLS FIRST;
