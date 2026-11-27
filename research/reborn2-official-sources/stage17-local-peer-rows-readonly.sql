BEGIN READ ONLY;
-- REBORN2 research-only; no new acquisition, no market fields.
WITH s AS (
 SELECT id,race_date,track,race_no,as_of,captured_at,official_post_time,evidence->'packet' AS packet
 FROM private.lab_preclaim_evidence_snapshots_v1 WHERE id='f2274744-6506-49a3-9c85-329ca55c9cac'
 AND circuit='LOCAL' AND captured_at<official_post_time AND as_of<=captured_at
 AND evidence->'packet'->'marketUsed'='false'::jsonb AND evidence->'packet'->'targetResultUsed'='false'::jsonb
), p AS (
 SELECT s.*,f FROM s CROSS JOIN LATERAL jsonb_array_elements(packet->'opponentFollowups') f
), joined AS (
 SELECT p.*,w.n AS own_witness_n,w.subject_id,w.prior_no,
 (f->>'identityMethod'='EXACT_NAR_OFFICIAL_HORSE_ID_TWO_RESULT_PAGES' AND f->>'peerOfficialHorseId'~'^[0-9]{11}$'
 AND f->'priorRace'->>'raceDate'<f->'followupRace'->>'raceDate'
 AND f->'followupRace'->>'raceDate'<race_date::text
 AND (f->>'sourceCheckedAt')::timestamptz<=as_of AND (f->>'followupCheckedAt')::timestamptz<=as_of
 AND f->>'sourceRef' LIKE 'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?%'
 AND f->>'followupSourceRef' LIKE 'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?%'
 AND f->>'peerPriorFinish'~'^[1-9][0-9]*$' AND f->>'peerFollowupFinish'~'^[1-9][0-9]*$') AS peer_gate
 FROM p LEFT JOIN LATERAL (
 SELECT count(*) AS n,min(substring(e->>'horseRef' FROM 'k_lineageLoginCode=([0-9]{11})')) AS subject_id,min(e->>'pastHorseNo') AS prior_no
 FROM jsonb_array_elements(p.packet->'evidence') e
 WHERE e->>'horseNo'=f->>'horseNo' AND e->>'horseName'=f->>'horseName' AND e->'pastRace'=f->'priorRace'
 AND e->>'sourceRef'=f->>'sourceRef' AND e->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT'
 AND e->>'identityVerifiedBy'='OFFICIAL_HORSE_REF' AND (e->>'sourceCheckedAt')::timestamptz<=as_of
 ) w ON true
), checked AS (
 SELECT j.*,a.n AS prior_settlement_n,a.own_n,a.own_finish,a.peer_n,b.n AS followup_settlement_n,b.peer_n AS followup_peer_n
 FROM joined j LEFT JOIN LATERAL (
 SELECT count(*) AS n,
 sum((SELECT count(*) FROM jsonb_array_elements(z.result->'finishers') h WHERE h->>'horse_no'=j.prior_no AND h->>'horse_name'=j.f->>'horseName' AND h->>'finish'~'^[1-9][0-9]*$')) AS own_n,
 min((SELECT min((h->>'finish')::int) FROM jsonb_array_elements(z.result->'finishers') h WHERE h->>'horse_no'=j.prior_no AND h->>'horse_name'=j.f->>'horseName' AND h->>'finish'~'^[1-9][0-9]*$')) AS own_finish,
 sum((SELECT count(*) FROM jsonb_array_elements(z.result->'finishers') h WHERE h->>'horse_name'=j.f->>'peerName' AND h->>'finish'=j.f->>'peerPriorFinish')) AS peer_n
 FROM public.official_results z WHERE circuit='LOCAL' AND source='NAR_OFFICIAL_RACEMARK' AND z.race_date::text=j.f->'priorRace'->>'raceDate' AND z.track=j.f->'priorRace'->>'track' AND z.race_no::text=j.f->'priorRace'->>'raceNo' AND z.settled_at<=j.as_of
 ) a ON true LEFT JOIN LATERAL (
 SELECT count(*) AS n,sum((SELECT count(*) FROM jsonb_array_elements(z.result->'finishers') h WHERE h->>'horse_name'=j.f->>'peerName' AND h->>'finish'=j.f->>'peerFollowupFinish')) AS peer_n
 FROM public.official_results z WHERE circuit='LOCAL' AND source='NAR_OFFICIAL_RACEMARK' AND z.race_date::text=j.f->'followupRace'->>'raceDate' AND z.track=j.f->'followupRace'->>'track' AND z.race_no::text=j.f->'followupRace'->>'raceNo' AND z.settled_at<=j.as_of
 ) b ON true
), output AS (
 SELECT *,coalesce(peer_gate AND own_witness_n=1 AND subject_id IS NOT NULL AND subject_id<>f->>'peerOfficialHorseId',false) AS snapshot_linked FROM checked
)
SELECT f->>'horseNo' AS subject_no,subject_id,prior_no,f->>'peerOfficialHorseId' AS peer_id,f->'priorRace' AS prior_race,f->'followupRace' AS candidate_event,f->>'sourceRef' AS reference_source,f->>'followupSourceRef' AS followup_source,f->>'sourceCheckedAt' AS reference_checked,f->>'followupCheckedAt' AS followup_checked,snapshot_linked,prior_settlement_n,own_n,peer_n,followup_settlement_n,followup_peer_n,own_finish,f->>'peerPriorFinish' AS peer_prior_finish,f->>'peerFollowupFinish' AS peer_later_finish FROM output ORDER BY (f->>'horseNo')::int,(f->'priorRace')::text,(f->'followupRace')::text,f->>'peerOfficialHorseId';
ROLLBACK;
