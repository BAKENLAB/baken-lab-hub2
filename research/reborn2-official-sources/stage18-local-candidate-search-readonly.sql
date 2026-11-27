BEGIN READ ONLY;
WITH s AS (
 SELECT id,race_date,track,race_no,as_of,captured_at,official_post_time,active_runner_count,source_status,source_version,official_roster_digest,payload_digest,evidence->'packet' p
 FROM private.lab_preclaim_evidence_snapshots_v1 WHERE circuit='LOCAL' AND captured_at<official_post_time AND as_of<=captured_at AND race_date<'2026-11-27'
), a AS (
 SELECT DISTINCT ON (s.race_date,s.track,s.race_no) s.id,s.race_date,s.track,s.race_no,s.as_of,s.captured_at,s.official_post_time,s.active_runner_count,s.source_status,s.source_version,s.official_roster_digest,s.payload_digest,
 (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.p->'evidence')='array' THEN s.p->'evidence' ELSE '[]'::jsonb END) e WHERE e->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT' AND e->>'identityVerifiedBy'='OFFICIAL_HORSE_REF' AND e->'pastRace'->>'raceDate'<s.race_date::text AND (e->>'sourceCheckedAt')::timestamptz<=s.as_of) prior_rows,
 (SELECT count(DISTINCT e->>'horseNo') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.p->'evidence')='array' THEN s.p->'evidence' ELSE '[]'::jsonb END) e WHERE e->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT' AND e->>'identityVerifiedBy'='OFFICIAL_HORSE_REF' AND e->'pastRace'->>'raceDate'<s.race_date::text AND (e->>'sourceCheckedAt')::timestamptz<=s.as_of) covered,
 (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.p->'officialRaceLaps')='array' THEN s.p->'officialRaceLaps' ELSE '[]'::jsonb END) l WHERE l->>'status'='VERIFIED_RACE_LEVEL_LAPS' AND l->>'finish_time_reconciled'='true' AND l->>'individual_horse_sectionals'='false' AND l->'pastRace'->>'raceDate'<s.race_date::text AND (l->>'sourceCheckedAt')::timestamptz<=s.as_of) lap_rows,
 o.field_fetched_at,o.updated_at AS card_updated_at,coalesce(o.field_fetched_at<o.post_time,false) card_fetch_prestart,coalesce(o.field_fetched_at<o.post_time AND o.updated_at<o.post_time,false) card_times_prestart
 FROM s LEFT JOIN public.official_races o ON o.circuit='LOCAL' AND o.race_date=s.race_date AND o.track=s.track AND o.race_no=s.race_no
 WHERE s.p->'marketUsed'='false'::jsonb AND s.p->'targetResultUsed'='false'::jsonb ORDER BY s.race_date,s.track,s.race_no,s.captured_at DESC
)
SELECT count(*) AS distinct_races,count(*) FILTER(WHERE covered=active_runner_count) AS all_runner_witness_races,count(*) FILTER(WHERE card_fetch_prestart) AS prestart_card_fetch_races,count(*) FILTER(WHERE card_times_prestart) AS both_prestart_races,
(SELECT jsonb_agg(to_jsonb(b)) FROM (SELECT * FROM a WHERE covered=active_runner_count ORDER BY (prior_rows+lap_rows) DESC LIMIT 8) b) AS best_candidates,
(SELECT to_jsonb(b) FROM a b WHERE race_date='2026-11-22' AND track='佐賀' AND race_no=8) AS saga8
FROM a;
ROLLBACK;
