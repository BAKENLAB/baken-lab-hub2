-- LOCAL 1.6 honest 5-vs-6 boundary OUTCOME audit.
-- Read-only retrospective measurement only; never used as pre-race evidence.
-- Official WIN-payout combination identifies the actual winner, since NAR
-- RaceMark may have an extra incorrectly labeled "finish=1" record.
-- The payout is used only for RESULT IDENTITY, not ability or market ranking.
WITH frozen AS (
 SELECT p.race_date,p.track,p.race_no,p.post_time,p.frozen_at,p.payload,r.result,
   (SELECT (w->>'combination')::integer
      FROM jsonb_array_elements(COALESCE(r.result->'payouts'->'win','[]'::jsonb)) w
      WHERE w->>'combination' ~ '^[0-9]{1,2}$'
      LIMIT 1) winner_no,
   (SELECT (h->>'horse_no')::integer
      FROM jsonb_array_elements(COALESCE(r.result->'finishers','[]'::jsonb)) h
      WHERE h->>'finish'='2' AND h->>'horse_no' ~ '^[0-9]{1,2}$' LIMIT 1) second_no,
   (SELECT (h->>'horse_no')::integer
      FROM jsonb_array_elements(COALESCE(r.result->'finishers','[]'::jsonb)) h
      WHERE h->>'finish'='3' AND h->>'horse_no' ~ '^[0-9]{1,2}$' LIMIT 1) third_no,
   (SELECT (h->>'horse_no')::integer
      FROM jsonb_array_elements(COALESCE(p.payload->'runners','[]'::jsonb)) h
      WHERE h->>'rank'='5' AND h->>'horse_no' ~ '^[0-9]{1,2}$' LIMIT 1) rank5_no,
   (SELECT (h->>'horse_no')::integer
      FROM jsonb_array_elements(COALESCE(p.payload->'runners','[]'::jsonb)) h
      WHERE h->>'rank'='6' AND h->>'horse_no' ~ '^[0-9]{1,2}$' LIMIT 1) rank6_no
 FROM public.official_predictions p
 JOIN public.official_results r USING (race_date,track,race_no,circuit)
 WHERE p.circuit='LOCAL' AND p.status='FROZEN'
   AND p.frozen_at IS NOT NULL AND p.frozen_at<p.post_time
   AND r.source='NAR_OFFICIAL_RACEMARK'
   AND r.settled_at>=p.post_time
   AND p.race_date BETWEEN DATE '2026-11-07' AND DATE '2026-11-09'
   AND jsonb_array_length(COALESCE(r.result->'payouts'->'win','[]'::jsonb))=1
   AND (SELECT count(*) FROM jsonb_array_elements(COALESCE(r.result->'finishers','[]'::jsonb)) h
      WHERE h->>'finish'='2')=1
   AND (SELECT count(*) FROM jsonb_array_elements(COALESCE(r.result->'finishers','[]'::jsonb)) h
      WHERE h->>'finish'='3')=1
), verified AS (
 SELECT *,
   rank5_no IN (winner_no,second_no,third_no) AS rank5_podium,
   rank6_no IN (winner_no,second_no,third_no) AS rank6_podium
 FROM frozen f
 WHERE winner_no IS NOT NULL AND second_no IS NOT NULL AND third_no IS NOT NULL
   AND rank5_no IS NOT NULL AND rank6_no IS NOT NULL
   AND rank5_no<>rank6_no AND winner_no<>second_no
   AND winner_no<>third_no AND second_no<>third_no
   AND (SELECT count(*) FROM jsonb_array_elements(COALESCE(f.result->'finishers','[]'::jsonb)) h
        WHERE h->>'finish'='1' AND h->>'horse_no'=winner_no::text)=1
)
SELECT race_date,
 count(*) AS verified_races,
 count(*) FILTER(WHERE rank5_podium) AS rank5_podium_races,
 count(*) FILTER(WHERE rank6_podium) AS rank6_podium_races,
 count(*) FILTER(WHERE rank6_podium AND NOT rank5_podium) AS rank6_only_captured,
 count(*) FILTER(WHERE rank5_podium AND NOT rank6_podium) AS rank5_only_captured,
 sum(rank6_podium::int-rank5_podium::int) AS hypothetical_swap_net_podium,
 'RETROSPECTIVE_ONLY_NO_PRODUCTION_REORDER'::text AS audit_status
FROM verified GROUP BY race_date ORDER BY race_date;
