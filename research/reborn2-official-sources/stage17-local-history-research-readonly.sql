BEGIN READ ONLY;
WITH s AS (
 SELECT id,race_date,as_of,captured_at,official_post_time,active_runner_count,source_version,evidence->'packet' AS p
 FROM private.lab_preclaim_evidence_snapshots_v1
 WHERE id='f2274744-6506-49a3-9c85-329ca55c9cac' AND circuit='LOCAL' AND race_date='2026-11-22' AND track='佐賀' AND race_no=8
 AND as_of<=captured_at AND captured_at<official_post_time
 AND evidence->'packet'->'marketUsed'='false'::jsonb AND evidence->'packet'->'targetResultUsed'='false'::jsonb
), w AS (
 SELECT s.id,s.race_date,s.as_of,s.captured_at,s.official_post_time,s.source_version,
 j->>'horseNo' AS current_no,j->>'horseName' AS horse_name,substring(j->>'horseRef' from 'k_lineageLoginCode=([0-9]{11})') AS horse_id,
 j->'pastRace' AS prior_race,j->>'pastHorseNo' AS prior_no,j->>'sourceRef' AS source_ref,(j->>'sourceCheckedAt')::timestamptz AS source_checked,
 j->'corners' AS corners,j->'earlyPos' AS early_pos,j->'finalTurnPos' AS final_turn_pos,
 ord AS witness_ordinal
 FROM s CROSS JOIN LATERAL jsonb_array_elements(s.p->'evidence') WITH ORDINALITY e(j,ord)
 WHERE j->>'source'='NAR_OFFICIAL_PAST_RACE_RESULT' AND j->>'identityVerifiedBy'='OFFICIAL_HORSE_REF'
 AND j->'pastRace'->>'raceDate'<s.race_date::text AND (j->>'sourceCheckedAt')::timestamptz<=s.as_of
), l AS (
 SELECT s.id,j,ord AS lap_ordinal FROM s CROSS JOIN LATERAL jsonb_array_elements(s.p->'officialRaceLaps') WITH ORDINALITY e(j,ord)
 WHERE j->>'status'='VERIFIED_RACE_LEVEL_LAPS' AND j->>'finish_time_reconciled'='true'
 AND j->>'individual_horse_sectionals'='false' AND j->'pastRace'->>'raceDate'<s.race_date::text
 AND (j->>'sourceCheckedAt')::timestamptz<=s.as_of
), links AS (
 SELECT w.*,o.settlement_n,o.own_n,o.result_id,o.settled_at,o.finish_literal,o.clock_literal,
 a.archive_n,a.archive_id,a.finish_present,a.clock_present,a.f3_present,a.class_present,
 ll.lap_n,ll.lap_ordinal,ll.lap_segments,ll.lap_distance,ll.lap_winner_time,ll.lap_source,
 count(*) OVER(PARTITION BY w.current_no,w.prior_race) AS duplicate_n
 FROM w
 LEFT JOIN LATERAL (
 SELECT count(DISTINCT z.id) AS settlement_n,count(f.h) AS own_n,min(z.id::text) AS result_id,min(z.settled_at) AS settled_at,min(f.h->>'finish') AS finish_literal,min(f.h->>'time') AS clock_literal
 FROM public.official_results z LEFT JOIN LATERAL (
 SELECT h FROM jsonb_array_elements(CASE WHEN jsonb_typeof(z.result->'finishers')='array' THEN z.result->'finishers' ELSE '[]'::jsonb END) h
 WHERE h->>'horse_no'=w.prior_no AND h->>'horse_name'=w.horse_name
 ) f ON TRUE
 WHERE z.circuit='LOCAL' AND z.source='NAR_OFFICIAL_RACEMARK' AND z.race_date::text=w.prior_race->>'raceDate'
 AND z.track=w.prior_race->>'track' AND z.race_no::text=w.prior_race->>'raceNo'
 AND z.settled_at<=w.as_of AND z.created_at<=w.as_of
 ) o ON TRUE
 LEFT JOIN LATERAL (
 SELECT count(h.id) AS archive_n,min(h.id) AS archive_id,
 count(h.id) FILTER(WHERE h.finish>0) AS finish_present,count(h.id) FILTER(WHERE h.time_raw IS NOT NULL AND h.time_raw<>'') AS clock_present,
 count(h.id) FILTER(WHERE h.final3f>0) AS f3_present,count(h.id) FILTER(WHERE h.race_type IS NOT NULL AND h.race_type<>'') AS class_present
 FROM public.horse_runs h
 WHERE h.race_date::text=w.prior_race->>'raceDate' AND h.track=w.prior_race->>'track' AND h.race_no::text=w.prior_race->>'raceNo' AND h.horse_no::text=w.prior_no AND h.horse_name=w.horse_name
 ) a ON TRUE
 LEFT JOIN LATERAL (
 SELECT count(*) AS lap_n,min(lap_ordinal) AS lap_ordinal,
 (jsonb_agg(j->'segments')->0) AS lap_segments,(jsonb_agg(j->'distance_m')->0) AS lap_distance,
 (jsonb_agg(j->'winner_time_seconds')->0) AS lap_winner_time,min(j->>'sourceRef') AS lap_source
 FROM l WHERE l.id=w.id AND l.j->'pastRace'=w.prior_race
 ) ll ON TRUE
)
SELECT current_no,horse_id,as_of,jsonb_agg(jsonb_build_object(
 'witness_ordinal',witness_ordinal,'prior_race',prior_race,'prior_no',prior_no,'source_ref',source_ref,'source_checked',source_checked,'duplicate_n',duplicate_n,
 'settlement_n',settlement_n,'own_n',own_n,'settlement_row_id',CASE WHEN settlement_n=1 THEN result_id END,
 'settlement_checked',CASE WHEN settlement_n=1 THEN settled_at END,'archive_n',archive_n,'archive_row_id',CASE WHEN archive_n=1 THEN archive_id END,
 'archive_finish_present',finish_present,'archive_clock_present',clock_present,'archive_f3_present',f3_present,'archive_class_present',class_present,
 'lap_n',lap_n,'lap_ordinal',CASE WHEN lap_n=1 THEN lap_ordinal END,'lap_source',CASE WHEN lap_n=1 THEN lap_source END,
 'observations',jsonb_build_object('corners',corners,'early_pos',early_pos,'final_turn_pos',final_turn_pos,
 'finish_literal',CASE WHEN settlement_n=1 AND own_n=1 THEN finish_literal END,'clock_literal',CASE WHEN settlement_n=1 AND own_n=1 THEN clock_literal END,
 'race_lap_segments',CASE WHEN lap_n=1 THEN lap_segments END,'race_lap_distance',CASE WHEN lap_n=1 THEN lap_distance END,'winner_time',CASE WHEN lap_n=1 THEN lap_winner_time END)
 ) ORDER BY witness_ordinal) histories FROM links GROUP BY current_no,horse_id,as_of ORDER BY current_no::int;
ROLLBACK;
