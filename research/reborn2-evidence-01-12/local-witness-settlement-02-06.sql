-- Read-only LOCAL prestart witness + exact prior settlement join. Research only.
-- Settlement parser lacks complete field and final3f assurance. Do not promote candidate to official full-field evidence.
WITH s AS (
 SELECT id,race_date,track,race_no,as_of,captured_at,official_post_time,evidence->'packet' AS packet
 FROM private.lab_preclaim_evidence_snapshots_v1
 WHERE id='f2274744-6506-49a3-9c85-329ca55c9cac' AND circuit='LOCAL' AND captured_at<official_post_time AND as_of<=captured_at
), w AS (
 SELECT s.*,e FROM s CROSS JOIN LATERAL jsonb_array_elements(s.packet->'evidence') e
 WHERE s.packet->'marketUsed'='false'::jsonb AND s.packet->'targetResultUsed'='false'::jsonb
 AND e->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT' AND e->>'identityVerifiedBy'='OFFICIAL_HORSE_REF'
 AND e->'pastRace'->>'raceDate'<s.race_date::text AND (e->>'sourceCheckedAt')::timestamptz<=s.as_of
)
SELECT w.id,w.race_date AS target_date,w.as_of,w.captured_at,w.official_post_time,
 e->'horseNo' AS current_no,e->>'horseName' AS horse_name,e->>'horseRef' AS horse_ref,e->'pastHorseNo' AS prior_no,
 e->'pastRace'->>'raceDate' AS prior_date,e->'pastRace'->>'track' AS prior_track,e->'pastRace'->'raceNo' AS prior_race_no,
 e->>'sourceRef' AS source_ref,e->>'sourceCheckedAt' AS source_checked_at,
 o.n AS settlement_matches,CASE WHEN o.n=1 THEN o.data END AS settlement
 FROM w LEFT JOIN LATERAL (
 SELECT count(*) AS n,(jsonb_agg(jsonb_build_object('source',z.source,'settled_at',z.settled_at,
 'rows',(SELECT jsonb_agg(jsonb_build_object('horse_no',f->'horse_no','horse_name',f->'horse_name','finish',f->'finish','time_raw',f->'time')) FROM jsonb_array_elements(z.result->'finishers') f))) -> 0) AS data
 FROM public.official_results z
 WHERE z.circuit='LOCAL' AND z.source='NAR_OFFICIAL_RACEMARK' AND z.race_date::text=e->'pastRace'->>'raceDate'
 AND z.track=e->'pastRace'->>'track' AND z.race_no::text=e->'pastRace'->>'raceNo' AND z.settled_at<=w.as_of
 ) o ON TRUE ORDER BY (e->>'horseNo')::int,e->'pastRace'->>'raceDate' DESC;
