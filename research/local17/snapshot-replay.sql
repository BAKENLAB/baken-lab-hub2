-- LOCAL 1.7 retrospective shadow REPLAY. READ ONLY: SELECT statements only.
-- Baseline is the immutable LOCAL1.6 FROZEN, not post-hoc scored predictions.
-- Labels are text mentions, NOT verified independent positive evidence.
-- This is an IN-SAMPLE sensitivity test (no prospective/OOS claim).
WITH eligible AS (
  SELECT p.race_date,p.track,p.race_no,p.protocol_version,
    p.payload->'runners'->4 AS fifth,
    p.payload->'runners'->5 AS sixth,
    ARRAY(
      SELECT (z->>'horse_no')::int
      FROM jsonb_array_elements(p.payload->'runners') z
      ORDER BY (z->>'rank')::int
    ) AS original_ranked,
    ARRAY(
      SELECT (z->>'horse_no')::int
      FROM jsonb_array_elements(res.result->'finishers') z
      WHERE z->>'finish' ~ '^[0-9]+$'
        AND (z->>'finish')::int BETWEEN 1 AND 3
      ORDER BY (z->>'finish')::int
    ) AS podium,
    (p.payload->'runners'->4->>'score')::numeric
      - (p.payload->'runners'->5->>'score')::numeric AS gap
  FROM public.official_predictions p
  JOIN public.official_results res USING (race_date,track,race_no,circuit)
  WHERE p.circuit = 'LOCAL'
    AND p.race_date BETWEEN DATE '2026-10-26' AND DATE '2026-10-30'
    AND p.status = 'FROZEN'
    AND p.protocol_version = 'CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'
    AND p.frozen_at < p.post_time
    AND jsonb_array_length(p.payload->'runners') >= 6
    AND jsonb_array_length(p.payload->'top5') = 5
), basis AS (
  SELECT *, CASE WHEN race_date = DATE '2026-10-30'
       THEN '2026-10-30' ELSE '2026-10-26_to_29' END AS period,
    (sixth->>'reason' ~ '(過去|同場|同距離|実績|好走|以前)') AS prior_text,
    (sixth->>'reason' ~* '(中央|JRA|Jpn|OP|オープン|重賞|GⅠ|JpnII)') AS grade_text,
    (fifth->>'reason' ~ '(大敗|8着|9着|10着|11着|12着|失速|不振|凡走)') AS fifth_negative_text
  FROM eligible WHERE array_length(podium,1)=3
), variants AS (
  SELECT b.*,
    p.policy,
    p.switched,
    CASE WHEN p.switched
      THEN b.original_ranked[1:4] || ARRAY[b.original_ranked[6]]
      ELSE b.original_ranked[1:5] END AS hypothetical_top5
  FROM basis b
  CROSS JOIN LATERAL (VALUES
    ('NO_CHANGE_BASELINE',false),
    ('ALL_RANK5_TO_6',b.gap >= 0),
    ('SCORE_GAP_LTE_2',b.gap BETWEEN 0 AND 2),
    ('GAP_LTE_2_PRIOR_TEXT',b.gap BETWEEN 0 AND 2 AND b.prior_text),
    ('GAP_LTE_2_FIFTH_NEGATIVE_TEXT',b.gap BETWEEN 0 AND 2 AND b.fifth_negative_text),
    ('GAP_LTE_2_GRADE_TEXT',b.gap BETWEEN 0 AND 2 AND b.grade_text)
  ) p(policy,switched)
), measured AS (
  SELECT *, original_ranked[1:5] AS baseline_top5,
    ARRAY(SELECT unnest(podium) EXCEPT SELECT unnest(original_ranked[1:5])) AS baseline_missed,
    ARRAY(SELECT unnest(podium) INTERSECT SELECT unnest(hypothetical_top5)
          EXCEPT SELECT unnest(original_ranked[1:5])) AS newly_covered,
    ARRAY(SELECT unnest(podium) INTERSECT SELECT unnest(original_ranked[1:5])
          EXCEPT SELECT unnest(hypothetical_top5)) AS lost_covered
  FROM variants
)
SELECT period,policy,
  count(*) AS n_races,
  count(*) FILTER(WHERE switched) AS switched_races,
  sum(cardinality(newly_covered))::int AS gained_top3_horses,
  sum(cardinality(lost_covered))::int AS lost_top3_horses,
  sum(cardinality(newly_covered) - cardinality(lost_covered))::int AS net_top3_horses,
  count(*) FILTER(
    WHERE NOT (podium[1] = ANY(baseline_top5))
      AND podium[1] = ANY(hypothetical_top5)
  ) AS gained_winners,
  count(*) FILTER(
    WHERE podium[1] = ANY(baseline_top5)
      AND NOT (podium[1] = ANY(hypothetical_top5))
  ) AS lost_winners
FROM measured
GROUP BY period,policy
ORDER BY policy,period;
